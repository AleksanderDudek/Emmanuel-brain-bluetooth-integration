/**
 * Motylarnia's rules, without the canvas (DESIGN.md §3 and §10.5): a Slither-like garden.  The
 * caterpillar crawls by itself and turns toward the finger (or ←/→); it grows with every leaf,
 * flower and dewdrop it eats; its own body, the rivals' bodies and the birds' pecks are the
 * obstacles — a bump is a stumble (it curls up, the tail's last segments fall as crumbs, it goes on),
 * never a lost session.  A rival whose head runs into your body curls and drops its length as food.
 * Holding (or Space) sprints; above the band's threshold in a push block the sprint is free.
 *
 * The band: in a push block (Apetyt) the reach — the circle around the head that pulls food into
 * the mouth — is the focus level (a dotted ring at the threshold); in a rest block (Sjesta) the birds
 * roost, dew falls, and calm deepens the colours of the chrysalises waiting on the twig, which hatch
 * at the block's end.  Every garden has a length goal (★), few stumbles (★★) and a side goal (★★★);
 * reaching the length spins a chrysalis, a new caterpillar hatches, the next garden begins.
 *
 * Pure: no DOM; randomness from the injected rng; what happened is queued for the view and the
 * sound (`take()`).  Numbers in rules.ts, data in content.ts, the meta in meta.ts.
 */
import { fmtSigned } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace } from '../kit/trace';
import type { ArcadeOutcome, Headline } from '../kit/types';
import {
  ABERRATION_FORM, LINES, SIZE_CLASSES, SPECIES, TIPS, capital, gardenAt, speciesById,
  type Aberration, type Garden, type Moment, type SideGoal, type Species,
} from './content';
import { t } from './i18n';
import { buildLeaf } from './leaf';
import type { LeafBox } from './layout';
import {
  F, beginSession, drawEggs, emerge, finishGarden, hatch, migrate, type EggOffer, type MothProgress,
} from './meta';
import { RULES, girthOf, reachFor, span } from './rules';
import { Talk } from './talk';
import { encodePath, type PathPoint } from './wing';

export { RULES };

const TAU = Math.PI * 2;
const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

// ── types ────────────────────────────────────────────────────────
export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

export type FoodKind = 'leaf' | 'flower' | 'dew' | 'crumb' | 'rare';
export interface Food { id: number; kind: FoodKind; x: number; y: number; r: number; pig: number; age: number; pulled: boolean }

export interface Seg { x: number; y: number }

export interface Worm {
  id: number;
  segs: Seg[];
  dir: number;
  want: number;
  /** pending growth (segments) */
  grow: number;
  /** seconds left curled up (a stumble), seconds left untouchable */
  curl: number;
  safe: number;
  sprinting: boolean;
  /** the species whose larva it is (its look) */
  sp: string;
  /** rivals: away (curled and gone) for this long; their wander target */
  away: number;
  tx: number;
  ty: number;
  think: number;
}

export type BirdState = 'walk' | 'warn' | 'peck' | 'roost';
export interface Bird { id: number; x: number; y: number; dir: number; state: BirdState; tx: number; ty: number; hop: number; timer: number; next: number; px: number; py: number }

export interface Chrysalis { id: number; sp: string; depth: number; stars: number; pig: number[]; path: string; len: number; egg: EggOffer | null; age: number; garden: number }

export interface Hatched {
  sp: Species; mm: number; cls: number; depth: number; radiant: boolean; isNew: boolean; aberration: Aberration | null; classic: boolean;
  rec: { id: number }; record: boolean;
}

export type Teach = 'steer' | 'eat' | 'sprint' | 'rival' | 'bird' | 'reach' | 'rest' | 'rare' | 'goal';
export type Card = { kind: 'open' | 'garden'; t: number; dur: number; garden: number };

export type SimEvent =
  | { type: 'eat'; kind: FoodKind; x: number; y: number; pts: number; mult: number; chain: number; pig: number }
  | { type: 'grow'; len: number }
  | { type: 'moult'; len: number }
  | { type: 'sprint'; on: boolean; free: boolean }
  | { type: 'stumble'; x: number; y: number; cause: 'self' | 'rival' | 'bird'; lost: number }
  | { type: 'curl'; x: number; y: number; pts: number }
  | { type: 'near'; x: number; y: number }
  | { type: 'swoop'; x: number; y: number }
  | { type: 'peck'; x: number; y: number; hit: boolean }
  | { type: 'side'; goal: SideGoal }
  | { type: 'goal'; stars: number; x: number; y: number }
  | { type: 'spun'; c: Chrysalis }
  | { type: 'garden'; index: number; g: Garden }
  | { type: 'hatch'; b: Hatched; slot: number }
  | { type: 'feast'; x: number; y: number; n: number }
  | { type: 'teach'; what: Teach; x: number; y: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null }
  | { type: 'finale' }
  | { type: 'done' };

// ── pure rules ───────────────────────────────────────────────────
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks: a warm-up the first time (30 s in 5–10 min, 20 s in 3 min, 8 s in a short
 * test), then Apetyt / Sjesta pairs (25 ± 3 s and 22 ± 3 s, scaled to end on time, jittered when
 * there is room), the last seconds left to the finale.  No block under 10 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  let left = Math.max(2 * R.minBlock, plannedSec - R.finale);
  const plan: Block[] = [];
  if (plannedSec <= 60) {
    if (firstEver) {
      const warm = R.warm.test;
      plan.push(b('warmup', warm));
      left = Math.max(2 * R.minBlock, left - warm);
    }
    plan.push(b('push', left / 2), b('rest', left / 2));
    return plan;
  }
  if (firstEver) {
    const warm = plannedSec >= 300 ? R.warm.long : R.warm.short;
    plan.push(b('warmup', warm));
    left -= warm;
  }
  const pair = R.push[0] + R.rest[0];
  const pairs = Math.max(1, Math.round(left / pair));
  const jitter = pairs >= 2 ? 1 : 0;
  const durs: number[] = [];
  for (let i = 0; i < pairs; i++) durs.push(R.push[0] + jitter * (rnd() * 2 - 1) * R.push[1], R.rest[0] + jitter * (rnd() * 2 - 1) * R.rest[1]);
  const scale = left / durs.reduce((s, d) => s + d, 0);
  for (let i = 0; i < durs.length; i++) durs[i] *= scale;
  liftShort(durs, R.minBlock);
  durs.forEach((dur, i) => plan.push(b(i % 2 ? 'rest' : 'push', dur)));
  return plan;
}

/** The chain multiplier after `chain` items eaten in a row (×1 … ×5). */
export const multOf = (chain: number): number => Math.min(RULES.chainMax, 1 + Math.floor(Math.max(0, chain - 1) / RULES.chainStep));

