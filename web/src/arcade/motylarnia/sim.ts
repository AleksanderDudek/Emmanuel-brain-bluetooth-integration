/**
 * Motylarnia's rules and state, without the DOM: one session of rounds, each a butterfly —
 *
 *   NOWY LIŚĆ   3 s: two egg cards; a tap or Space picks, else the left card is taken
 *   ŻER         the push block (22–28 s, shorter in short sessions): the caterpillar crawls toward
 *               the finger and eats a trail; appetite (the brain, after a 6 s lag) sets its speed and
 *               bite, and fills "Śmiałe linie" S; an 8 s hold in the zone turns the trail to silk
 *   PRZĘDZENIE  3 s, the start of the rest block: it climbs and spins
 *   POCZWARKA   the rest of the rest block (20–26 s in all), hands-free: calm clears the shell and
 *               fills "Barwy" B; from round 3 one chrysalis in four is a blind silk cocoon
 *   WYLOT       5 s: the butterfly — its wing is the eaten path, bold where S filled, deep where B did
 *
 * The brain follows the design's per-block references: a leaf is judged against the previous
 * chrysalis (+ m_up), a chrysalis against the previous leaf (− m_down), means taken after each
 * block's lag window and fixed for the block; a between-block staircase moves the margins toward
 * ~75 % success.  A block succeeds when its on-side value averaged at least ½ over its reliable
 * scored seconds (its meter, S or B, then ends full).
 *
 * Bad signal is neutral — it neither pays nor costs: S and B freeze, the block clock stands still up
 * to 8 s while the caterpillar crawls on without eating, and after that it eats at the neutral
 * appetite (v at the reference); a gap longer than the grace breaks the zone hold and its silk.  A
 * block with too few reliable scored seconds drops out of the staircase, the next reference and the
 * contrast; its size is simply what was eaten.  Inside a blind cocoon nothing tells the result before
 * it opens, not even the pad's sound.  The session's headline is the total wingspan in mm, with the
 * current caterpillar's provisional size counted live; a session that ends early lets that caterpillar
 * out as a butterfly of the size it reached.
 */
import { BlockContrast, type FocusFrame } from '../kit/focus';
import { mulberry32 } from '../../core/random';
import { fmtSigned } from '../../i18n';
import type { Tool } from '../../tools';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  ABERRATION_FORM, CLASS_FROM, DANDELION_BONUS, HABITATS, NEUTRAL_DEPTH, PIGMENTS, RASPBERRY_POLLEN, SIZE_CLASSES, SPECIES,
  capital, speciesById, type Aberration, type HabitatId, type SizeClass, type Species,
} from './content';
import { t } from './i18n';
import { CELL, GRID_W, buildLeaf, leafDist, leafNormal, placeDots, type Bite, type Dot, type LeafModel, type Treat, type TreatKind } from './leaf';
import {
  F, beginSession, drawEggs, emerge, eggsLine, hatch, laterEggs, type ButterflyRec, type EggOffer, type MothProgress,
} from './meta';
import { decodePath, encodePath, type PathPoint } from './wing';

export type Phase = 'leaf' | 'feed' | 'spin' | 'chrysalis' | 'emerge' | 'finale';

export const T_LEAF = 3;
/** without a choice the left egg hatches this long before the telegraph ends (the leaf fades in) */
export const PICK_GRACE = 0.5;
export const T_SPIN = 3;
export const T_EMERGE = 5;
/** the shortest push or rest block (s); the sim also keeps every block at least its lag window plus KEEP_MIN */
export const MIN_BLOCK = 12;
export const LEAF_RANGE: [number, number] = [22, 28];
export const REST_RANGE: [number, number] = [20, 26];
const NOMINAL_ROUND = 56;
/** the block clock stands still at most this long per block while the signal is bad (s) */
export const PAUSE_MAX = 8;
/** a block needs this many reliable scored seconds to count (70 % of a shorter block's scored time) */
export const KEEP_MIN = 8;
/** time a last short round needs so its leaf ends before time up even if it pauses (s) */
const LAST_LEAF_ROOM = T_LEAF + MIN_BLOCK + PAUSE_MAX;
/** v at the reference: the appetite bad-signal time plays at (no reward, no loss) */
export const NEUTRAL_V = 0.5;
const WIDTH = 2.5;
/** a dip out of the zone, or a gap in the signal, shorter than this keeps the hold (s) */
export const GRACE = 1.5;
/** the chrysalis' translucency with no calm at all, and while nothing is judged (its lag, bad signal) */
const GLASS_MIN = 0.15;
const GLASS_IDLE = 0.3;
export const SILK_HOLD = 8;
export const MARGIN_START = 1.0;
export const MARGIN_EASY = 0.3;
const MARGIN_MAX = 4;

export const TURN = (200 * Math.PI) / 180;
export const SPEED: [number, number] = [40, 90];
export const BITE: [number, number] = [10, 26];
/** the head stays this far inside the leaf's edge */
export const DMIN = 9;
const EDGE = 34;
const TRAIL = 200;
const TRAIL_STEP = 2;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const approach = (a: number, b: number, dt: number, tau: number) => (tau <= 0 ? b : b + (a - b) * Math.exp(-dt / tau));
const logistic = (x: number) => 1 / (1 + Math.exp(-x));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export interface RoundPlan { leaf: number; rest: number; rounds: number }

/**
 * The next round's block lengths from the time left: as many ~56 s rounds as fit, blocks jittered
 * within 22–28 / 20–26 s, never under `minBlock` (the sim passes its lag window plus KEEP_MIN, so a
 * block with a clean signal always counts), and the round's total fixed so the plan ends on time.
 * Null: not even a short round fits.
 */
export function planRound(remaining: number, rng: () => number, minBlock = MIN_BLOCK): RoundPlan | null {
  const fixed = T_LEAF + T_EMERGE;
  if (remaining < fixed + 2 * minBlock) return null;
  let n = Math.max(1, Math.round(remaining / NOMINAL_ROUND));
  while (remaining / n - fixed > LEAF_RANGE[1] + REST_RANGE[1]) n++;
  while (n > 1 && remaining / n - fixed < 2 * minBlock) n--;
  const blocks = remaining / n - fixed, mid = (blocks * 25) / 48;
  // a full round keeps both blocks in their ranges; a short one scales them (never under minBlock);
  // one longer than both ranges (only a 60–70 s session) splits in proportion
  let lo = Math.max(minBlock, blocks - REST_RANGE[1]), hi = Math.min(LEAF_RANGE[1], blocks - minBlock);
  if (blocks >= LEAF_RANGE[0] + REST_RANGE[0]) {
    lo = Math.max(lo, LEAF_RANGE[0]);
    hi = Math.min(hi, blocks - REST_RANGE[0]);
  }
  if (lo > hi) lo = hi = clamp(mid, minBlock, blocks - minBlock);
  const jitter = Math.min(3, Math.max(0, (hi - lo) / 2));
  const leaf = clamp(mid + (rng() * 2 - 1) * jitter, lo, hi);
  return { leaf, rest: blocks - leaf, rounds: n };
}

/** From round 3, one chrysalis in four is a blind silk cocoon (never the last round's). */
export const isBlind = (index: number, roundsLeft: number): boolean => index >= 3 && roundsLeft > 1 && (index - 3) % 4 === 0;

/** The wing palette after eating `pigment`: three slots, newest last, the oldest drops out. */
export function addPigment(palette: readonly number[], pigment: number): number[] {
  const out = palette.filter(p => p !== pigment);
  out.push(pigment);
  return out.length > 3 ? out.slice(out.length - 3) : out;
}

/** The size class of an eaten share. */
export function sizeClass(eaten: number): number {
  let c = 0;
  for (let i = 1; i < CLASS_FROM.length; i++) if (eaten >= CLASS_FROM[i]) c = i;
  return c;
}

/** Wingspan (mm) of a species from the eaten share: S below the typical range, XL a little above it. */
export function wingspan(sp: Species, eaten: number): number {
  const [lo, hi] = sp.span, mid = (lo + hi) / 2;
  const knots: [number, number][] = [[0, lo * 0.78], [CLASS_FROM[1], lo], [CLASS_FROM[2], mid], [CLASS_FROM[3], hi], [0.5, hi * 1.12]];
  const e = clamp(eaten, 0, 0.5);
  for (let i = 1; i < knots.length; i++) {
    if (e <= knots[i][0]) {
      const [x0, y0] = knots[i - 1], [x1, y1] = knots[i];
      return Math.round(y0 + ((y1 - y0) * (e - x0)) / (x1 - x0));
    }
  }
  return Math.round(hi * 1.12);
}

/** One push (leaf) or rest (chrysalis) block. */
export interface Block {
  kind: 'focus' | 'rest';
  len: number;
  /** seconds on the block clock */
  clock: number;
  /** seconds the clock stood still for bad signal, and whether it stands still now */
  paused: number;
  frozen: boolean;
  ref: number;
  /** S or B as shown: fill-only, full exactly when the block succeeds */
  meter: number;
  /** reliable seconds after the lag window, and the on-side value and the activity summed over them */
  reliableScored: number;
  vSum: number;
  sum: number;
  /** the latest on-side value (v on the leaf, calm' = 1 − v in the chrysalis) */
  v: number;
  /** a held stretch in the zone, and time out of it (grace) */
  zone: number;
  out: number;
  reliable: boolean;
}

export interface Caterpillar {
  x: number;
  y: number;
  heading: number;
  /** shown appetite 0..1 (speed, bite, munch) */
  a: number;
  speed: number;
  bite: number;
  /** girth grows with what it ate */
  girth: number;
  /** seconds since the last bite that ate fresh leaf */
  fresh: number;
  /** recent head positions (ring buffer, every TRAIL_STEP units) for the body */
  trail: Float32Array;
  trailHead: number;
  trailCount: number;
  sinceTrail: number;
  sinceBite: number;
  sincePoint: number;
  side: number;
  hatchT: number;
  /** which way it curls along the edge (±1; 0 = not decided) */
  curl: number;
  /** where it was a moment ago (net progress), and how long it is unsticking itself */
  fromX: number;
  fromY: number;
  recentT: number;
  unstick: number;
}

export interface Outcome {
  rec: ButterflyRec;
  species: Species;
  path: PathPoint[];
  isNew: boolean;
  record: boolean;
  aberration: Aberration | null;
  radiant: boolean;
  classic: boolean;
  bold: boolean;
  deep: boolean;
  blind: boolean;
  silk: boolean;
  cls: SizeClass;
  pollen: number;
  opened: HabitatId | null;
  daily: boolean;
}

export interface Round {
  index: number;
  /** the golden-hour finisher: beginner margins */
  last: boolean;
  /** its emergence ends the session, as far as the clock can tell when it starts to spin */
  final: boolean;
  blind: boolean;
  plan: RoundPlan;
  offers: EggOffer[];
  pick: number;
  highlight: number;
  species: Species | null;
  daily: boolean;
  leaf: LeafModel | null;
  dots: Dot[];
  treats: Treat[];
  eaten: Uint8Array;
  eatenCells: number;
  bites: Bite[];
  path: PathPoint[];
  palette: number[];
  dandelions: number;
  cat: Caterpillar;
  leafBlock: Block | null;
  restBlock: Block | null;
  leafKept: boolean | null;
  restKept: boolean | null;
  /** chrysalis translucency shown (0 opaque … 1 clear) */
  glass: number;
  /** a silk run is being drawn; where it began in the path */
  silkOn: boolean;
  silkFrom: number;
  silk: boolean;
  outcome: Outcome | null;
}

export type SimEvent =
  | { type: 'round'; index: number; last: boolean }
  | { type: 'pick'; index: number }
  | { type: 'hatch' }
  | { type: 'dot'; pigment: number; x: number; y: number; n: number }
  | { type: 'treat'; kind: TreatKind; x: number; y: number }
  | { type: 'class'; cls: number }
  | { type: 'bold' }
  | { type: 'silk' }
  | { type: 'full' }
  | { type: 'spin'; blind: boolean }
  | { type: 'deep' }
  | { type: 'emerge'; outcome: Outcome }
  | { type: 'finale' };

export interface SimOptions {
  progress: MothProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  tool: Tool;
}