/** Stars for a finished garden: the length (★), at most one stumble (★★), the side goal (★★★). */
export const starsOf = (stumbles: number, side: boolean): number => 1 + (stumbles <= RULES.starStumbles ? 1 : 0) + (side ? 1 : 0);

/** The wing palette after eating `pigment`: three slots, newest last, the oldest drops out. */
export function addPigment(palette: readonly number[], pigment: number): number[] {
  const out = palette.filter(p => p !== pigment);
  out.push(pigment);
  return out.length > 3 ? out.slice(out.length - 3) : out;
}

/** A butterfly's size class: the garden's stars, one more for a deep chrysalis. */
export const sizeClass = (stars: number, depth: number): number => Math.max(0, Math.min(3, stars - 1 + (depth >= RULES.radiantDepth ? 1 : 0)));

/** Wingspan (mm) of a species for a size class (S under the typical range, XL a little above it). */
export function wingspan(sp: Species, cls: number, wobble = 0.5): number {
  const [lo, hi] = sp.span;
  const at = [lo * 0.86, lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.65, hi * 1.06][Math.max(0, Math.min(3, cls))];
  return Math.round(at + (wobble - 0.5) * (hi - lo) * 0.12);
}

const SIDE_NEED = (g: Garden): number => (g.side === 'rare' ? 1 : g.n);

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: MothProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
}

export class MothSim {
  readonly p: MothProgress;
  readonly R = RULES;
  private readonly rng: () => number;
  private readonly events: SimEvent[] = [];
  private readonly talkLines = new Talk(LINES, () => this.rng());
  readonly plannedSec: number;
  readonly eeg: boolean;
  started = false;
  phase: 'play' | 'spin' | 'finale' | 'done' = 'play';
  t = 0;
  /** world time that moves only in play (cards, spins and hit-stops hold it) */
  wt = 0;
  stop = 0;

  // the garden
  gardenIndex = 0;
  garden: Garden & { lap: number };
  food: Food[] = [];
  rivals: Worm[] = [];
  birds: Bird[] = [];
  player!: Worm;
  /** the current caterpillar: its egg, its colours (depth), palette, path, stumbles, the side goal's count */
  egg: EggOffer | null = null;
  depth: number = RULES.depthBase;
  palette: number[] = [];
  private path: PathPoint[] = [];
  /** the species' leaf box in the wing's space: the garden maps onto it, so the path becomes the wing's pattern */
  private box: LeafBox = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private pathT = 0;
  stumbles = 0;
  sideCount = 0;
  sideDone = false;
  peakLen = 0;
  twig: Chrysalis[] = [];
  card: Card | null = null;
  spinT = 0;
  private nextId = 1;
  private moultAt = 0;

  // the controls
  private aimDir: number | null = null;
  private keyTurn = 0;
  private holdSprint = false;
  private keySprint = false;
  sprintCost = 0;

  // the band
  reach: number = RULES.reachBase;
  /** the gauge (0..1, 0.5 at the threshold) or null when hidden */
  gauge: number | null = null;
  level = 0;
  freeSprint = false;
  private goodT = 0;

  /** the band's last 40 s, for the flowerbed along the bottom */
  readonly trace = new SignalTrace(40, 0.1);

  // the score
  score = 0;
  chain = 0;
  private lastEat = -9;
  grownTotal = 0;
  bestLenSession = 0;
  gardensDone = 0;
  starsWon = 0;
  curls = 0;
  nearMisses = 0;
  hatchedList: Hatched[] = [];

  // the blocks
  plan: Block[];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  private readonly judge: RoundJudge;
  private readonly contrast = new BlockContrast(4);
  private relSec = 0;
  readonly counts = { pushOk: 0, pushJudged: 0, restOk: 0, restJudged: 0, blindOk: 0, blindN: 0, feasts: 0 };
  tip = '';
  private readonly firstEver: boolean;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  private readonly bestBefore: number | null;
  private finaleT = 0;
  private settled = false;
  private taught = new Set<string>();
  /** when the last coach mark came (s of play): Hieronim keeps quiet while it shows */
  private teachAt = -99;

  constructor(readonly o: SimInit) {
    this.p = migrate(o.progress);
    this.rng = o.rng;
    this.plannedSec = o.plannedSec;
    this.eeg = o.eeg;
    this.judge = RoundJudge.from(o.tuning);
    this.bestBefore = this.p.sessions > 0 ? this.p.bestSession : null;
    this.firstEver = !this.p.tut;
    this.pushesBase = this.p.sessions * 4;
    this.plan = planBlocks(o.plannedSec, this.firstEver, o.rng);
    for (const s of this.p.seen) this.taught.add(s);
    this.gardenIndex = this.p.garden;
    this.garden = gardenAt(this.gardenIndex);
  }

  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get blind(): boolean { return this.block.kind === 'push' && this.block.blind; }
  get talk() { return this.talkLines.line; }
  get said(): readonly string[] { return this.talkLines.said; }
  get len(): number { return this.player.segs.length; }
  get girth(): number { return girthOf(this.len); }
  get mult(): number { return this.t - this.lastEat <= RULES.chainSec ? multOf(this.chain) : 1; }
  get sprinting(): boolean { return this.player.sprinting; }
  get leadIn(): number { return this.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs; }
  get sideNeed(): number { return SIDE_NEED(this.garden); }
  get rare(): Food | null { return this.food.find(f => f.kind === 'rare') ?? null; }
  get species(): Species { return speciesById(this.player.sp); }
  get firstSession(): boolean { return this.firstEver; }

  take(): SimEvent[] {
    if (!this.events.length) return [];
    return this.events.splice(0, this.events.length);
  }

  private emit(e: SimEvent): void { this.events.push(e); }

  private say(m: Moment, pri = 1, ttl = 5): void { this.talkLines.ask(m, pri, ttl); }