const newCat = (): Caterpillar => ({
  x: 0, y: 0, heading: -Math.PI / 2, a: 0, speed: SPEED[0], bite: BITE[0], girth: 9, fresh: 9,
  trail: new Float32Array(TRAIL * 2), trailHead: 0, trailCount: 0, sinceTrail: 0, sinceBite: 0, sincePoint: 0, side: 1, hatchT: 0,
  curl: 0, fromX: 0, fromY: 0, recentT: 0, unstick: 0,
});

export class MothSim {
  readonly p: MothProgress;
  readonly lag: number;
  readonly tau: number;
  /** the shortest block: never under 12 s, and long enough that a block with a clean signal counts */
  readonly minBlock: number;
  phase: Phase = 'leaf';
  phaseT = 0;
  /** seconds of play (the runner's clock) */
  t = 0;
  round: Round | null = null;
  readonly done: Outcome[] = [];
  readonly contrast: BlockContrast;
  margins = { up: MARGIN_START, down: MARGIN_START, upMiss: 0, downMiss: 0 };
  readonly lastMean: { focus: number | null; rest: number | null } = { focus: null, rest: null };
  readonly counts = { pushJudged: 0, pushOk: 0, restJudged: 0, restOk: 0, blindN: 0, blindOk: 0, pollen: 0 };
  readonly bestBefore: number | null;
  started = false;
  private events: SimEvent[] = [];
  private readonly n = { x: 0, y: 0 };
  private target: { x: number; y: number } | null = null;
  private held = false;
  private downAt = 0;
  private moved = 0;
  private waypointUntil = 0;
  private turnKeys = { left: false, right: false };
  private lastClass = 0;
  private roundIndex = 0;

  constructor(readonly o: SimOptions) {
    this.p = o.progress;
    const eeg = o.tool === 'eeg';
    this.lag = eeg ? 2 : 6;
    this.tau = eeg ? 1.5 : 3;
    this.minBlock = Math.max(MIN_BLOCK, this.lag + KEEP_MIN);
    this.contrast = new BlockContrast(this.lag);
    this.bestBefore = this.p.total > 0 || this.p.bestSession > 0 ? this.p.bestSession : null;
  }

  /**
   * Play begins: the session counts, the welcome-back egg.  The first round is planned on the first
   * update, when the session clock is known (it already runs during the countdown).
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    const beginner = this.p.sessions < 3;
    beginSession(this.p, this.o.day, this.o.rng);
    if (beginner) this.margins.up = this.margins.down = MARGIN_EASY;
  }

  drain(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private emit(e: SimEvent): void {
    if (this.events.length < 64) this.events.push(e);
  }

  // ── rounds ──────────────────────────────────────────────────────
  private nextRound(): void {
    const left = this.o.plannedSec - this.t;
    // after bad-signal pauses a round of 12 s blocks may still fit where one of minBlock no longer
    // does (such short blocks count with 70 % of their scored time), or a last one whose leaf ends
    // before time up and whose chrysalis and emergence run into the overtime
    const plan = planRound(left, this.o.rng, this.minBlock) ?? planRound(left, this.o.rng)
      ?? (left >= LAST_LEAF_ROOM ? { leaf: MIN_BLOCK, rest: MIN_BLOCK, rounds: 1 } : null);
    if (!plan) {
      this.setPhase('finale');
      this.emit({ type: 'finale' });
      return;
    }
    const index = ++this.roundIndex;
    const last = plan.rounds === 1 && index >= 2;
    const blind = isBlind(index, plan.rounds);
    this.round = {
      index, last, final: false, blind, plan, offers: drawEggs(this.p, this.o.day, this.o.daySeed, this.o.rng), pick: -1, highlight: 0,
      species: null, daily: false, leaf: null, dots: [], treats: [], eaten: new Uint8Array(0), eatenCells: 0, bites: [], path: [],
      palette: [], dandelions: 0, cat: newCat(), leafBlock: null, restBlock: null, leafKept: null, restKept: null,
      glass: GLASS_IDLE, silkOn: false, silkFrom: -1, silk: false, outcome: null,
    };
    this.lastClass = 0;
    this.setPhase('leaf');
    this.emit({ type: 'round', index, last });
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  /** Choose egg card `i` (during NOWY LIŚĆ); nothing is spent until its butterfly emerges. */
  pick(i: number): boolean {
    const r = this.round;
    if (!r || this.phase !== 'leaf' || r.pick >= 0 || !r.offers[i]) return false;
    const offer = r.offers[i];
    r.pick = i;
    r.highlight = i;
    const sp = speciesById(offer.sp);
    r.species = sp;
    r.daily = offer.source === 'daily';
    // the day's leaf is the same for everyone: its dots come from the day's seed
    const rng = r.daily ? mulberry32(this.o.daySeed) : this.o.rng;
    const leaf = buildLeaf(sp.plant);
    r.leaf = leaf;
    // the recipe's three colours and one more: the classic form takes a plan, not luck
    const colours = [...sp.classic];
    const others = PIGMENTS.map((_, k) => k).filter(k => !colours.includes(k));
    colours.push(others[Math.floor(rng() * others.length)]);
    const first = this.p.total === 0 && r.index === 1 && !r.daily;
    const { dots, treats } = placeDots(leaf, rng, colours, first ? 9 : 12 + Math.floor(rng() * 5), first);
    r.dots = dots;
    r.treats = treats;
    r.eaten = new Uint8Array(leaf.inside.length);
    const c = r.cat;
    c.x = leaf.start.x;
    c.y = leaf.start.y;
    c.heading = leaf.start.heading;
    for (let k = 0; k < TRAIL; k++) {
      c.trail[k * 2] = c.x - Math.cos(c.heading) * k * TRAIL_STEP * leaf.k * 0.15;
      c.trail[k * 2 + 1] = c.y - Math.sin(c.heading) * k * TRAIL_STEP * leaf.k * 0.15;
    }
    c.trailCount = TRAIL;
    c.trailHead = 0;
    this.emit({ type: 'pick', index: i });
    return true;
  }