  // ── start ──────────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    beginSession(this.p, this.o.day, this.rng);
    this.newGarden(this.gardenIndex, true);
    if (this.firstEver) {
      this.card = { kind: 'open', t: 0, dur: RULES.openSec, garden: this.gardenIndex };
    }
    this.startBlock(0);
    this.say('open', 3, 10);
  }

  private newGarden(index: number, first: boolean): void {
    this.gardenIndex = index;
    this.garden = gardenAt(index);
    const W = RULES.worldW, H = RULES.worldH;
    // the caterpillar hatches in the middle, heading up
    const offers = drawEggs(this.p, this.o.day, this.o.daySeed, this.rng);
    this.egg = offers[0] ?? null;
    const sp = this.egg ? this.egg.sp : 'pawik';
    hatch(this.p, sp, this.o.day);
    this.box = buildLeaf(speciesById(sp).plant).box;
    this.player = this.worm(W / 2, H / 2 + 60, -Math.PI / 2, RULES.startLen, sp);
    this.player.safe = 1.2;
    this.food = [];
    for (let i = 0; i < RULES.leaves; i++) this.spawn('leaf');
    for (let i = 0; i < RULES.flowers; i++) this.spawn('flower');
    if (this.garden.side === 'rare') this.spawnRare();
    if (this.block?.kind === 'rest') for (let i = 0; i < RULES.dews; i++) this.spawn('dew');
    this.aimDir = null;
    this.depth = RULES.depthBase;
    this.palette = [];
    this.path = [];
    this.stumbles = 0;
    this.sideCount = 0;
    this.sideDone = false;
    this.peakLen = RULES.startLen;
    this.moultAt = 0;
    this.rivals = [];
    for (let i = 0; i < this.garden.rivals; i++) this.rivals.push(this.spawnRival());
    this.birds = [];
    for (let i = 0; i < this.garden.birds; i++) this.birds.push(this.spawnBird());
    if (!first) {
      this.card = { kind: 'garden', t: 0, dur: RULES.cardSec, garden: index };
      this.emit({ type: 'garden', index, g: this.garden });
      this.say('garden', 2, 8);
    }
    if (this.garden.side === 'rare' && this.rare) this.teach('rare', this.rare.x, this.rare.y);
  }

  private worm(x: number, y: number, dir: number, n: number, sp: string): Worm {
    const segs: Seg[] = [];
    for (let i = 0; i < n; i++) segs.push({ x: x - Math.cos(dir) * i * RULES.spacing, y: y - Math.sin(dir) * i * RULES.spacing });
    return { id: this.nextId++, segs, dir, want: dir, grow: 0, curl: 0, safe: 0, sprinting: false, sp, away: 0, tx: x, ty: y, think: 0 };
  }

  private rivalSpecies(): string {
    const pool = SPECIES.filter(s => s.id !== this.player?.sp);
    return pool[Math.floor(this.rng() * pool.length)].id;
  }

  /** A rival crawls in from the hedge, away from the player. */
  private spawnRival(): Worm {
    const W = RULES.worldW, H = RULES.worldH, m = RULES.hedge + 30;
    let best = { x: m, y: m }, bestD = -1;
    for (let k = 0; k < 6; k++) {
      const side = Math.floor(this.rng() * 4);
      const x = side === 0 ? m : side === 1 ? W - m : m + this.rng() * (W - 2 * m);
      const y = side === 2 ? m : side === 3 ? H - m : m + this.rng() * (H - 2 * m);
      const d = this.player ? dist2(x, y, this.player.segs[0].x, this.player.segs[0].y) : 1;
      if (d > bestD) { bestD = d; best = { x, y }; }
    }
    const dir = Math.atan2(H / 2 - best.y, W / 2 - best.x);
    const n = Math.round(8 + this.rng() * 6 + this.garden.lap * 3 + this.gardenIndex % 8);
    const w = this.worm(best.x, best.y, dir, n, this.rivalSpecies());
    w.safe = 1;
    return w;
  }

  private spawnBird(): Bird {
    const x = 200 + this.rng() * (RULES.worldW - 400), y = 150 + this.rng() * (RULES.worldH - 300);
    return { id: this.nextId++, x, y, dir: 0, state: this.block?.kind === 'rest' ? 'roost' : 'walk', tx: x, ty: y, hop: 0, timer: 0, next: span(RULES.swoopEvery, this.rng()), px: x, py: y };
  }

  private spawn(kind: FoodKind, at?: { x: number; y: number }): Food {
    const m = RULES.hedge + 20, W = RULES.worldW, H = RULES.worldH;
    let x = at?.x ?? m + this.rng() * (W - 2 * m), y = at?.y ?? m + this.rng() * (H - 2 * m);
    // fresh food never appears under the player's nose
    if (!at && this.player) {
      const h = this.player.segs[0];
      if (dist2(x, y, h.x, h.y) < 160 ** 2) { x = W - x; y = H - y; }
    }
    const f: Food = { id: this.nextId++, kind, x, y, r: RULES.food[kind].r, pig: kind === 'flower' ? Math.floor(this.rng() * 5) : -1, age: 0, pulled: false };
    this.food.push(f);
    return f;
  }

  private spawnRare(): void {
    const h = this.player?.segs[0] ?? { x: RULES.worldW / 2, y: RULES.worldH / 2 };
    // the far corner from the hatching spot
    const x = h.x < RULES.worldW / 2 ? RULES.worldW - 220 - this.rng() * 200 : 220 + this.rng() * 200;
    const y = h.y < RULES.worldH / 2 ? RULES.worldH - 200 - this.rng() * 150 : 200 + this.rng() * 150;
    const f = this.spawn('rare', { x, y });
    f.pig = Math.floor(this.rng() * 5);
  }

  private teach(what: Teach, x: number, y: number): void {
    if (this.taught.has(what)) return;
    this.taught.add(what);
    if (!this.p.seen.includes(what)) this.p.seen.push(what);
    this.teachAt = this.t;
    this.emit({ type: 'teach', what, x, y });
  }

  // ── the controls ───────────────────────────────────────────────
  /** Steer toward a direction (radians, screen = world orientation). */
  aim(dir: number): void {
    if (!Number.isFinite(dir)) return;
    this.aimDir = dir;
    if (this.card && this.card.t > 0.6) this.card.t = Math.max(this.card.t, this.card.dur - 0.25);
  }

  /** Close a card early (a tap). */
  tapCard(): void {
    if (this.card && this.card.t > 0.4) this.card.t = this.card.dur;
  }

  sprint(on: boolean): void { this.holdSprint = on; }

  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (k === 'ArrowLeft' || k === 'a') { this.keyTurn = down ? -1 : this.keyTurn === -1 ? 0 : this.keyTurn; if (down) this.aimDir = null; return true; }
    if (k === 'ArrowRight' || k === 'd') { this.keyTurn = down ? 1 : this.keyTurn === 1 ? 0 : this.keyTurn; if (down) this.aimDir = null; return true; }
    if (k === ' ' || k === 'Spacebar' || k === 'Shift' || k === 'ArrowUp' || k === 'w') {
      this.keySprint = down;
      if (down) this.tapCard();
      return true;
    }
    return false;
  }

  release(): void {
    this.keyTurn = 0;
    this.holdSprint = false;
    this.keySprint = false;
  }

  // ── a frame ────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || this.phase === 'done' || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    if (this.phase !== 'finale') this.schedule(dt, f, t);
    const b = this.block;
    this.trace.push(t, f, this.phase === 'finale' || b.kind === 'warmup' ? 'free' : b.kind === 'push' ? 'focus' : 'rest', this.blind);
    this.brain(dt, f);
    const banner = this.blockT < RULES.bannerSec && this.block.kind !== 'warmup';
    // Hieronim keeps quiet over the runner's banner, the opening card and a coach mark (one bubble at a time)
    this.talkLines.update(dt, t, banner || (!!this.card && this.card.kind === 'open') || t - this.teachAt < RULES.teachQuiet);
    if (this.phase === 'finale') { this.runFinale(dt); return; }
    if (this.card) {
      this.card.t += dt;
      if (this.card.t >= this.card.dur) this.card = null;
      else if (this.card.kind === 'open' || this.card.t < 1.2) return;
    }
    if (this.phase === 'spin') {
      this.spinT += dt;
      if (this.spinT >= RULES.spinSec) this.endSpin();
      return;
    }
    if (this.stop > 0) { this.stop = Math.max(0, this.stop - dt); return; }
    this.wt += dt;
    this.movePlayer(dt);
    for (const r of this.rivals) this.moveRival(r, dt);
    this.moveBirds(dt);
    this.eat(dt);
    this.collide();
    this.recordPath(dt);
    this.tutorial();
  }

  // ── the band ───────────────────────────────────────────────────
  private brain(dt: number, f: FocusFrame): void {
    const b = this.block, inPlay = this.phase === 'play' || this.phase === 'spin';
    const sighted = b.kind === 'push' && !b.blind && inPlay && this.blockT >= this.leadIn && f.reliable;
    const target = sighted ? reachFor(f.level) : RULES.reachBase;
    this.reach = target + (this.reach - target) * Math.exp(-dt / RULES.reachTau);
    this.level = f.level;
    this.freeSprint = sighted && f.level >= RULES.freeSprint;
    if (b.kind === 'push') {
      this.gauge = b.blind || !f.reliable ? null : this.blockT < this.leadIn ? 0 : clamp((this.reach - RULES.reachBase) / RULES.reachExtra);
      if (sighted && f.level >= 0.5) {
        this.goodT += dt;
        if (this.goodT >= RULES.goodSec && this.goodT - dt < RULES.goodSec) this.say('good', 2, 4);
      } else this.goodT = 0;
    } else if (b.kind === 'rest') {
      this.gauge = f.reliable ? clamp(f.calm) : null;
      if (f.reliable && inPlay) {
        // calm deepens the colours: the waiting chrysalises, and the caterpillar's own (it carries them into its chrysalis)
        const drive = clamp((f.calm - 0.3) / 0.7);
        const add = RULES.depthRate * drive * dt;
        for (const c of this.twig) c.depth = Math.min(1, c.depth + add);
        this.depth = Math.min(1, this.depth + add * (this.twig.length ? 0.4 : 1));
      }
    } else this.gauge = f.reliable ? clamp(f.level) : null;
  }

  /** The panel's gauge: the reach in a push block, the calm in a siesta (null: hidden or no signal). */
  meterValue(): number | null { return this.gauge; }

  /** The pad: the level in a sighted push block, still otherwise. */
  padLevel(f: FocusFrame): number | null {
    const b = this.block;
    return b.kind === 'push' && !b.blind && f.reliable ? f.level : null;
  }

  // ── movement ───────────────────────────────────────────────────
  private turnRate(len: number): number {
    return RULES.turn * (1 - (1 - RULES.turnLong) * clamp((len - 10) / 60));
  }

  private movePlayer(dt: number): void {
    const w = this.player;
    w.safe = Math.max(0, w.safe - dt);
    if (w.curl > 0) {
      w.curl = Math.max(0, w.curl - dt);
      return;
    }
    if (this.keyTurn) {
      w.want = w.dir + this.keyTurn * 1.2;
      w.dir = wrapA(w.dir + this.keyTurn * RULES.keyTurn * this.turnRate(this.len) * dt);
    } else {
      if (this.aimDir !== null) w.want = this.aimDir;
      const d = wrapA(w.want - w.dir), max = this.turnRate(this.len) * dt;
      w.dir = wrapA(w.dir + clamp(d, -max, max));
    }
    const want = this.holdSprint || this.keySprint;
    if (want !== w.sprinting) {
      w.sprinting = want;
      this.emit({ type: 'sprint', on: want, free: this.freeSprint });
      if (want) {
        this.teach('sprint', w.segs[0].x, w.segs[0].y);
        if (this.rng() < 0.25) this.say('sprint', 0, 3);
      }
    }
    if (w.sprinting && !this.freeSprint && this.len > RULES.sprintFreeLen) {
      this.sprintCost += dt;
      if (this.sprintCost >= RULES.sprintCost) {
        this.sprintCost = 0;
        const tail = w.segs.pop()!;
        this.spawn('crumb', { x: tail.x, y: tail.y });
      }
    }
    const speed = w.sprinting ? RULES.sprint : RULES.speed;
    this.advance(w, speed * dt);
    this.bounce(w);
    // a new segment for every whole one eaten
    while (w.grow >= 1) {
      w.grow -= 1;
      const tail = w.segs[w.segs.length - 1];
      w.segs.push({ x: tail.x, y: tail.y });
      this.grownTotal++;
      this.emit({ type: 'grow', len: this.len });
    }
    if (this.len > this.peakLen) this.peakLen = this.len;
    this.bestLenSession = Math.max(this.bestLenSession, this.len);
    const next = RULES.moults[this.moultAt];
    if (next !== undefined && this.len >= next) {
      this.moultAt++;
      this.emit({ type: 'moult', len: this.len });
      this.say('moult', 1, 4);
    }
    if (this.len >= this.garden.len && this.phase === 'play') this.beginSpin();
  }

  /** Move the head `step` u along its heading; every segment follows the one before at `spacing`. */
  private advance(w: Worm, step: number): void {
    const s = w.segs, h = s[0], sp = RULES.spacing;
    h.x += Math.cos(w.dir) * step;
    h.y += Math.sin(w.dir) * step;
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > sp) {
        const k = sp / d;
        b.x = a.x + dx * k;
        b.y = a.y + dy * k;
      }
    }
  }

  /** The hedge turns a head back into the garden (never a stumble). */
  private bounce(w: Worm): void {
    const h = w.segs[0], m = RULES.hedge, W = RULES.worldW, H = RULES.worldH;
    let c = Math.cos(w.dir), s = Math.sin(w.dir), hit = false;
    if (h.x < m && c < 0) { c = -c; hit = true; }
    if (h.x > W - m && c > 0) { c = -c; hit = true; }
    if (h.y < m && s < 0) { s = -s; hit = true; }
    if (h.y > H - m && s > 0) { s = -s; hit = true; }
    h.x = clamp(h.x, m * 0.5, W - m * 0.5);
    h.y = clamp(h.y, m * 0.5, H - m * 0.5);
    if (hit) {
      w.dir = Math.atan2(s, c);
      w.want = w.dir;
      if (w === this.player) this.aimDir = null;
    }
  }

  private moveRival(r: Worm, dt: number): void {
    if (r.away > 0) {
      r.away -= dt;
      if (r.away <= 0) Object.assign(r, this.spawnRival(), { id: r.id });
      return;
    }
    r.safe = Math.max(0, r.safe - dt);
    if (r.curl > 0) { r.curl -= dt; return; }
    r.think -= dt;
    const h = r.segs[0];
    if (r.think <= 0) {
      r.think = 0.35 + this.rng() * 0.3;
      // greedy: the nearest food it sees, or a wander point; now and then it cuts across the player
      let best: Food | null = null, bd = 260 ** 2;
      for (const f of this.food) {
        const d = dist2(f.x, f.y, h.x, h.y) / (f.kind === 'flower' || f.kind === 'crumb' ? 2 : 1);
        if (d < bd) { bd = d; best = f; }
      }
      const ph = this.player.segs[0];
      if (this.rng() < 0.18 && dist2(ph.x, ph.y, h.x, h.y) < 380 ** 2) {
        r.tx = ph.x + Math.cos(this.player.dir) * 90;
        r.ty = ph.y + Math.sin(this.player.dir) * 90;
      } else if (best) {
        r.tx = best.x;
        r.ty = best.y;
      } else if (dist2(r.tx, r.ty, h.x, h.y) < 60 ** 2) {
        r.tx = 150 + this.rng() * (RULES.worldW - 300);
        r.ty = 150 + this.rng() * (RULES.worldH - 300);
      }
      r.want = Math.atan2(r.ty - h.y, r.tx - h.x);
      // it sees the player's body ahead only some of the time (so it can blunder into it)
      if (this.rng() < 0.55) {
        const ax = h.x + Math.cos(r.dir) * 55, ay = h.y + Math.sin(r.dir) * 55;
        for (let i = 0; i < this.player.segs.length; i += 2) {
          const s = this.player.segs[i];
          if (dist2(s.x, s.y, ax, ay) < 40 ** 2) {
            r.want = r.dir + (wrapA(Math.atan2(s.y - h.y, s.x - h.x) - r.dir) > 0 ? -1.4 : 1.4);
            break;
          }
        }
      }
    }
    const max = RULES.rivalTurn * dt, d = wrapA(r.want - r.dir);
    r.dir = wrapA(r.dir + clamp(d, -max, max));
    const slow = this.block.kind === 'rest' ? RULES.restSlow : 1;
    this.advance(r, RULES.rivalSpeed * slow * dt);
    this.bounce(r);
    while (r.grow >= 1 && r.segs.length < 46) {
      r.grow -= 1;
      const tail = r.segs[r.segs.length - 1];
      r.segs.push({ x: tail.x, y: tail.y });
    }
  }

  private moveBirds(dt: number): void {
    const rest = this.block.kind === 'rest';
    const ph = this.player.segs[0];
    for (const b of this.birds) {
      if (rest) {
        if (b.state !== 'roost') { b.state = 'roost'; b.timer = 0; }
        b.timer += dt;
        continue;
      }
      if (b.state === 'roost') {
        b.state = 'walk';
        b.timer = 0;
        b.next = span(RULES.swoopEvery, this.rng()) * 0.6;
      }
      b.timer += dt;
      if (b.state === 'walk') {
        b.next -= dt;
        b.hop -= dt;
        if (b.hop <= 0) {
          // a hop toward somewhere near the caterpillar: hungry birds follow the long ones
          b.hop = 0.45 + this.rng() * 0.5;
          if (this.rng() < 0.35 + Math.min(0.4, this.len / 120)) {
            b.tx = ph.x + (this.rng() - 0.5) * 360;
            b.ty = ph.y + (this.rng() - 0.5) * 360;
          } else {
            b.tx = clamp(b.x + (this.rng() - 0.5) * 300, 100, RULES.worldW - 100);
            b.ty = clamp(b.y + (this.rng() - 0.5) * 300, 100, RULES.worldH - 100);
          }
          b.dir = Math.atan2(b.ty - b.y, b.tx - b.x);
        }
        const d = Math.hypot(b.tx - b.x, b.ty - b.y), step = Math.min(d, RULES.birdHop * dt * (b.hop > 0.25 ? 1.6 : 0.2));
        if (d > 1) { b.x += ((b.tx - b.x) / d) * step; b.y += ((b.ty - b.y) / d) * step; }
        if (b.next <= 0) {
          // the swoop: a shadow where the head is going
          b.state = 'warn';
          b.timer = 0;
          const lead = (this.player.sprinting ? RULES.sprint : RULES.speed) * RULES.swoopWarn * 0.6;
          b.px = clamp(ph.x + Math.cos(this.player.dir) * lead, 80, RULES.worldW - 80);
          b.py = clamp(ph.y + Math.sin(this.player.dir) * lead, 80, RULES.worldH - 80);
          this.emit({ type: 'swoop', x: b.px, y: b.py });
          this.teach('bird', b.px, b.py);
          this.say('bird', 1, 3);
        }
      } else if (b.state === 'warn') {
        if (b.timer >= RULES.swoopWarn) {
          b.state = 'peck';
          b.timer = 0;
          b.x = b.px;
          b.y = b.py;
          this.peck(b);
        }
      } else if (b.state === 'peck' && b.timer >= 0.7) {
        b.state = 'walk';
        b.next = span(RULES.swoopEvery, this.rng());
        b.tx = b.x;
        b.ty = b.y;
      }
    }
  }

  private peck(b: Bird): void {
    const w = this.player, r = RULES.peckR + this.girth * 0.5;
    let hit = false;
    if (w.safe <= 0 && w.curl <= 0) {
      for (const s of w.segs) if (dist2(s.x, s.y, b.px, b.py) < r * r) { hit = true; break; }
    }
    this.emit({ type: 'peck', x: b.px, y: b.py, hit });
    if (hit) this.stumble('bird', b.px, b.py);
    else {
      const h = w.segs[0];
      if (dist2(h.x, h.y, b.px, b.py) < RULES.nearR ** 2 + r * r) {
        this.nearMisses++;
        this.emit({ type: 'near', x: h.x, y: h.y });
        this.say('near', 2, 3);
      }
    }
  }

  // ── eating ─────────────────────────────────────────────────────
  private eat(dt: number): void {
    const w = this.player, h = w.segs[0], g = this.girth, reach = this.reach + g;
    const canEat = w.curl <= 0;
    for (let i = this.food.length - 1; i >= 0; i--) {
      const f = this.food[i];
      f.age += dt;
      const dx = h.x - f.x, dy = h.y - f.y, d = Math.hypot(dx, dy);
      f.pulled = false;
      if (canEat && d < reach && d > 0.01) {
        // the reach pulls food into the mouth (stronger toward the middle)
        const k = Math.min(d, RULES.pull * (0.35 + 0.65 * (1 - d / reach)) * dt);
        f.x += (dx / d) * k;
        f.y += (dy / d) * k;
        f.pulled = this.reach > RULES.reachBase + 4;
      }
      if (canEat && d < g + RULES.mouth + f.r) {
        this.food.splice(i, 1);
        this.ate(f);
        continue;
      }
      // rivals graze too
      for (const r of this.rivals) {
        if (r.away > 0 || r.curl > 0) continue;
        const rh = r.segs[0];
        if (dist2(rh.x, rh.y, f.x, f.y) < (girthOf(r.segs.length) + RULES.mouth + f.r) ** 2) {
          this.food.splice(i, 1);
          r.grow += RULES.food[f.kind].grow;
          if (f.kind === 'leaf' || f.kind === 'flower') this.spawn(f.kind);
          if (f.kind === 'rare') this.spawnRare();
          break;
        }
      }
    }
  }

  private ate(f: Food): void {
    const spec = RULES.food[f.kind];
    this.chain = this.t - this.lastEat <= RULES.chainSec ? this.chain + 1 : 1;
    this.lastEat = this.t;
    const mult = multOf(this.chain), pts = spec.pts * mult;
    this.score += pts;
    this.player.grow += spec.grow;
    if (f.pig >= 0 && (f.kind === 'flower' || f.kind === 'rare')) this.palette = addPigment(this.palette, f.pig);
    this.emit({ type: 'eat', kind: f.kind, x: f.x, y: f.y, pts, mult, chain: this.chain, pig: f.pig });
    if (f.kind === 'leaf' || f.kind === 'flower') this.spawn(f.kind);
    const g = this.garden;
    if (!this.sideDone && ((g.side === 'rare' && f.kind === 'rare') || (g.side === 'dew' && f.kind === 'dew') || (g.side === 'flowers' && f.kind === 'flower'))) this.sideStep();
    if (f.kind === 'rare') this.say('rare', 3, 4);
  }

  private sideStep(): void {
    this.sideCount++;
    if (this.sideCount >= this.sideNeed && !this.sideDone) {
      this.sideDone = true;
      this.emit({ type: 'side', goal: this.garden.side });
    }
  }

  // ── collisions ─────────────────────────────────────────────────
  private collide(): void {
    const w = this.player, h = w.segs[0], g = this.girth;
    const open = w.safe <= 0 && w.curl <= 0;
    // own body (Snake): only far segments
    if (open) {
      const r2 = (g * 1.15) ** 2;
      for (let i = RULES.selfSkip; i < w.segs.length; i++) {
        const s = w.segs[i];
        if (dist2(s.x, s.y, h.x, h.y) < r2) { this.stumble('self', s.x, s.y); return; }
      }
    }
    for (const r of this.rivals) {
      if (r.away > 0) continue;
      const rg = girthOf(r.segs.length), rh = r.segs[0];
      // heads meet: the shorter one curls
      if (open && r.curl <= 0 && r.safe <= 0 && dist2(rh.x, rh.y, h.x, h.y) < (g + rg) ** 2 * 0.8) {
        if (r.segs.length < this.len) this.curlRival(r);
        else { this.stumble('rival', rh.x, rh.y); return; }
        continue;
      }
      // the player's head into the rival's body
      if (open) {
        const r2 = (g * 0.8 + rg) ** 2;
        for (let i = 2; i < r.segs.length; i++) {
          const s = r.segs[i];
          if (dist2(s.x, s.y, h.x, h.y) < r2) { this.stumble('rival', s.x, s.y); return; }
        }
      }
      // the rival's head into the player's body: it curls
      if (r.curl <= 0 && r.safe <= 0) {
        const r2 = (rg * 0.8 + g) ** 2;
        for (let i = 1; i < w.segs.length; i++) {
          const s = w.segs[i];
          if (dist2(s.x, s.y, rh.x, rh.y) < r2) { this.curlRival(r); break; }
        }
      }
    }
    // a walking bird underfoot
    if (open) {
      for (const b of this.birds) {
        if (b.state !== 'walk' && b.state !== 'peck') continue;
        if (dist2(b.x, b.y, h.x, h.y) < (RULES.birdR + g) ** 2) { this.stumble('bird', b.x, b.y); return; }
      }
    }
    // the first rival near: teach
    for (const r of this.rivals) {
      if (r.away > 0) continue;
      const rh = r.segs[0];
      if (dist2(rh.x, rh.y, h.x, h.y) < 280 ** 2) { this.teach('rival', rh.x, rh.y); break; }
    }
  }

  /** The player bumped into something: it curls up, the tail's last segments fall as crumbs, it goes on. */
  private stumble(cause: 'self' | 'rival' | 'bird', x: number, y: number): void {
    const w = this.player;
    const lose = Math.min(Math.max(0, this.len - RULES.minLen), Math.max(RULES.stumbleMin, Math.round(this.len * RULES.stumbleShare)));
    for (let i = 0; i < lose; i++) {
      const s = w.segs.pop()!;
      this.spawn('crumb', { x: s.x + (this.rng() - 0.5) * 10, y: s.y + (this.rng() - 0.5) * 10 });
    }
    w.curl = RULES.curlSec;
    w.safe = RULES.safeSec + RULES.curlSec;
    w.dir = wrapA(Math.atan2(w.segs[0].y - y, w.segs[0].x - x) + (this.rng() - 0.5) * 0.6);
    w.want = w.dir;
    this.aimDir = null;
    this.stumbles++;
    this.chain = 0;
    this.stop = RULES.stopStumble;
    this.emit({ type: 'stumble', x, y, cause, lost: lose });
    this.say(cause === 'self' ? 'self' : 'stumble', 2, 3);
  }

  private curlRival(r: Worm): void {
    const n = Math.round(r.segs.length * RULES.rivalDrop);
    for (let i = 0; i < r.segs.length && i < n * 2; i += 2) {
      const s = r.segs[i];
      this.spawn('crumb', { x: s.x + (this.rng() - 0.5) * 8, y: s.y + (this.rng() - 0.5) * 8 });
    }
    const h = r.segs[0];
    r.curl = 0.8;
    r.away = RULES.rivalBack + 0.8;
    this.curls++;
    this.chain++;
    this.lastEat = this.t;
    const pts = RULES.rivalCurlPts * multOf(this.chain);
    this.score += pts;
    this.stop = RULES.stopCurl;
    this.emit({ type: 'curl', x: h.x, y: h.y, pts });
    this.say('curl', 2, 3);
    if (!this.sideDone && this.garden.side === 'curl') this.sideStep();
  }

  // ── the chrysalis ──────────────────────────────────────────────
  private beginSpin(): void {
    this.phase = 'spin';
    this.spinT = 0;
    this.player.sprinting = false;
    const stars = starsOf(this.stumbles, this.sideDone);
    this.stop = RULES.stopGoal;
    this.emit({ type: 'goal', stars, x: this.player.segs[0].x, y: this.player.segs[0].y });
    this.say('goal', 3, 5);
  }

  /** The caterpillar has spun: the chrysalis goes to the twig, the garden is scored, the next one begins. */
  private endSpin(): void {
    const stars = starsOf(this.stumbles, this.sideDone);
    const c = this.makeChrysalis(stars);
    this.twig.push(c);
    while (this.twig.length > RULES.twigMax) this.hatchOne(this.twig.shift()!, false, 0);
    finishGarden(this.p, this.gardenIndex, stars);
    this.gardensDone++;
    this.starsWon += stars;
    this.score += RULES.gardenPts * stars;
    this.emit({ type: 'spun', c });
    this.phase = 'play';
    this.newGarden(this.gardenIndex + 1, false);
  }

  private makeChrysalis(stars: number): Chrysalis {
    const sp = speciesById(this.player.sp);
    const pig = this.palette.slice();
    for (const k of sp.classic) if (pig.length < 3 && !pig.includes(k)) pig.unshift(k);
    return {
      id: this.nextId++, sp: sp.id, depth: Math.min(1, this.depth + stars * RULES.depthStar), stars, pig: pig.slice(-3),
      path: encodePath(this.path), len: this.len, egg: this.egg, age: 0, garden: this.gardenIndex,
    };
  }

  private recordPath(dt: number): void {
    this.pathT += dt;
    if (this.pathT < 0.3) return;
    this.pathT = 0;
    const h = this.player.segs[0];
    this.path.push({
      x: this.box.x0 + (h.x / RULES.worldW) * (this.box.x1 - this.box.x0), y: this.box.y0 + (h.y / RULES.worldH) * (this.box.y1 - this.box.y0),
      a: clamp((this.reach - RULES.reachBase) / RULES.reachExtra), silk: this.player.sprinting && this.freeSprint,
    });
    if (this.path.length > 600) this.path.splice(0, this.path.length - 600);
  }

  /** A chrysalis hatches: the butterfly goes to the atlas (its egg spent, its record, pyłek). */
  private hatchOne(c: Chrysalis, passed: boolean, slot: number): Hatched {
    const sp = speciesById(c.sp), depth = Math.max(RULES.depthFloor, c.depth);
    const radiant = passed && depth >= RULES.radiantDepth;
    const cls = sizeClass(c.stars, depth);
    const mm = wingspan(sp, cls, this.rng());
    const classic = sp.classic.every(k => c.pig.includes(k));
    const flags = (radiant ? F.RADIANT : 0) | (classic ? F.CLASSIC : 0) | (depth >= 0.7 ? F.DEEP : 0) | (c.stars >= 3 ? F.BOLD : 0);
    const daily = !!c.egg && c.egg.source === 'daily';
    const res = emerge(this.p, { sp: sp.id, mm, cls, flags, pig: c.pig, depth, path: c.path, daily, egg: c.egg }, this.o.day, this.rng);
    const b: Hatched = { sp, mm, cls, depth, radiant, isNew: res.isNew, aberration: res.aberration, classic, rec: res.rec, record: res.record };
    this.hatchedList.push(b);
    this.emit({ type: 'hatch', b, slot });
    this.say('hatch', 2, 5);
    return b;
  }

  // ── the blocks ─────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
      if (f.reliable) this.relSec += dt;
    }
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - RULES.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: last ? null : this.plan[this.blockIndex + 1] });
    }
    if ((last && this.blockT >= b.dur) || t >= this.plannedSec - RULES.finale) {
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
      this.pushesBegun++;
      b.blind = this.p.sessions >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.goodT = 0;
      this.say(b.blind ? 'blind' : 'push', 2, 12);
    } else if (b.kind === 'rest') {
      for (let k = 0; k < RULES.dews; k++) this.spawn('dew');
      this.goodT = 0;
      this.say('rest', 2, 12);
    } else this.say('warm', 1, 8);
    // dew evaporates after its siesta
    if (b.kind !== 'rest') this.food = this.food.filter(f => f.kind !== 'dew');
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    const s = Math.max(1, this.p.sessions);
    if (b.kind === 'warmup') return TIPS.warmup[0];
    if (b.kind === 'push') {
      if (b.blind) return TIPS.blind[(s + i) % TIPS.blind.length];
      if (first && this.pushesBase === 0) return TIPS.firstPush;
      return TIPS.push[(s - 1 + i) % TIPS.push.length];
    }
    if (first && s === 1) return TIPS.firstRest;
    return TIPS.rest[(s - 1 + i) % TIPS.rest.length];
  }

  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null;
    if (b.kind !== 'warmup') {
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push') {
        if (verdict !== null) { this.counts.pushJudged++; if (verdict) this.counts.pushOk++; }
        if (b.blind) {
          this.trace.unveil(this.t);
          this.counts.blindN++;
          if (verdict) {
            this.counts.blindOk++;
            this.feast();
          }
        }
      } else {
        if (verdict !== null) { this.counts.restJudged++; if (verdict) this.counts.restOk++; }
        // the twig's chrysalises hatch at the siesta's end
        const ready = this.twig.splice(0, this.twig.length);
        ready.forEach((c, i) => this.hatchOne(c, verdict === true, i));
      }
    }
    this.emit({ type: 'blockEnd', block: b, verdict });
  }

  /** A blind push block that passed: what the hidden appetite gathered falls around the head at once. */
  private feast(): void {
    const h = this.player.segs[0], n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, r = 70 + (i % 2) * 30;
      const f = this.spawn(i % 3 === 0 ? 'flower' : 'leaf', {
        x: clamp(h.x + Math.cos(a) * r, 60, RULES.worldW - 60), y: clamp(h.y + Math.sin(a) * r, 60, RULES.worldH - 60),
      });
      if (f.kind === 'flower') f.pig = Math.floor(this.rng() * 5);
    }
    this.counts.feasts++;
    this.emit({ type: 'feast', x: h.x, y: h.y, n });
  }

  // ── the end ────────────────────────────────────────────────────
  private beginFinale(): void {
    if (this.phase === 'finale' || this.phase === 'done') return;
    if (this.phase === 'spin') this.endSpin();
    this.phase = 'finale';
    this.finaleT = 0;
    this.card = null;
    this.release();
    this.player.sprinting = false;
    // a caterpillar most of the way to its goal spins too
    if (this.len >= this.garden.len * RULES.lateShare && this.len > RULES.startLen) {
      const stars = Math.max(1, starsOf(this.stumbles, this.sideDone) - 1);
      this.twig.push(this.makeChrysalis(stars));
    }
    this.emit({ type: 'finale' });
    this.say('end', 3, 6);
    const ready = this.twig.splice(0, this.twig.length);
    ready.forEach((c, i) => this.hatchOne(c, this.counts.restOk > 0, i));
  }

  private runFinale(dt: number): void {
    this.finaleT += dt;
    if (this.finaleT >= RULES.finale && this.phase === 'finale') {
      this.phase = 'done';
      this.emit({ type: 'done' });
    }
  }

  canStop(): boolean {
    return this.phase === 'done' || (this.phase === 'finale' && this.finaleT >= Math.min(RULES.finale, RULES.settle)) || this.t >= this.plannedSec + RULES.settle;
  }

  /** The session ends early: settle now (the twig hatches; a long enough caterpillar spins). */
  finish(): void {
    if (this.settled) return;
    if (this.started && this.phase !== 'finale' && this.phase !== 'done') this.beginFinale();
    this.phase = 'done';
    this.settled = true;
  }

  // ── the HUD's numbers ──────────────────────────────────────────
  headline(): Headline {
    const m = this.mult;
    const sub = t('hud.sub', { len: this.started ? this.len : RULES.startLen, goal: this.garden.len }) + (m > 1 ? ` · ×${m}` : '');
    return { value: this.score, sub };
  }

  // ── the tutorial ───────────────────────────────────────────────
  private tutorial(): void {
    const h = this.player.segs[0];
    if (this.firstEver) {
      if (this.wt > 0.6) this.teach('steer', h.x, h.y);
      if (this.wt > 3.5) {
        let near: Food | null = null, nd = 240 ** 2;
        for (const f of this.food) {
          if (f.kind !== 'flower') continue;
          const d = dist2(f.x, f.y, h.x, h.y);
          if (d < nd) { nd = d; near = f; }
        }
        if (near) this.teach('eat', near.x, near.y);
      }
      if (this.wt > 9) this.teach('sprint', h.x, h.y);
    }
    const b = this.block;
    if (b.kind === 'push' && !b.blind && this.blockT > RULES.bannerSec + 0.5) this.teach('reach', h.x, h.y);
    if (b.kind === 'rest' && this.blockT > RULES.bannerSec + 0.5) this.teach('rest', -1, -1);
  }

  // ── the result ─────────────────────────────────────────────────
  result(): ArcadeOutcome {
    const score = Math.round(this.score), c = this.counts;
    this.p.bestSession = Math.max(this.p.bestSession, score);
    this.p.bestLen = Math.max(this.p.bestLen, this.bestLenSession);
    if (this.firstEver && (this.blockIndex > 0 || this.phase === 'done')) this.p.tut = true;
    const contrast = this.contrast.contrast;
    const stats: [string, string][] = [
      [t('stat.gardens'), String(this.gardensDone)],
      [t('stat.stars'), `${this.starsWon} ★`],
      [t('stat.longest'), `${this.bestLenSession} cm`],
      [t('stat.butterflies'), String(this.hatchedList.length)],
      [t('stat.reach'), `${c.pushOk}/${c.pushJudged}`],
      [t('stat.colours'), `${c.restOk}/${c.restJudged}`],
      [t('stat.contrast'), contrast === null ? '—' : t('pct', { v: fmtSigned(contrast, 1) })],
    ];
    if (c.blindN) stats.push([t('stat.blind'), `${c.blindOk}/${c.blindN}`]);
    return {
      score, unit: t('unit'), record: this.bestBefore !== null && score > this.bestBefore, stats, highlights: this.highlights(score),
      verse: this.closingVerse(),
    };
  }

  /**
   * The closing passage: the full atlas is all things made new; a new species, the earth full of His
   * creatures; a deep chrysalis, a season for everything; the lilies and the birds fit any day.
   */
  private closingVerse(): PassageId {
    const fresh = this.hatchedList.some(b => b.isNew);
    if (fresh && SPECIES.every(s => (this.p.atlas[s.id]?.n ?? 0) > 0)) return 'rev21.5';
    const fit: PassageId[] = [];
    if (fresh) fit.push('psa104.24');
    if (this.counts.restOk > 0 && this.hatchedList.some(b => b.depth >= 0.7)) fit.push('ecc3.1');
    fit.push('mat6.28-29', 'mat6.26');
    return inTurn(fit, this.p.sessions);
  }

  /** At most four lines: new species and forms, radiant wings, the gardens and stars, the near-miss tally, Hieronim's last word. */
  private highlights(score: number): string[] {
    const lines: string[] = [];
    const done = this.hatchedList;
    const fresh = [...new Set(done.filter(b => b.isNew).map(b => b.aberration ? t('hl.withForm', { name: b.sp.name, form: ABERRATION_FORM[b.aberration] }) : b.sp.name))];
    if (fresh.length) lines.push(capital(t(fresh.length > 1 ? 'hl.newN' : 'hl.new1', { list: fresh.join(', ') })));
    const radiant = [...new Set(done.filter(b => b.radiant).map(b => b.sp.name))];
    if (radiant.length) lines.push(capital(t('hl.radiant', { list: radiant.join(', ') })));
    if (this.gardensDone) lines.push(t('hl.gardens', { n: this.gardensDone, stars: this.starsWon, next: gardenAt(this.p.garden).name }));
    if (this.bestBefore !== null && score <= this.bestBefore && this.bestBefore - score <= Math.max(40, this.bestBefore * 0.3)) {
      lines.push(t('hl.near', { n: this.bestBefore - score + 1 }));
    } else if (this.bestLenSession >= this.p.bestLen && this.bestLenSession > RULES.startLen + 4) {
      lines.push(t('hl.longest', { n: this.bestLenSession }));
    }
    const out = lines.slice(0, 3);
    out.push(this.p.sessions <= 1 ? t('hl.tip') : t(`hl.close.${1 + (this.p.sessions % 3)}` as 'hl.close.1'));
    return out;
  }

  /** For the size of a butterfly in words. */
  static sizeName(cls: number): string { return SIZE_CLASSES[Math.max(0, Math.min(3, cls))]; }
}