  // ── input ───────────────────────────────────────────────────────
  /** Pointer in leaf space (the game converts from the screen). */
  pointer(type: 'down' | 'move' | 'up', x: number, y: number): void {
    if (type === 'down') {
      this.target = { x, y };
      this.held = true;
      this.downAt = this.t;
      this.moved = 0;
    } else if (type === 'move' && this.held && this.target) {
      this.moved += Math.hypot(x - this.target.x, y - this.target.y);
      this.target.x = x;
      this.target.y = y;
    } else if (type === 'up' && this.held) {
      this.held = false;
      // a tap leaves a waypoint; letting go after a drag lets it crawl on by itself
      if (this.t - this.downAt < 0.35 && this.moved < 24) this.waypointUntil = this.t + 1.6;
      else this.target = null;
    }
  }

  /** Keys: Left/Right (A/D) turn on the leaf or move the card highlight; 1/2, Space, Enter pick. */
  key(key: string, down: boolean): boolean {
    const r = this.round;
    const k = key.length === 1 ? key.toLowerCase() : key;
    const left = k === 'ArrowLeft' || k === 'a', right = k === 'ArrowRight' || k === 'd';
    if (this.phase === 'leaf' && r && r.pick < 0) {
      if (!down) return left || right || k === ' ' || k === 'Enter' || k === '1' || k === '2';
      if (left) { r.highlight = 0; return true; }
      if (right) { r.highlight = Math.min(r.offers.length - 1, 1); return true; }
      if (k === '1' || k === '2') return this.pick(Number(k) - 1);
      if (k === ' ' || k === 'Enter') return this.pick(r.highlight);
      return false;
    }
    if (left || right) {
      if (left) this.turnKeys.left = down;
      if (right) this.turnKeys.right = down;
      return this.phase === 'feed';
    }
    return false;
  }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started) this.start();
    this.t = t;
    if (!this.round && this.phase === 'leaf') this.nextRound();
    if (dt <= 0) return;
    this.phaseT += dt;
    const r = this.round;
    switch (this.phase) {
      case 'leaf':
        if (!r) break;
        if (r.pick < 0 && this.phaseT >= T_LEAF - PICK_GRACE) this.pick(0);
        if (this.phaseT >= T_LEAF) this.beginFeed(f);
        break;
      case 'feed':
        if (!r?.leafBlock) break;
        this.tickBlock(r.leafBlock, f, dt, true);
        this.feed(r, r.leafBlock, dt);
        if (r.leafBlock.clock >= r.leafBlock.len) this.endFeed(r, f);
        break;
      case 'spin':
        if (!r?.restBlock) break;
        this.tickBlock(r.restBlock, f, dt, false);
        this.chrysalis(r, r.restBlock, dt);
        if (this.phaseT >= T_SPIN) this.setPhase('chrysalis');
        break;
      case 'chrysalis':
        if (!r?.restBlock) break;
        this.tickBlock(r.restBlock, f, dt, true);
        this.chrysalis(r, r.restBlock, dt);
        if (r.restBlock.clock >= r.restBlock.len) this.endRest(r);
        break;
      case 'emerge':
        if (this.phaseT >= T_EMERGE) this.nextRound();
        break;
      case 'finale':
        break;
    }
  }

  private newBlock(kind: 'focus' | 'rest', len: number, ref: number): Block {
    return {
      kind, len, clock: 0, paused: 0, frozen: false, ref, meter: 0, reliableScored: 0, vSum: 0, sum: 0,
      v: NEUTRAL_V, zone: 0, out: 0, reliable: false,
    };
  }

  /** Reliable scored seconds a block needs to count: KEEP_MIN, or 70 % of a short block's scored time. */
  keepMin(b: Block): number {
    return Math.min(KEEP_MIN, 0.7 * Math.max(0, b.len - this.lag));
  }

  private margin(kind: 'up' | 'down'): number {
    if (this.round?.last) return MARGIN_EASY;
    return kind === 'up' ? this.margins.up : this.margins.down;
  }

  /** The block's reference: the other kind's last kept mean ± margin, else the adaptive threshold. */
  private reference(kind: 'focus' | 'rest', f: FocusFrame): number {
    if (kind === 'focus') return this.lastMean.rest !== null ? this.lastMean.rest + this.margin('up') : f.threshold;
    return this.lastMean.focus !== null ? this.lastMean.focus - this.margin('down') : f.threshold;
  }

  private beginFeed(f: FocusFrame): void {
    const r = this.round!;
    r.leafBlock = this.newBlock('focus', r.plan.leaf, this.reference('focus', f));
    r.cat.hatchT = 0;
    hatch(this.p, r.species!.id, this.o.day);
    this.target = null;
    this.held = false;
    this.setPhase('feed');
    this.emit({ type: 'hatch' });
  }

  /**
   * The block clock (standing still up to PAUSE_MAX while the signal is bad), the on-side value, the
   * meter and the zone hold.  The meter fills against the reliable seconds the block can still
   * deliver, so seconds lost to bad signal cost no fill; it can only grow (and freezes while the
   * signal is bad), and once full the block has succeeded whatever comes next.  The hold counts
   * reliable seconds only, and a gap in the signal counts as time out of the zone (as
   * FocusInput.breakHold does): one longer than the grace ends the hold.
   */
  private tickBlock(b: Block, f: FocusFrame, dt: number, canPause: boolean): void {
    const ok = f.reliable && f.activity !== null && Number.isFinite(f.activity);
    b.reliable = ok;
    b.frozen = !ok && canPause && b.paused < PAUSE_MAX;
    if (b.frozen) b.paused += dt;
    else b.clock += dt;
    if (!ok) {
      // S and B freeze; the hold waits through a short gap and breaks after a longer one
      b.out += dt;
      if (b.out > GRACE) b.zone = 0;
      return;
    }
    const v = logistic((f.activity! - b.ref) / WIDTH);
    b.v = b.kind === 'focus' ? v : 1 - v;
    if (b.clock < this.lag) return;
    b.reliableScored += dt;
    b.vSum += b.v * dt;
    b.sum += f.activity! * dt;
    const can = b.reliableScored + Math.max(0, b.len - b.clock);
    // full needs the block to count already (a short one with dropouts may not yet)
    const top = b.reliableScored >= this.keepMin(b) ? 1 : 0.99;
    const before = b.meter;
    b.meter = Math.min(top, b.meter + (2 * b.v * dt) / Math.max(4, can));
    if (before < 1 && b.meter >= 1) this.filled(b);
    if (b.v >= 0.5) {
      b.zone += dt;
      b.out = 0;
    } else {
      b.out += dt;
      if (b.out > GRACE) b.zone = 0;
    }
  }

  /** A meter just filled: its word and sound (a blind cocoon keeps its secret until it opens). */
  private filled(b: Block): void {
    if (b.kind === 'focus') this.emit({ type: 'bold' });
    else if (!this.round?.blind) this.emit({ type: 'deep' });
  }

  private feed(r: Round, b: Block, dt: number): void {
    const leaf = r.leaf!, c = r.cat;
    c.hatchT += dt;
    // appetite: base while it wakes up (the lag window), then v shown with τ; while the signal is bad
    // the neutral v of the reference stands in, eased the same way (a quicker ease would itself pay)
    const ok = b.reliable;
    const want = b.clock < this.lag ? 0 : ok ? b.v : NEUTRAL_V;
    c.a = approach(c.a, want, dt, this.tau);
    c.speed = (SPEED[0] + (SPEED[1] - SPEED[0]) * c.a) * leaf.k;
    c.bite = (BITE[0] + (BITE[1] - BITE[0]) * c.a) * leaf.k;
    c.fresh += dt;
    // the jedwabna nić: a hold of 8 s in the zone makes the trail silk from the hold's start; a dip or a
    // gap in the signal past the grace breaks the hold and ends the silk (only reliable points are silk)
    if (b.zone === 0) {
      r.silkFrom = -1;
      r.silkOn = false;
    } else if (ok) {
      if (r.silkFrom < 0) r.silkFrom = r.path.length;
      if (!r.silkOn && b.zone >= SILK_HOLD) {
        r.silkOn = true;
        r.silk = true;
        for (let i = r.silkFrom; i < r.path.length; i++) if (!r.path[i].bad) r.path[i].silk = true;
        this.emit({ type: 'silk' });
      }
    }
    this.steer(leaf, c, dt);
    this.record(r, c, b);
    // while the block clock stands still it crawls on without eating: the paused seconds add no leaf,
    // so a dropout neither pays nor costs
    if (!b.frozen) this.eat(r, leaf, c);
    c.girth = (8 + 7 * Math.min(1, this.eatenShare(r) / 0.32)) * leaf.k;
    const cls = sizeClass(this.eatenShare(r));
    if (cls > this.lastClass) {
      this.lastClass = cls;
      this.emit({ type: 'class', cls });
    }
  }

  /** A unit vector into the leaf at a point; at a sharp tip, where the field has no slope, toward the leaf's middle. */
  private inward(leaf: LeafModel, x: number, y: number): { x: number; y: number } {
    const n = leafNormal(leaf, x, y, this.n);
    const e = CELL * 1.5, slope = Math.abs(leafDist(leaf, x + n.x * e, y + n.y * e) - leafDist(leaf, x - n.x * e, y - n.y * e));
    if (slope < e * 0.5) {
      const mx = (leaf.box.x0 + leaf.box.x1) / 2 - x, my = (leaf.box.y0 + leaf.box.y1) / 2 - y, l = Math.hypot(mx, my) || 1;
      n.x = mx / l;
      n.y = my / l;
    }
    return n;
  }

  /** Turn toward the finger (capped), follow the edge when nothing steers, never leave the leaf. */
  private steer(leaf: LeafModel, c: Caterpillar, dt: number): void {
    const k = leaf.k, edge = EDGE * k, dmin = DMIN * k;
    const hx = Math.cos(c.heading), hy = Math.sin(c.heading);
    let desired: number | null = null;
    let keyTurn = 0;
    if (this.turnKeys.left !== this.turnKeys.right) keyTurn = this.turnKeys.left ? -1 : 1;
    else if (this.target) {
      const dx = this.target.x - c.x, dy = this.target.y - c.y, d = Math.hypot(dx, dy);
      const waypointLive = this.held || this.t < this.waypointUntil;
      if (!waypointLive) this.target = null;
      else if (d > 14 * k) {
        // a target inside the turning circle cannot be reached by turning: go on, then come round
        const R = c.speed / TURN, side = hx * dy - hy * dx >= 0 ? 1 : -1;
        const cx = c.x - hy * R * side, cy = c.y + hx * R * side;
        desired = Math.hypot(this.target.x - cx, this.target.y - cy) < R * 0.98 ? c.heading : Math.atan2(dy, dx);
      } else if (!this.held) this.target = null;
    }
    // stuck (a corner, a tip): turn toward the leaf's middle for a moment
    if (c.unstick > 0) {
      c.unstick -= dt;
      const mx = (leaf.box.x0 + leaf.box.x1) / 2 - c.x, my = (leaf.box.y0 + leaf.box.y1) / 2 - c.y;
      desired = Math.atan2(my, mx);
      keyTurn = 0;
    }
    const look = 20 * k + c.speed * 0.3;
    const lx = c.x + hx * look, ly = c.y + hy * look;
    const dl = leafDist(leaf, lx, ly);
    if (dl < edge && c.unstick <= 0) {
      const n = this.inward(leaf, dl < -edge ? c.x : lx, dl < -edge ? c.y : ly);
      // keep curling the same way; meeting the edge head-on, turn toward the side with more room
      const along = -n.y * hx + n.x * hy, into = hx * n.x + hy * n.y;
      if (Math.abs(along) > 0.5 && into > -0.6) c.curl = along > 0 ? 1 : -1;
      else if (c.curl === 0) {
        const a = c.heading + 1.2, b = c.heading - 1.2;
        c.curl = leafDist(leaf, c.x + Math.cos(a) * look, c.y + Math.sin(a) * look) >= leafDist(leaf, c.x + Math.cos(b) * look, c.y + Math.sin(b) * look) ? 1 : -1;
        // the tangent (−n.y, n.x) turns one way; flip so the curl goes toward the roomier side
        const tx0 = -n.y, ty0 = n.x, ra = Math.cos(a) * tx0 + Math.sin(a) * ty0;
        c.curl = ra >= 0 ? c.curl : -c.curl;
      }
      const tx = -n.y * c.curl, ty = n.x * c.curl;
      const pull = clamp((edge - dl) / edge, 0, 1.5);
      const edgeDir = Math.atan2(ty + n.y * pull * 1.1, tx + n.x * pull * 1.1);
      if (desired === null && keyTurn === 0) desired = edgeDir;
      else if (desired !== null && Math.cos(desired) * n.x + Math.sin(desired) * n.y < 0 && dl < edge * 0.7) desired = edgeDir;
      else if (keyTurn !== 0 && dl < edge * 0.4 && hx * n.x + hy * n.y < 0) { desired = edgeDir; keyTurn = 0; }
    } else if (dl > edge * 1.6) c.curl = 0;
    const maxTurn = TURN * dt;
    const delta = desired !== null ? clamp(wrap(desired - c.heading), -maxTurn, maxTurn) : keyTurn * maxTurn;
    c.heading = wrap(c.heading + delta);
    const step = c.speed * dt * Math.min(1, 0.35 + c.hatchT);
    let nx = c.x + Math.cos(c.heading) * step, ny = c.y + Math.sin(c.heading) * step;
    if (leafDist(leaf, nx, ny) < dmin) {
      // slide along the edge instead of crossing it, the way it curls
      const n = this.inward(leaf, c.x, c.y);
      let tx = -n.y, ty = n.x;
      if (c.curl !== 0) { tx *= c.curl; ty *= c.curl; } else if (tx * Math.cos(c.heading) + ty * Math.sin(c.heading) < 0) { tx = -tx; ty = -ty; }
      nx = c.x + tx * step;
      ny = c.y + ty * step;
      const d = leafDist(leaf, nx, ny);
      if (d < dmin) {
        nx += n.x * (dmin - d + 0.5);
        ny += n.y * (dmin - d + 0.5);
      }
    }
    const moved = Math.hypot(nx - c.x, ny - c.y);
    c.x = nx;
    c.y = ny;
    c.sinceBite += moved;
    c.sincePoint += moved;
    c.sinceTrail += moved;
    c.recentT += dt;
    if (c.recentT >= 0.6) {
      if (Math.hypot(c.x - c.fromX, c.y - c.fromY) < c.speed * c.recentT * 0.3 && c.hatchT > 1 && !this.held) c.unstick = 0.7;
      c.fromX = c.x;
      c.fromY = c.y;
      c.recentT = 0;
    }
    while (c.sinceTrail >= TRAIL_STEP * k) {
      c.sinceTrail -= TRAIL_STEP * k;
      c.trailHead = (c.trailHead + 1) % TRAIL;
      c.trail[c.trailHead * 2] = c.x;
      c.trail[c.trailHead * 2 + 1] = c.y;
      c.trailCount = Math.min(TRAIL, c.trailCount + 1);
    }
  }

  /**
   * A point of the eaten path every few units, for the wing.  A paused stretch (nothing eaten) is a
   * thin thread; points taken while the signal is bad are never silk.
   */
  private record(r: Round, c: Caterpillar, b: Block): void {
    if (c.sincePoint < 6 * r.leaf!.k) return;
    c.sincePoint = 0;
    r.path.push(b.reliable ? { x: c.x, y: c.y, a: c.a, silk: r.silkOn } : { x: c.x, y: c.y, a: b.frozen ? 0 : c.a, silk: false, bad: true });
  }

  private eat(r: Round, leaf: LeafModel, c: Caterpillar): void {
    const rad = c.bite / 2;
    if (c.sinceBite < Math.max(2.5 * leaf.k, rad * 0.45)) return;
    c.sinceBite = 0;
    c.side = -c.side;
    const mouth = c.girth * 0.75, cs = Math.cos(c.heading), sn = Math.sin(c.heading);
    const mx = c.x + cs * mouth - sn * c.side * rad * 0.18, my = c.y + sn * mouth + cs * c.side * rad * 0.18;
    r.bites.push({ x: mx, y: my, r: rad });
    // the coarse grid: cells whose centres fall in the bite
    const i0 = Math.max(0, Math.floor((mx - rad) / CELL)), i1 = Math.min(GRID_W - 1, Math.floor((mx + rad) / CELL));
    const j0 = Math.max(0, Math.floor((my - rad) / CELL)), j1 = Math.min(leaf.inside.length / GRID_W - 1, Math.floor((my + rad) / CELL));
    let fresh = 0;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * GRID_W + i;
        if (!leaf.inside[k] || r.eaten[k]) continue;
        const dx = (i + 0.5) * CELL - mx, dy = (j + 0.5) * CELL - my;
        if (dx * dx + dy * dy <= rad * rad) {
          r.eaten[k] = 1;
          fresh++;
        }
      }
    }
    if (fresh) {
      r.eatenCells += fresh;
      c.fresh = 0;
    }
    for (const d of r.dots) {
      if (d.eaten || Math.hypot(d.x - mx, d.y - my) > rad + d.r * 0.6) continue;
      d.eaten = true;
      r.palette = addPigment(r.palette, d.pigment);
      this.emit({ type: 'dot', pigment: d.pigment, x: d.x, y: d.y, n: r.dots.filter(o => o.eaten).length });
    }
    for (const t of r.treats) {
      if (t.eaten || Math.hypot(t.x - mx, t.y - my) > rad + t.r * 0.6) continue;
      t.eaten = true;
      if (t.kind === 'malina') {
        this.p.pollen += RASPBERRY_POLLEN;
        this.counts.pollen += RASPBERRY_POLLEN;
      } else r.dandelions++;
      this.emit({ type: 'treat', kind: t.kind, x: t.x, y: t.y });
    }
  }

  /** Eaten share of the leaf plus the dandelions' size bonus. */
  eatenShare(r: Round): number {
    return r.leaf ? r.eatenCells / r.leaf.insideCount + r.dandelions * DANDELION_BONUS : 0;
  }

  private staircase(kind: 'up' | 'down', success: boolean): void {
    const m = this.margins, key = kind === 'up' ? 'upMiss' : 'downMiss';
    let v = m[kind];
    if (success) {
      v += 0.2;
      m[key] = 0;
    } else {
      v -= 0.6;
      m[key]++;
      if (m[key] >= 2) v = MARGIN_EASY;
    }
    m[kind] = clamp(v, MARGIN_EASY, MARGIN_MAX);
  }

  /**
   * Close a block.  It counts with enough reliable scored seconds, and then succeeds when its on-side
   * value averaged at least ½ over them — the meter ends full (topped up here when the last seconds
   * left it just short); counted blocks feed the staircase, the next reference and the contrast.
   */
  private judge(b: Block): boolean {
    const kept = b.reliableScored > 0 && b.reliableScored >= this.keepMin(b);
    if (!kept) return false;
    const success = b.meter >= 1 || b.vSum >= 0.5 * b.reliableScored;
    if (success && b.meter < 1) {
      b.meter = 1;
      this.filled(b);
    }
    const mean = b.sum / b.reliableScored;
    this.staircase(b.kind === 'focus' ? 'up' : 'down', success);
    this.lastMean[b.kind] = mean;
    this.contrast.push(b.kind, mean, true, this.lag, b.reliableScored);
    if (b.kind === 'focus') {
      this.counts.pushJudged++;
      if (success) this.counts.pushOk++;
    } else {
      this.counts.restJudged++;
      if (success) this.counts.restOk++;
    }
    return true;
  }

  private endFeed(r: Round, f: FocusFrame): void {
    r.leafKept = this.judge(r.leafBlock!);
    this.target = null;
    this.held = false;
    this.turnKeys.left = this.turnKeys.right = false;
    r.restBlock = this.newBlock('rest', this.restLength(r), this.reference('rest', f));
    // after this emergence not even a last short round would fit (see nextRound)
    r.final = this.o.plannedSec - this.t - r.restBlock.len - T_EMERGE < LAST_LEAF_ROOM;
    r.glass = GLASS_IDLE;
    this.setPhase('spin');
    this.emit({ type: 'full' });
    this.emit({ type: 'spin', blind: r.blind });
  }

  /**
   * The chrysalis' length.  The last round's takes up any slip of the leaf so the emergence ends near
   * time up.  An earlier round's leaves room for the next round even if bad-signal pauses hold this
   * chrysalis up too: it shortens (never under minBlock) when a slip has eaten into that room, and when
   * not even a last short round would fit after it, this round ends the session.
   */
  private restLength(r: Round): number {
    const left = this.o.plannedSec - this.t - T_EMERGE;   // this chrysalis and any rounds after it
    const most = Math.max(REST_RANGE[1], r.plan.rest);
    if (r.plan.rounds === 1) return clamp(left, this.minBlock, most);
    const round = T_LEAF + T_EMERGE + 2 * this.minBlock;
    if (left - r.plan.rest >= round + PAUSE_MAX) return r.plan.rest;
    const rest = clamp(left - round - PAUSE_MAX, this.minBlock, r.plan.rest);
    if (left - rest - PAUSE_MAX >= LAST_LEAF_ROOM) return rest;
    return clamp(left, this.minBlock, most + PAUSE_MAX);
  }

  private chrysalis(r: Round, b: Block, dt: number): void {
    const want = b.clock < this.lag || !b.reliable ? GLASS_IDLE : GLASS_MIN + (1 - GLASS_MIN) * b.v;
    r.glass = approach(r.glass, want, dt, b.reliable ? this.tau : 0.6);
  }

  private endRest(r: Round): void {
    r.restKept = this.judge(r.restBlock!);
    const outcome = this.emergeRound(r);
    if (r.blind) {
      this.counts.blindN++;
      if (outcome.deep) this.counts.blindOk++;
    }
    this.setPhase('emerge');
    this.emit({ type: 'emerge', outcome });
  }

  /**
   * The round's butterfly flies out and its egg is spent.  Its size is what it ate, dropped leaf or
   * not: bad-signal time already ate at the neutral appetite and paused time ate nothing, so no floor
   * is needed (a fixed one paid better than playing).  A chrysalis that was dropped, or never finished
   * because the session ended, shows middling colours at least; a meter that filled (bold, deep) stands
   * whatever came after it.
   */
  private emergeRound(r: Round): Outcome {
    const sp = r.species!, lb = r.leafBlock!, rb = r.restBlock;
    const eaten = this.eatenShare(r);
    const depth = rb && r.restKept ? rb.meter : Math.max(rb?.meter ?? 0, NEUTRAL_DEPTH);
    const bold = lb.meter >= 1, deep = depth >= 1, radiant = bold && deep;
    const classic = r.palette.length === 3 && sp.classic.every(c => r.palette.includes(c));
    const blind = r.blind && rb !== null;
    const cls = sizeClass(eaten), mm = wingspan(sp, eaten);
    const flags = (radiant ? F.RADIANT : 0) | (classic ? F.CLASSIC : 0) | (blind ? F.BLIND : 0) | (r.silk ? F.SILK : 0) | (bold ? F.BOLD : 0) | (deep ? F.DEEP : 0);
    const path = encodePath(r.path);
    const res = emerge(this.p, { sp: sp.id, mm, cls, flags, pig: r.palette, depth, path, daily: r.daily, egg: r.offers[r.pick] ?? null }, this.o.day, this.o.rng);
    const outcome: Outcome = {
      rec: res.rec, species: sp, path: decodePath(path), isNew: res.isNew, record: res.record, aberration: res.aberration,
      radiant, classic, bold, deep, blind, silk: r.silk, cls: SIZE_CLASSES[cls], pollen: res.pollen, opened: res.opened, daily: r.daily,
    };
    this.counts.pollen += res.pollen;
    r.outcome = outcome;
    this.done.push(outcome);
    return outcome;
  }

  /**
   * The session ends before its own ending ("Zakończ i zapisz", the overtime limit): a caterpillar that
   * is eating or pupating flies out now as a butterfly of the size it reached (unjudged blocks leave the
   * stats alone); an egg that has not hatched yet is not spent and waits for the next session.
   */
  finish(): void {
    const r = this.round;
    if (r?.species && r.leafBlock && !r.outcome) this.emergeRound(r);
    this.setPhase('finale');
  }

  /**
   * What the ambient pad's brightness follows (0..1), or null to hold it still: the appetite while it
   * eats (the brain you can hear), the clearing shell in a seen chrysalis (calm opens the sound as it
   * clears the shell); held on the egg cards, at the emergence and inside a blind cocoon, so the sound
   * never tells what the picture keeps to itself.
   */
  padLevel(): number | null {
    const r = this.round;
    if (!r) return null;
    if (this.phase === 'feed') return r.cat.a;
    if ((this.phase === 'spin' || this.phase === 'chrysalis') && !r.blind) return clamp((r.glass - GLASS_MIN) / (1 - GLASS_MIN), 0, 1);
    return null;
  }

  // ── what the session shows ──────────────────────────────────────
  /** The current caterpillar's wingspan if it emerged now (null when there is none). */
  get provisional(): number | null {
    const r = this.round;
    if (!r?.species || r.outcome || (this.phase !== 'feed' && this.phase !== 'spin' && this.phase !== 'chrysalis')) return null;
    return wingspan(r.species, this.eatenShare(r));
  }

  get score(): number {
    return this.done.reduce((s, o) => s + o.rec.mm, 0) + (this.provisional ?? 0);
  }

  /** Time up may end the session except during a chrysalis or an emergence. */
  canStop(): boolean {
    return this.phase !== 'spin' && this.phase !== 'chrysalis' && this.phase !== 'emerge';
  }

  /**
   * The session's numbers; idempotent (only the best session goes into the progress, with max, and it
   * counts butterflies that flew out, never the caterpillar still eating).
   */
  result(): ArcadeOutcome {
    const score = this.score, c = this.counts, done = this.done;
    this.p.bestSession = Math.max(this.p.bestSession, done.reduce((s, o) => s + o.rec.mm, 0));
    const biggest = done.reduce<Outcome | null>((b, o) => (!b || o.rec.mm > b.rec.mm ? o : b), null);
    const contrast = this.contrast.contrast;
    const stats: [string, string][] = [
      [t('stat.butterflies'), String(done.length)],
      [t('stat.biggest'), biggest ? `${biggest.rec.mm} mm` : '—'],
      [t('stat.bold'), `${c.pushOk}/${c.pushJudged}`],
      [t('stat.deep'), `${c.restOk}/${c.restJudged}`],
      [t('stat.radiant'), String(done.filter(o => o.radiant).length)],
      [t('stat.contrast'), contrast === null ? '—' : t('pct', { v: fmtSigned(contrast, 1) })],
    ];
    if (c.blindN) stats.push([t('stat.blind'), `${c.blindOk}/${c.blindN}`]);
    if (c.pollen) stats.push([t('stat.pollen'), `+${c.pollen}`]);
    return {
      score, unit: 'mm', record: this.bestBefore !== null && score > this.bestBefore, stats, highlights: this.highlights(),
      verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage (kit/scripture.ts), one of those the session fits, in turn from
   * session to session: the full Atlas is all things made new, a new species the earth full of His
   * creatures, a deep chrysalis the wings of those who wait; the lilies and the birds fit every day.
   * The lobby already opens with 2 Corinthians 5:17.
   */
  private closingVerse(): PassageId {
    const fresh = this.done.some(o => o.isNew);
    if (fresh && SPECIES.every(s => (this.p.atlas[s.id]?.n ?? 0) > 0)) return 'rev21.5';
    const fit: PassageId[] = [];
    if (fresh) fit.push('psa104.24');
    if (this.counts.restOk > 0) fit.push('isa40.31');
    fit.push('mat6.28-29', 'mat6.26');
    return inTurn(fit, this.p.sessions);
  }

  /**
   * At most four lines for the summary, so the headline and the stats stay in view: what is new in the
   * Atlas, a new habitat, the brain's forms (radiant, silk), the day (its leaf, tomorrow's eggs), the
   * craft (classic forms, records) — each merged from the session's butterflies, in that order of
   * weight — and in the very first session one strategy tip to end on.
   */
  private highlights(): string[] {
    const done = this.done;
    /** the species of the butterflies `f` picks, each once */
    const species = (f: (o: Outcome) => boolean): string[] => [...new Set(done.filter(f).map(o => o.species.name))];
    const line = (...parts: (string | false)[]): string => capital(parts.filter(Boolean).join(' · '));
    const lines: string[] = [];
    // new species, an aberration in brackets after its species, or on its own
    const odd = new Map<string, string>();
    for (const o of done) if (o.aberration && !odd.has(o.species.name)) odd.set(o.species.name, ABERRATION_FORM[o.aberration]);
    const fresh = species(o => o.isNew);
    const freshText = fresh.map(n => (odd.has(n) ? t('hl.withForm', { name: n, form: odd.get(n)! }) : n)).join(', ');
    const oddText = [...odd].filter(([n]) => !fresh.includes(n)).map(([n, form]) => t('hl.form', { form, name: n }));
    if (fresh.length || oddText.length) lines.push(line(fresh.length > 0 && t(fresh.length > 1 ? 'hl.newN' : 'hl.new1', { list: freshText }), ...oddText));
    const opened = done.find(o => o.opened)?.opened;
    const habitat = HABITATS.find(hb => hb.id === opened);
    if (habitat) lines.push(t('hl.habitat', { habitat: habitat.name, n: SPECIES.filter(s => s.habitat === habitat.id).length }));
    const radiant = species(o => o.radiant), silk = done.some(o => o.silk);
    if (radiant.length) lines.push(line(t(radiant.length > 1 ? 'hl.radiantN' : 'hl.radiant1', { list: radiant.join(', ') }), silk && t('hl.silkOnWing')));
    else if (silk) lines.push(t('hl.silk', { s: SILK_HOLD }));
    const later = laterEggs(this.p, this.o.day), daily = done.some(o => o.daily);
    if (later.length) lines.push(line(daily && t('hl.dailyDone'), t('hl.tomorrow', { list: eggsLine(later) })));
    else if (daily) lines.push(t('hl.daily'));
    const classic = species(o => o.classic).join(', ');
    const best = new Map<string, Outcome>();
    for (const o of done) if (o.record && (best.get(o.species.id)?.rec.mm ?? 0) < o.rec.mm) best.set(o.species.id, o);
    const records = [...best.values()].map(o => t('hl.recordItem', { name: o.species.name, mm: o.rec.mm })).join(', ');
    if (classic || records) lines.push(line(!!classic && t('hl.classic', { list: classic }), !!records && t('hl.records', { list: records })));
    const tip = this.p.sessions <= 1 && done.length > 0;
    const out = lines.slice(0, tip ? 3 : 4);
    if (tip) out.push(t('hl.tip'));
    return out;
  }
}

