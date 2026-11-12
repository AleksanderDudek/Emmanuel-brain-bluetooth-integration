/**
 * Odporność's session, without the canvas (DESIGN.md §13.9): the real stages of an immune response as the
 * levels of a run — Alarm, Rekrutacja, Łowy, Przeciwciała, Limfocyty T, Gojenie — in a slice of skin (or,
 * for the T cells, the lining of the nose), the cells and the pathogens, the band's alarm and calm, the
 * respiratory burst and the NETs, the blocks and their verdicts, the cards, the meta.  Pure logic: the view
 * reads its fields, the input comes in through `tap`, `lead`, `sweep`, `stroke`, `key`; what happened goes
 * out through `take()`.
 *
 * The band drives slow quantities only (§2): the alarm (how far the cytokine signal reaches, how many
 * neutrophils answer, how fast they engulf, how far interferon protects in the T-cell stage) eases toward the
 * focus level in a sighted push block after its lead-in; a held focus fills the respiratory burst; calm in a
 * rest block heals.  Touch drives everything under two seconds.  A bad signal freezes the band's part at the
 * base: never a loss.
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  CLOSINGS, LINES, PATHOGEN, ROOT, STAGES, TIPS, loopSpec, pathogenName, placeName, stageName, unlockName,
  type Coach, type CoachAt, type FactId, type PathogenId, type StageId, type UnlockId,
} from './content';
import { t, unit, pathogensText } from './i18n';
import {
  addFact, appetiteOf, bestOf, checkUnlocks, has, lenKey, memoryOf, netMaxOf, netROf, remember, setStars, starKey, swarmCapOf,
  type OdpProgress,
} from './meta';
import { RULES, loopK, span } from './rules';
import { Talk } from './talk';

// ── types ────────────────────────────────────────────────────────────────────────────
export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

export type CellKind = 'neut' | 'mac' | 'tcell' | 'nk' | 'dc' | 'mast';
export type CellState = 'roam' | 'spent' | 'body' | 'dock' | 'rest' | 'trip' | 'gone';

/** a phagosome: a bacterium being digested inside a cell */
export interface Phago { kind: PathogenId; t: number; dur: number; tagged: boolean }

export interface Cell {
  id: number;
  kind: CellKind;
  x: number; y: number; vx: number; vy: number;
  r: number;
  state: CellState;
  /** seconds in the state */
  st: number;
  /** bacteria it can still engulf (Infinity for a macrophage) */
  appetite: number;
  gut: Phago[];
  /** a bacterium being wrapped by pseudopods */
  grab: { bug: Bug; t: number; dur: number } | null;
  /** what it goes for: a bacterium's id, an epithelial cell's index, a body's id; −1 none */
  target: number;
  seed: number;
  eaten: number;
  kills: number;
  /** cast its NET (its DNA): no lobed nucleus any more, it crawls on (Yipp 2012) */
  anucleate: boolean;
  /** a slippery capsule bounced it off: don't try that one again for a moment */
  slipT: number;
  slipId: number;
  /** a macrophage's repair mode (0 alarm → 1 repair) */
  m2: number;
  /** the T cell's docking target and progress */
  dockT: number;
}

export interface Bug {
  id: number;
  kind: PathogenId;
  x: number; y: number; vx: number; vy: number;
  /** heading (rods and swimmers) */
  a: number;
  /** seconds to its next division */
  div: number;
  /** antibody / complement coverage 0..1 (1 = tagged, glowing gold) */
  tag: number;
  c3: boolean;
  capsule: boolean;
  /** seconds left caught in a NET (0 = free) */
  netted: number;
  grabbed: boolean;
  /** a straggler hidden in a crevice (the healing stage) until the alarm or a cell finds it */
  hidden: boolean;
  /** a swimmer's run / tumble timer */
  run: number;
  /** seconds since it appeared (the view's pop-in) */
  age: number;
}

export type FlowState = 'flow' | 'roll' | 'arrest' | 'squeeze';
export interface Flow { id: number; x: number; y: number; state: FlowState; t: number; until: number; jx: number; tapped: boolean; seed: number }
export interface Pad { x: number; lit: number; hits: number }
export type RingKind = 'alarm' | 'mast' | 'ifn' | 'growth' | 'gulp';
export interface Ring { x: number; y: number; r: number; max: number; t: number; kind: RingKind; wall: boolean }
export interface Ab { x: number; y: number; vx: number; vy: number; target: number; t: number }
export interface Net { x: number; y: number; r: number; life: number; max: number }
export type EpiState = 'ok' | 'infected' | 'hidden' | 'docked' | 'fold' | 'gone';
export interface Epi { x: number; state: EpiState; load: number; t: number; protect: number; ifnT: number }
export interface Virion { x: number; y: number; vx: number; vy: number; life: number; d: number }
export interface Fibre { x1: number; y1: number; x2: number; y2: number; t: number }
export type CardKind = 'open' | 'back' | 'loop' | 'stage';
export interface Card {
  kind: CardKind; t: number; dur: number; stage: StageId; idx: number;
  /** the facts found in the stage before (the card shows the last), a memory answered at once */
  fact: FactId | null; memory: PathogenId | null;
}
export type Scene = 'skin' | 'nose';

export type SimEvent =
  | { type: 'gulp'; x: number; y: number; kind: PathogenId; by: CellKind; tagged: boolean; combo: number }
  | { type: 'digest'; x: number; y: number }
  | { type: 'slip'; x: number; y: number }
  | { type: 'divide'; x: number; y: number }
  | { type: 'spawn'; x: number; y: number }
  | { type: 'ring'; x: number; y: number; max: number; kind: RingKind }
  | { type: 'pad'; x: number; lit: number }
  | { type: 'roll'; x: number }
  | { type: 'arrest'; x: number; tapped: boolean }
  | { type: 'squeeze'; x: number }
  | { type: 'join'; x: number; y: number; n: number }
  | { type: 'spent'; x: number; y: number }
  | { type: 'body'; x: number; y: number }
  | { type: 'tidy'; x: number; y: number }
  | { type: 'burstReady' } | { type: 'burst' } | { type: 'burstEnd' } | { type: 'burstNo' }
  | { type: 'netReady'; n: number } | { type: 'net'; x: number; y: number; r: number } | { type: 'netNo' }
  | { type: 'tag'; x: number; y: number; by: 'ab' | 'c3' }
  | { type: 'dc'; phase: 'grab' | 'leave' | 'node' | 'back'; x: number; y: number }
  | { type: 'abWave' }
  | { type: 'infect'; i: number } | { type: 'virions'; x: number; y: number; n: number } | { type: 'neutralise'; x: number; y: number }
  | { type: 'dock'; x: number; y: number } | { type: 'fold'; x: number; y: number; n: number; by: CellKind } | { type: 'noFlags'; x: number; y: number }
  | { type: 'collagen'; f: Fibre } | { type: 'closed' }
  | { type: 'stage'; stage: StageId; idx: number } | { type: 'stageDone'; stage: StageId; stars: number; grace: boolean }
  | { type: 'loop'; loop: number }
  | { type: 'fact'; id: FactId } | { type: 'unlock'; id: UnlockId } | { type: 'memory'; id: PathogenId; level: number }
  | { type: 'combo'; n: number }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; kind: BlockKind; verdict: boolean | null }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'reveal'; share: number }
  | { type: 'coach'; what: Coach; at: CoachAt }
  | { type: 'seek'; x: number; y: number } | { type: 'target'; x: number; y: number }
  | { type: 'card'; kind: CardKind } | { type: 'cardClosed' }
  | { type: 'finale' } | { type: 'end' };

const NO_EVENTS: readonly SimEvent[] = [];
const TAU = Math.PI * 2;
const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

// ── pure rules ───────────────────────────────────────────────────────────────────────
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/** The last stretch without a block: 12 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/**
 * The session's blocks: a first-ever session opens with the warm-up (28 s in 5 and 10 min, 20 s in 3, 6 s in
 * a 40 s test); then Alarm / Gojenie pairs (26 ± 4 s and 22 ± 3 s, scaled to end on time, jittered only when
 * there is room) ending with a rest, leaving the last stretch free.  No block under 12 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const fin = finaleFor(plannedSec);
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * R.minBlock, plannedSec - fin);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(2 * R.minBlock, left - warm);
      return [b('warmup', warm), b('push', rest / 2), b('rest', rest / 2)];
    }
    const rest = Math.max(R.minBlock, Math.min(14, left / 2));
    return [b('push', left - rest), b('rest', rest)];
  }
  const plan: Block[] = [];
  let left = plannedSec - fin;
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

/** "★★☆" */
export const starText = (n: number): string => '★'.repeat(clamp(Math.round(n), 0, 3)) + '☆'.repeat(3 - clamp(Math.round(n), 0, 3));

/** A stage's stars from its time against its cap (the body finishing it gives none). */
export function starsFor(elapsed: number, cap: number, grace: boolean): number {
  if (grace) return 0;
  const k = elapsed / Math.max(1, cap);
  return k <= RULES.stars[0] ? 3 : k <= RULES.stars[1] ? 2 : 1;
}

/** A stage's cap (s): its soft time limit, after which the body finishes the job. */
export function stageCap(s: StageId): number {
  switch (s) {
    case 'alarm': return RULES.alarm.cap;
    case 'recruit': return RULES.recruit.cap;
    case 'hunt': return RULES.hunt.cap;
    case 'antibodies': return RULES.antibodies.cap;
    case 'tcells': return RULES.tcells.cap;
    default: return RULES.heal.cap;
  }
}

/** The wave a battle stage brings in a loop (bacteria in all). */
export function waveOf(s: StageId, loop: number): number {
  const k = loopK(loop);
  if (s === 'hunt') return Math.round(RULES.hunt.wave * k);
  if (s === 'antibodies') return Math.round(RULES.antibodies.wave * k);
  if (s === 'alarm') return RULES.alarm.live;
  return 0;
}

/** The recruits the Rekrutacja stage asks for in a loop. */
export const recruitNeed = (loop: number): number => RULES.recruit.need + RULES.recruit.needLoop * Math.min(4, Math.max(0, Math.floor(loop) - 1));

/** The share of bacteria in a capsule in the antibodies stage. */
export const capsuleShare = (loop: number): number => clamp(RULES.antibodies.capsule + RULES.antibodies.capsuleLoop * (Math.max(1, loop) - 1), 0, 0.7);

// ── the session ──────────────────────────────────────────────────────────────────────
export interface SimInit {
  progress: OdpProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
}

export class OdpSim {
  readonly p: OdpProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  readonly talk: Talk;
  private readonly leadSec: number;
  private readonly restLead: number;
  private readonly holdNeed: number;
  private events: SimEvent[] = [];
  private nextId = 1;

  started = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  session = 1;
  readonly firstEver: boolean;
  private readonly bestBefore: number | null;
  private settled = false;

  // the blocks
  plan: Block[] = [];
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  tip = '';
  private relSec = 0;
  private pushesBegun = 0;
  private readonly pushesBase: number;
  private finaleSec: number;

  // the band
  reliable = false;
  /** the alarm 0..1 (0.5 = the threshold), what the push block's focus drives */
  alarm = 0;
  /** calm 0..1 in a rest block (what heals) */
  calm = 0;
  /** the respiratory burst's charge 0..1, ready, running */
  charge = 0;
  burstReady = false;
  private readyT = 0;
  bursting = 0;
  nets = 0;
  private goodT = 0;
  private goodSaid = false;
  /** a rest's breathing guide: 0..1 of the breath (in, then out) and whether it is the in-breath; null outside a rest */
  get breath(): { k: number; inhale: boolean } | null {
    if (!this.restBlock) return null;
    const R = RULES, cyc = R.breathIn + R.breathOut;
    const x = ((this.blockT % cyc) + cyc) % cyc;
    return x < R.breathIn ? { k: x / R.breathIn, inhale: true } : { k: (x - R.breathIn) / R.breathOut, inhale: false };
  }
  /** the share of a blind block's window above the threshold (shown at its end) */
  blindShare = -1;

  // the world
  W: number = RULES.defaultW;
  scene: Scene = 'skin';
  stage: StageId = 'alarm';
  stageIdx = 0;
  stageT = 0;
  /** after the goal: a short celebration before the next stage */
  outro = 0;
  private outroGrace = false;
  card: Card | null = null;
  cells: Cell[] = [];
  bugs: Bug[] = [];
  flow: Flow[] = [];
  pads: Pad[] = [];
  rings: Ring[] = [];
  abs: Ab[] = [];
  netsUp: Net[] = [];
  epi: Epi[] = [];
  virions: Virion[] = [];
  fibres: Fibre[] = [];
  /** the wound's centre on the skin (x) and the splinter in it (until the hunt) */
  woundX = 0;
  splinter = true;
  /** the wound's closure 0..1 (Gojenie), the battle's rests before it, the inflammation 0..1 */
  closure = 0;
  prep = 0;
  inflam = 0;
  /** Neo keeps quiet this long (s): the runner's coach mark is speaking */
  hushT = 0;
  /** a hit-stop: the world holds still this long (s) on a big moment; the blocks and the band go on */
  private freezeT = 0;
  /** what the finger leads: a point in the world, or null */
  leadPt: { x: number; y: number } | null = null;
  private leadT = 0;
  /** where a tap sent the swarm (the view marks it) */
  mark: { x: number; y: number; t: number } | null = null;
  /** the stage's counts */
  spawned = 0;
  recruits = 0;
  private ringT = 0;
  private mastT = 0;
  private c3T = 0;
  private abT = 0;
  private flowAcc = 0;
  private strokeT = 0;
  /** the antibodies stage: the dendritic cell's trip, the rain of antibodies */
  dcT = 0;
  abOn = false;
  /** the combo: engulfs in a row (each within comboGap s) */
  combo = 0;
  private comboT = 99;
  private comboNetAt = 0;

  // the session's numbers
  score = 0;
  bacteria = 0;
  virusesStopped = 0;
  bestCombo = 0;
  recruitsAll = 0;
  burstsNow = 0;
  netsNow = 0;
  healedNow = 0;
  stagesNow: { stage: StageId; stars: number }[] = [];
  loopsNow: number[] = [];
  memoryNow: PathogenId[] = [];
  factsNow: FactId[] = [];
  unlocksNow: UnlockId[] = [];
  private factsStage: FactId[] = [];
  private memoryStage: PathogenId | null = null;
  passedRests = 0;

  constructor(init: SimInit) {
    this.p = init.progress;
    this.plannedSec = Math.max(10, init.plannedSec);
    this.rng = init.rng;
    this.judge = RoundJudge.from(init.tuning);
    this.leadSec = init.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
    this.restLead = init.eeg ? RULES.restLead.eeg : RULES.restLead.fnirs;
    this.holdNeed = init.eeg ? RULES.holdNeed.eeg : RULES.holdNeed.fnirs;
    this.firstEver = this.p.sessions === 0;
    this.bestBefore = bestOf(this.p);
    this.pushesBase = this.p.pushes;
    this.finaleSec = finaleFor(this.plannedSec);
    this.talk = new Talk(LINES, this.rng);
  }

  // ── reading ──────────────────────────────────────────────────────────────────────
  get block(): Block { return this.plan[this.blockIndex] ?? { kind: 'warmup', dur: 1, blind: false }; }
  get next(): Block | null { return this.phase === 'play' ? this.plan[this.blockIndex + 1] ?? null : null; }
  get pushBlock(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.leadSec; }
  get leadIn(): number { return this.leadSec; }
  get loop(): number { return this.p.loop; }
  get bugKind(): PathogenId { return loopSpec(this.p.loop).bug; }
  get virusKind(): PathogenId { return loopSpec(this.p.loop).virus; }
  /** the cytokine signal's reach (units) now */
  get reach(): number { return RULES.reach * (1 + RULES.reachK * this.alarm); }
  /** the reach at the threshold (alarm 0.5): the gold ring drawn in the world */
  get reachAt(): number { return RULES.reach * (1 + RULES.reachK * 0.5); }
  get eatK(): number { return 1 + RULES.eatK * this.alarm; }
  get swarm(): Cell[] { return this.cells.filter(c => c.kind === 'neut' && c.state === 'roam'); }
  /** the swarm's centre this frame (cellsStep) */
  private swarmC = { x: 0, y: 50, n: 0 };
  get makro(): Cell | undefined { return this.cells.find(c => c.kind === 'mac'); }
  /** the bacteria in play (not hidden, not being swallowed) */
  get live(): Bug[] { return this.bugs.filter(b => !b.hidden && !b.grabbed); }
  /** a burst button worth showing (the neutrophils' stages) */
  get burstShown(): boolean { return this.stage === 'recruit' || this.stage === 'hunt' || this.stage === 'antibodies'; }
  get netShown(): boolean { return (this.stage === 'hunt' || this.stage === 'antibodies') && netMaxOf(this.p) > 0; }
  get litPads(): number { return this.pads.filter(p => p.lit >= 1).length; }
  get padsNeed(): number { return Math.min(RULES.alarm.pads, this.pads.length); }
  get infected(): Epi[] { return this.epi.filter(e => e.state === 'infected' || e.state === 'hidden' || e.state === 'docked' || e.state === 'fold'); }
  /** the stage's goal as numbers (the view's pill): done so far and all, or what is left */
  goal(): { n: number; all: number; left: boolean } {
    switch (this.stage) {
      case 'alarm': return { n: this.litPads, all: this.padsNeed, left: false };
      case 'recruit': return { n: Math.min(this.recruits, recruitNeed(this.p.loop)), all: recruitNeed(this.p.loop), left: false };
      case 'hunt':
      case 'antibodies': return { n: this.live.length + Math.max(0, waveOf(this.stage, this.p.loop) - this.spawned), all: waveOf(this.stage, this.p.loop), left: true };
      case 'tcells': return { n: this.infected.length, all: 0, left: true };
      default: return { n: Math.round(this.closure * 100), all: 100, left: false };
    }
  }

  // ── the session ──────────────────────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.session = this.p.sessions + 1;
    this.plan = planBlocks(this.plannedSec, this.firstEver, this.rng);
    if (this.plannedSec - this.finaleSec < this.plan.reduce((s, b) => s + b.dur, 0) - 0.01) this.finaleSec = Math.max(0, this.plannedSec - this.plan.reduce((s, b) => s + b.dur, 0));
    this.woundX = this.W * 0.58;
    this.setupStage(true);
    if (this.firstEver) {
      this.showCard('open');
      this.fact('metchnikoff');
    } else if (this.p.stage > 0) this.showCard('back');
    else this.showCard('loop');
    this.startBlock(0);
    this.talk.ask('hello', 3, 14);
  }

  /** The world's width in units (the view's shape); things keep their place across it. */
  setWorld(w: number): void {
    const W = clamp(w, RULES.minW, RULES.maxW);
    if (Math.abs(W - this.W) < 0.01) return;
    const k = W / this.W;
    this.W = W;
    for (const c of this.cells) c.x *= k;
    for (const b of this.bugs) b.x *= k;
    for (const f of this.flow) { f.x *= k; f.jx *= k; }
    for (const p of this.pads) p.x *= k;
    for (const r of this.rings) r.x *= k;
    for (const a of this.abs) a.x *= k;
    for (const n of this.netsUp) n.x *= k;
    for (const v of this.virions) v.x *= k;
    for (const f of this.fibres) { f.x1 *= k; f.x2 *= k; }
    this.woundX *= k;
    if (this.epi.length) this.layEpithelium(true);
    if (this.mark) this.mark.x *= k;
    if (this.leadPt) this.leadPt.x *= k;
  }

  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || this.phase === 'done') return;
    dt = clamp(dt, 0, 0.05);
    this.t = t;
    this.reliable = f.reliable;
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.end();
    if ((this.phase as string) === 'done') return;
    this.band(dt, f);
    if (this.card) {
      this.card.t += dt;
      if (this.card.t >= this.card.dur) this.closeCard();
    } else if (this.freezeT > 0) this.freezeT -= dt;
    else this.world(dt);
    const banner = this.phase === 'play' && this.block.kind !== 'warmup' && this.blockT < RULES.bannerSec;
    this.hushT = Math.max(0, this.hushT - dt);
    this.talk.update(dt, t, !!this.card || banner || this.hushT > 0 || (this.phase === 'play' && this.telegraphed));
  }

  /** The band's quantities: the alarm, calm, the burst's charge, Neo's cheer. */
  private band(dt: number, f: FocusFrame): void {
    const R = RULES;
    const sighted = this.sighted && f.reliable;
    this.alarm = approach(this.alarm, sighted ? clamp(f.level) : 0, dt, R.alarmTau);
    const calmOn = this.restBlock && f.reliable && this.blockT >= this.restLead;
    this.calm = approach(this.calm, calmOn ? clamp(f.calm) : 0, dt, 1.2);
    if (this.pushBlock && !this.blind && !this.card) {
      if (sighted && f.focused && f.hold >= this.holdNeed) this.charge += R.holdRate * dt;
      this.charge += R.baseCharge * dt;
    }
    this.charge = clamp(this.charge);
    if (this.charge >= 1 && !this.burstReady && this.bursting <= 0 && this.burstShown) {
      this.burstReady = true;
      this.readyT = 0;
      this.emit({ type: 'burstReady' });
      this.talk.ask('burstReady', 3, 6);
      this.coach('burst', { kind: 'burst' });
    }
    if (this.burstReady && !this.card) {
      this.readyT += dt;
      if (this.readyT >= R.burstAuto && this.burstShown) this.burst();
    }
    if (this.bursting > 0) {
      this.bursting -= dt;
      if (this.bursting <= 0) {
        this.bursting = 0;
        this.emit({ type: 'burstEnd' });
      }
    }
    // Neo cheers an alarm held above the threshold for a while (once a block)
    if (sighted && this.alarm >= 0.5) this.goodT += dt;
    else this.goodT = Math.max(0, this.goodT - dt * 0.5);
    if (!this.goodSaid && this.goodT >= R.goodSec) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 5);
    }
  }

  // ── the blocks ───────────────────────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
      if (f.reliable) this.relSec += dt;
    }
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) {
      this.coach('rest', { kind: 'free' });
      if (this.scene === 'skin' && this.stage !== 'alarm') this.coach('collagen', { kind: 'world', x: this.woundX, y: 8 });
      if (this.stage !== 'tcells' && this.cells.some(c => c.kind === 'neut' && (c.state === 'body' || c.state === 'spent'))) this.coach('tidy', this.bodyAt());
    }
    if (b.kind === 'push' && !b.blind && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('rings', this.ringAt());
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: last ? null : this.plan[this.blockIndex + 1] });
    }
    if ((last && this.blockT >= b.dur) || t >= this.plannedSec - this.finaleSec) {
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
      this.p.pushes = this.pushesBase + this.pushesBegun;
      b.blind = this.session >= RULES.blindFrom && !first && this.p.pushes % RULES.blindEvery === 0;
      this.goodT = 0;
      this.goodSaid = false;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
      if (b.blind) this.coach('blind', { kind: 'free' });
    } else if (b.kind === 'rest') {
      this.talk.ask('rest', 2, 12);
    }
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup[0];
    if (b.kind === 'push') {
      if (b.blind) return TIPS.blind[(this.session + i) % TIPS.blind.length];
      if (first && this.pushesBase === 0) return TIPS.firstPush;
      return TIPS.push[(this.session - 1 + i) % TIPS.push.length];
    }
    if (first && this.session === 1) return TIPS.firstRest;
    return TIPS.rest[(this.session - 1 + i) % TIPS.rest.length];
  }

  /** A block's end: its verdict once, from its last 15 s; a blind block reveals its share and pays burst charge. */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null;
    if (b.kind !== 'warmup') {
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push' && b.blind) {
        const s = this.judge.measured > 0 ? this.judge.share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        this.charge = clamp(this.charge + s * RULES.blindCharge);
        this.emit({ type: 'reveal', share: s });
      }
      if (b.kind === 'rest' && verdict) this.passedRests++;
    }
    this.emit({ type: 'blockEnd', kind: b.kind, verdict });
  }

  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.tip = TIPS.warmup[0];
    this.emit({ type: 'finale' });
    this.talk.ask('end', 2, 10);
  }

  private end(): void {
    if (this.phase === 'done') return;
    this.settle();
    this.phase = 'done';
    this.emit({ type: 'end' });
  }

  /** The session ends before its time ("Zakończ i zapisz"): settle now. */
  finish(): void {
    if (!this.started) return;
    this.end();
  }

  /** The counters reach the progress once. */
  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    this.p.sessions = this.session;
    this.p.lastLen = Math.round(this.plannedSec);
    this.p.bestCombo = Math.max(this.p.bestCombo, this.bestCombo);
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  // ── the stages ───────────────────────────────────────────────────────────────────
  /** Lay out the stage the run is at (from the progress): its scene, its cells and its pathogens. */
  private setupStage(first = false): void {
    const s = STAGES[this.p.stage] ?? 'alarm';
    this.stage = s;
    this.stageIdx = this.p.stage;
    this.stageT = 0;
    this.outro = 0;
    this.spawned = 0;
    this.recruits = 0;
    this.ringT = 0.4;
    this.mastT = 1.2;
    this.c3T = 2;
    this.abT = 0;
    this.flowAcc = 0;
    this.abOn = false;
    this.dcT = 0;
    this.abs = [];
    this.virions = [];
    this.netsUp = [];
    this.factsStage = [];
    this.memoryStage = null;
    this.leadPt = null;
    this.mark = null;
    const W = this.W;
    // the splinter is in until someone pulls it out at the start of the hunt
    this.splinter = s === 'alarm' || s === 'recruit';
    if (s === 'alarm' || first) this.layPads();
    // after the alarm the vessel's wall stays lit where the signal reached it (at least what the alarm asked)
    if (s !== 'alarm') for (const p of this.pads) if (p.lit < 1 && this.litPads < this.padsNeed) { p.lit = 1; p.hits = RULES.alarm.padHits; }
    if (s === 'alarm') {
      // a fresh wound: the splinter in, the macrophage on watch, the first bacteria
      this.scene = 'skin';
      this.splinter = true;
      this.closure = 0;
      this.prep = 0;
      this.inflam = 0.15;
      this.fibres = [];
      this.cells = [];
      this.bugs = [];
      this.flow = [];
      this.epi = [];
      this.woundX = W * 0.58;
      this.addCell('mac', W * 0.38, 50);
      if (has(this.p, 'tuczne')) {
        this.addCell('mast', W * 0.18, 74);
        this.addCell('mast', W * 0.84, 70);
      }
      for (let i = 0; i < RULES.alarm.start; i++) this.spawnBug(this.bugKind, true);
      this.talk.ask('alarm', 2, 10);
      this.fact('tlr');
      this.coach('drag', { kind: 'world', x: W * 0.38, y: 50 });
    } else if (s === 'recruit') {
      this.scene = 'skin';
      if (has(this.p, 'szpik')) for (let i = 0; i < 3; i++) this.addFlow(W * (0.2 + 0.25 * i), 'roll');
      this.ensureMakro();
      this.talk.ask('recruit', 2, 10);
      this.coach('roll', { kind: 'world', x: W * 0.5, y: (RULES.lumenTop + RULES.lumenBot) / 2 });
    } else if (s === 'hunt') {
      this.scene = 'skin';
      this.splinter = false;
      this.ensureMakro();
      this.ensureSwarm(recruitNeed(this.p.loop));
      if (has(this.p, 'monocyty') && this.cells.filter(c => c.kind === 'mac').length < 2) this.addCell('mac', W * 0.8, 60);
      for (let i = 0; i < RULES.hunt.burst; i++) this.spawnBug(this.bugKind, true);
      this.nets = Math.max(this.nets, Math.min(netMaxOf(this.p), 1));
      this.talk.ask('hunt', 3, 10);
      this.fact('pelzanie');
      this.coach('swarm', this.swarmAt());
      if (this.nets > 0) this.coach('net', { kind: 'net' });
      const m = memoryOf(this.p, this.bugKind);
      if (m > 0) this.remembered(this.bugKind);
    } else if (s === 'antibodies') {
      this.scene = 'skin';
      this.ensureMakro();
      this.ensureSwarm(recruitNeed(this.p.loop));
      const m = memoryOf(this.p, this.bugKind);
      this.dcT = m > 0 ? RULES.antibodies.trip - RULES.antibodies.memoryTrip : 0;
      const live = this.live;
      const c = live.length ? { x: live.reduce((a, b) => a + b.x, 0) / live.length, y: live.reduce((a, b) => a + b.y, 0) / live.length } : { x: W * 0.5, y: 40 };
      if (m === 0) this.addCell('dc', clamp(c.x - 14, 8, W - 8), clamp(c.y + 10, 10, 85)).state = 'trip';
      for (let i = 0; i < 8; i++) this.spawnBug(this.bugKind, true);
      this.talk.ask('antibodies', 2, 12);
      this.fact('dendrytyczna');
      if (m > 0) this.remembered(this.bugKind);
    } else if (s === 'tcells') {
      // the nose's lining: the neutrophils rest, the T cells come
      this.scene = 'nose';
      this.bugs = [];
      this.flow = [];
      this.cells = this.cells.filter(c => c.kind === 'neut' && c.state === 'roam');
      for (const c of this.cells) c.state = 'gone';
      this.layEpithelium(false);
      const n = RULES.tcells.infected + RULES.tcells.infectedLoop * Math.min(4, this.p.loop - 1);
      const hiddenOk = has(this.p, 'nk') && this.p.loop >= 2;
      const order = this.epi.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      for (let k = 0; k < Math.min(n, this.epi.length - 2); k++) {
        const e = this.epi[order[k]];
        e.state = hiddenOk && this.rng() < RULES.tcells.hidden ? 'hidden' : 'infected';
        e.load = this.rng() * 0.35;
      }
      const tn = RULES.tcells.cells + memoryOf(this.p, this.virusKind);
      for (let i = 0; i < tn; i++) this.addCell('tcell', W * (0.15 + 0.7 * (i + 0.5) / tn), 88 + this.rng() * 6);
      if (has(this.p, 'nk')) for (let i = 0; i < 2; i++) this.addCell('nk', W * (0.3 + 0.4 * i), 92);
      this.talk.ask('tcells', 3, 12);
      this.fact('rinowirus');
      const first = this.epi.findIndex(e => e.state === 'infected');
      if (first >= 0) this.coach('tcell', { kind: 'world', x: this.epi[first].x, y: RULES.epi.y });
      if (memoryOf(this.p, this.virusKind) > 0) this.remembered(this.virusKind);
    } else {
      // healing: back in the skin; the swarm returns, the spent ones lie as bodies to tidy
      this.scene = 'skin';
      this.epi = [];
      this.cells = this.cells.filter(c => c.kind === 'neut' || c.kind === 'mac');
      for (const c of this.cells) if (c.kind === 'neut' && c.state === 'gone') { c.state = 'roam'; c.y = clamp(c.y, 30, 92); }
      this.ensureSwarm(6);
      this.ensureMakro();
      if (has(this.p, 'monocyty') && this.cells.filter(c => c.kind === 'mac').length < 2) this.addCell('mac', W * 0.8, 62);
      for (const m of this.cells) if (m.kind === 'mac') m.m2 = Math.max(m.m2, 0.2);
      // a few spent neutrophils from the fight, to tidy
      for (let i = 0; i < 4; i++) {
        const c = this.addCell('neut', clamp(this.woundX + (this.rng() - 0.5) * 50, 8, W - 8), 20 + this.rng() * 50);
        c.state = 'body';
        c.appetite = 0;
      }
      this.bugs = [];
      for (let i = 0; i < RULES.heal.stragglers; i++) {
        const b = this.spawnBug(this.bugKind, true);
        if (b) {
          b.hidden = true;
          b.x = clamp(this.woundX + (this.rng() - 0.5) * W * 0.8, 6, W - 6);
          b.y = 12 + this.rng() * 70;
        }
      }
      this.closure = Math.max(this.closure, this.prep);
      this.talk.ask('heal', 3, 12);
      this.fact('fazy');
      this.coach('collagen', { kind: 'world', x: this.woundX, y: 8 });
    }
    this.emit({ type: 'stage', stage: s, idx: this.stageIdx });
  }

  private layPads(): void {
    const n = Math.max(6, Math.round(this.W / 17));
    this.pads = Array.from({ length: n }, (_, i) => ({ x: (this.W * (i + 0.5)) / n, lit: 0, hits: 0 }));
  }

  /** The nose's lining: columnar cells across the world (their x kept on a resize). */
  private layEpithelium(keep: boolean): void {
    const n = Math.max(6, Math.floor(this.W / RULES.epi.w));
    const w = this.W / n;
    if (keep && this.epi.length === n) {
      this.epi.forEach((e, i) => { e.x = w * (i + 0.5); });
      return;
    }
    const old = this.epi;
    this.epi = Array.from({ length: n }, (_, i) => ({ x: w * (i + 0.5), state: 'ok' as EpiState, load: 0, t: 0, protect: 0, ifnT: 1 + (i % 3) }));
    if (keep) old.forEach((e, i) => { const j = Math.min(n - 1, Math.round((i / Math.max(1, old.length - 1)) * (n - 1))); if (e.state !== 'ok') Object.assign(this.epi[j], { state: e.state, load: e.load, t: e.t }); });
  }

  /** A session that resumes mid-loop finds the swarm already in the tissue (they came while the player was away). */
  private ensureSwarm(n: number): void {
    const have = this.cells.filter(c => c.kind === 'neut' && (c.state === 'roam' || c.state === 'gone')).length;
    for (let i = have; i < Math.min(n, swarmCapOf(this.p)); i++) {
      const c = this.addCell('neut', this.W * (0.15 + 0.7 * this.rng()), 70 + this.rng() * 22);
      c.vy = -6;
    }
  }

  private ensureMakro(): void {
    if (!this.makro) this.addCell('mac', this.W * 0.38, 55);
  }

  private addCell(kind: CellKind, x: number, y: number): Cell {
    const R = RULES;
    const r = kind === 'mac' ? R.mac.r : kind === 'dc' ? R.dc.r : kind === 'tcell' ? R.tcell.r : kind === 'nk' ? R.nk.r : kind === 'mast' ? 5 : R.neut.r;
    const c: Cell = {
      id: this.nextId++, kind, x, y, vx: 0, vy: 0, r, state: 'roam', st: 0,
      appetite: kind === 'neut' ? appetiteOf(this.p) : Infinity, gut: [], grab: null, target: -1, seed: this.rng(), eaten: 0, kills: 0,
      anucleate: false, slipT: 0, slipId: -1, m2: 0, dockT: 0,
    };
    this.cells.push(c);
    return c;
  }

  /** A bacterium: at the wound (entering) or near another; null when the field is full. */
  private spawnBug(kind: PathogenId, atWound: boolean, near?: Bug): Bug | null {
    if (this.bugs.length >= RULES.bugCap) return null;
    const W = this.W;
    let x: number, y: number;
    if (near) {
      const a = this.rng() * TAU;
      x = near.x + Math.cos(a) * 3.4;
      y = near.y + Math.sin(a) * 3.4;
    } else if (atWound) {
      x = this.woundX + (this.rng() - 0.5) * 22;
      y = 3 + this.rng() * 16;
    } else {
      x = W * (0.1 + 0.8 * this.rng());
      y = 8 + this.rng() * 60;
    }
    const k = loopK(this.p.loop);
    const spec = PATHOGEN[kind];
    const capsule = this.stage === 'antibodies' && spec.shape !== 'coccus' ? this.rng() < capsuleShare(this.p.loop) : this.stage === 'antibodies' && this.rng() < capsuleShare(this.p.loop) * 0.8;
    const m = memoryOf(this.p, kind);
    const pre = (this.stage === 'hunt' || this.stage === 'antibodies') && m > 0 && this.rng() < 0.25 * m;
    const b: Bug = {
      id: this.nextId++, kind, x: clamp(x, 2, W - 2), y: clamp(y, 2, RULES.wallY - 4), vx: 0, vy: 0, a: this.rng() * TAU,
      div: span([RULES.divide[0] - RULES.divide[1], RULES.divide[0] + RULES.divide[1]], this.rng()) / (k * (1 + RULES.divideLoop * (Math.max(1, this.p.loop) - 1))),
      tag: pre ? 1 : 0, c3: false, capsule, netted: 0, grabbed: false, hidden: false, run: this.rng(), age: 0,
    };
    this.bugs.push(b);
    this.spawned++;
    this.emit({ type: 'spawn', x: b.x, y: b.y });
    return b;
  }

  private addFlow(x: number, state: FlowState = 'flow'): void {
    const R = RULES;
    const y = (R.lumenTop + R.lumenBot) / 2 + (this.rng() - 0.5) * 4;
    this.flow.push({ id: this.nextId++, x, y, state, t: 0, until: span(R.recruit.autoArrest, this.rng()), jx: x, tapped: false, seed: this.rng() });
    if (state === 'roll') this.emit({ type: 'roll', x });
  }

  /** The stage's goal is met (or its cap ran out: the body finishes the job). */
  private finishStage(grace: boolean): void {
    if (this.outro > 0) return;
    const s = this.stage;
    const stars = starsFor(this.stageT, stageCap(s), grace);
    this.outro = 1.6;
    this.outroGrace = grace;
    this.freezeT = grace ? 0 : 0.1;
    if (stars > 0) setStars(this.p, starKey(this.p.loop, s), stars);
    this.stagesNow.push({ stage: s, stars });
    if (grace) {
      this.talk.ask('grace', 3, 6);
      // what is left is finished by the body's other defences: it fades, never counted as the player's
      for (const b of this.bugs) if (!b.grabbed) b.netted = Math.max(b.netted, 0.01);
    }
    if (s === 'antibodies') {
      const lv = remember(this.p, this.bugKind);
      this.memoryNow.push(this.bugKind);
      this.emit({ type: 'memory', id: this.bugKind, level: lv });
      this.fact('igg');
    } else if (s === 'tcells') {
      const lv = remember(this.p, this.virusKind);
      this.memoryNow.push(this.virusKind);
      this.emit({ type: 'memory', id: this.virusKind, level: lv });
      this.p.tcellsDone++;
      this.fact('tcr');
      this.unlocks();
    } else if (s === 'heal') {
      this.healedNow++;
      this.closure = 1;
      this.emit({ type: 'closed' });
      this.talk.ask('closed', 4, 8);
      this.fact('blizna');
    } else if (s === 'alarm') {
      this.talk.ask('pads', 3, 6);
    }
    this.emit({ type: 'stageDone', stage: s, stars, grace });
  }

  /** After the outro: the next stage (or the next loop), its card. */
  private nextStage(): void {
    const p = this.p;
    if (p.stage >= STAGES.length - 1) {
      p.loopsDone++;
      this.loopsNow.push(p.loop);
      p.loop++;
      p.stage = 0;
      this.emit({ type: 'loop', loop: p.loop });
      this.talk.ask('loop', 2, 10);
      if (p.loop === 2) this.fact('pamiecDluga');
    } else p.stage++;
    const facts = this.factsStage.slice();
    this.setupStage();
    this.showCard(p.stage === 0 ? 'loop' : 'stage', facts.at(-1) ?? null);
  }

  private showCard(kind: CardKind, fact: FactId | null = null): void {
    const dur = kind === 'open' ? RULES.storySec : RULES.cardSec;
    this.card = { kind, t: 0, dur, stage: this.stage, idx: this.stageIdx, fact, memory: this.memoryStage };
    this.talk.clear();
    this.emit({ type: 'card', kind });
  }

  private closeCard(): void {
    if (!this.card) return;
    this.card = null;
    this.emit({ type: 'cardClosed' });
  }

  /** A remembered pathogen: answered at once (the card says so, Neo too). */
  private remembered(id: PathogenId): void {
    this.memoryStage = id;
    this.talk.ask('memory', 3, 10);
    this.fact('pamiec');
  }

  private fact(id: FactId): void {
    if (this.p.facts.includes(id)) return;
    // a stage shows only a couple of new cards: the collection grows over sessions, not all at once
    if (id !== 'metchnikoff' && this.factsStage.length >= RULES.factsPerStage) return;
    if (!addFact(this.p, id)) return;
    this.factsNow.push(id);
    this.factsStage.push(id);
    this.emit({ type: 'fact', id });
  }

  private unlocks(): void {
    for (const id of checkUnlocks(this.p)) {
      this.unlocksNow.push(id);
      this.emit({ type: 'unlock', id });
    }
  }

  private coach(what: Coach, at: CoachAt): void {
    if (this.p.seen.includes(what)) return;
    this.p.seen.push(what);
    this.emit({ type: 'coach', what, at });
  }

  private ringAt(): CoachAt {
    const m = this.makro;
    return m && this.scene === 'skin' ? { kind: 'world', x: m.x, y: m.y } : { kind: 'free' };
  }

  private swarmAt(): CoachAt {
    const s = this.swarm;
    if (!s.length) return { kind: 'world', x: this.W * 0.5, y: 80 };
    return { kind: 'world', x: s.reduce((a, c) => a + c.x, 0) / s.length, y: s.reduce((a, c) => a + c.y, 0) / s.length };
  }

  private bodyAt(): CoachAt {
    const b = this.cells.find(c => c.kind === 'neut' && (c.state === 'body' || c.state === 'spent'));
    return b ? { kind: 'world', x: b.x, y: b.y } : { kind: 'free' };
  }

  // ── the world, a frame ───────────────────────────────────────────────────────────
  private world(dt: number): void {
    this.stageT += dt;
    this.comboT += dt;
    if (this.comboT > RULES.comboGap && this.combo > 0) {
      this.combo = 0;
      this.comboNetAt = 0;
    }
    if (this.leadT > 0) {
      this.leadT -= dt;
      if (this.leadT <= 0 && this.leadT > -1) this.leadPt = null;
    }
    if (this.mark) {
      this.mark.t += dt;
      if (this.mark.t > 1.2) this.mark = null;
    }
    this.strokeT = Math.max(0, this.strokeT - dt);
    const resting = this.restBlock;
    // inflammation rises with the bacteria and settles with calm
    const n = this.live.length + this.infected.length;
    if (resting) this.inflam = Math.max(0.05, this.inflam - RULES.inflamDown * (0.3 + this.calm) * dt);
    else this.inflam = clamp(this.inflam + RULES.inflamUp * Math.min(2, n / 10) * dt - 0.004 * dt, 0.05, 1);
    if (this.stage === 'heal') this.inflam = Math.max(0.05, this.inflam - 0.02 * dt * (1 + this.closure));
    // a rest in the battle prepares the repair under the surface
    if (resting && this.stage !== 'heal') this.prep = Math.min(RULES.heal.pre, this.prep + RULES.heal.preRate * (0.3 + this.calm) * dt);
    this.spawnStep(dt, resting);
    this.rings_(dt);
    this.flowStep(dt, resting);
    this.bugsStep(dt, resting);
    this.cellsStep(dt, resting);
    this.absStep(dt);
    this.netsStep(dt);
    if (this.scene === 'nose') this.epiStep(dt, resting);
    if (this.stage === 'heal') this.healStep(dt, resting);
    if (this.outro > 0) {
      this.outro -= dt;
      if (this.outro <= 0) {
        this.outro = 0;
        this.nextStage();
      }
      return;
    }
    this.checkGoal();
  }

  private checkGoal(): void {
    const s = this.stage;
    let done = false;
    if (s === 'alarm') done = this.litPads >= this.padsNeed;
    else if (s === 'recruit') done = this.recruits >= recruitNeed(this.p.loop);
    else if (s === 'hunt' || s === 'antibodies') done = this.spawned >= waveOf(s, this.p.loop) && this.bugs.every(b => b.hidden) && this.stageT > 3;
    else if (s === 'tcells') done = this.infected.length === 0 && this.virions.length === 0 && this.stageT > 2;
    else done = this.closure >= 1;
    if (done) this.finishStage(false);
    else if (this.stageT >= stageCap(s)) {
      if (s === 'alarm') for (const p of this.pads) { p.lit = 1; p.hits = RULES.alarm.padHits; }
      if (s === 'recruit') this.recruits = recruitNeed(this.p.loop);
      if (s === 'tcells') for (const e of this.epi) if (e.state !== 'ok' && e.state !== 'gone') { e.state = 'ok'; e.load = 0; }
      if (s === 'tcells') this.virions = [];
      if (s === 'heal') this.closure = 1;
      this.finishStage(true);
    }
  }

  /** New bacteria: the splinter's trickle, a stage's wave; none in a rest (the inflow pauses). */
  private spawnStep(dt: number, resting: boolean): void {
    if (resting || this.outro > 0) return;
    const s = this.stage;
    const kind = this.bugKind;
    if (s === 'alarm') {
      if (this.live.length < RULES.alarm.live && this.stageT > 2 && Math.floor((this.stageT - dt) / RULES.alarm.trickle) < Math.floor(this.stageT / RULES.alarm.trickle)) this.spawnBug(kind, true);
    } else if (s === 'recruit') {
      if (this.live.length < 14 && Math.floor((this.stageT - dt) / 2.6) < Math.floor(this.stageT / 2.6)) this.spawnBug(kind, true);
    } else if (s === 'hunt' || s === 'antibodies') {
      const wave = waveOf(s, this.p.loop);
      const every = s === 'hunt' ? 1.25 : 1.5;
      if (this.spawned < wave && Math.floor((this.stageT - dt) / every) < Math.floor(this.stageT / every)) this.spawnBug(kind, s === 'hunt', undefined);
    }
  }

  // ── rings: the alarm made visible ────────────────────────────────────────────────
  private rings_(dt: number): void {
    const R = RULES;
    const s = this.stage;
    if (this.outro <= 0) {
      this.ringT -= dt;
      const m = this.makro;
      if (this.ringT <= 0) {
        this.ringT = s === 'alarm' ? R.ringEvery : R.ringEvery * 1.6;
        if (this.scene === 'skin' && m && s !== 'heal') this.ring(m.x, m.y, this.reach, 'alarm');
        else if (this.scene === 'skin' && m && s === 'heal') this.ring(m.x, m.y, this.reach, 'growth');
      }
      if (s === 'alarm' && has(this.p, 'tuczne')) {
        this.mastT -= dt;
        if (this.mastT <= 0) {
          this.mastT = 3;
          for (const c of this.cells) if (c.kind === 'mast') this.ring(c.x, c.y, this.reach * 0.6, 'mast');
        }
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      r.r = r.max * Math.min(1, r.t / R.ringGrow);
      // the alarm reaches the vessel: the wall lights where the ring touches it (selectins)
      const d = R.wallY - r.y;
      if (!r.wall && (r.kind === 'alarm' || r.kind === 'mast' || r.kind === 'gulp') && this.scene === 'skin' && r.r >= d) {
        r.wall = true;
        const half = Math.sqrt(Math.max(0, r.max * r.max - d * d));
        for (const p of this.pads) {
          if (Math.abs(p.x - r.x) > half) continue;
          const was = p.lit;
          p.hits++;
          p.lit = Math.min(1, p.hits / R.alarm.padHits);
          if (was < 1 && p.lit >= 1) {
            this.emit({ type: 'pad', x: p.x, lit: this.litPads });
            if (this.litPads === 1) this.fact('cxcl8');
          }
        }
      }
      // in the healing stage the signal finds the stragglers it reaches
      if (r.kind === 'growth') for (const b of this.bugs) if (b.hidden && dist(b.x, b.y, r.x, r.y) <= r.r) { b.hidden = false; b.age = 0; }
      // interferon: healthy neighbours within reach turn antiviral for a while
      if (r.kind === 'ifn') for (const e of this.epi) if (e.state === 'ok' && Math.abs(e.x - r.x) <= r.r) e.protect = Math.max(e.protect, RULES.epi.protect);
      if (r.t >= R.ringGrow + 0.5) this.rings.splice(i, 1);
    }
  }

  private ring(x: number, y: number, max: number, kind: RingKind): void {
    if (this.rings.length > 14) this.rings.shift();
    this.rings.push({ x, y, r: 0, max, t: 0, kind, wall: false });
    this.emit({ type: 'ring', x, y, max, kind });
  }

  // ── the blood: the leukocyte adhesion cascade ────────────────────────────────────
  private flowStep(dt: number, resting: boolean): void {
    const R = RULES;
    const s = this.stage;
    const recruiting = s === 'recruit' || s === 'hunt' || s === 'antibodies';
    if (recruiting && this.outro <= 0) {
      const cap = swarmCapOf(this.p);
      const busy = this.swarm.length + this.flow.filter(f => f.state !== 'flow').length;
      let rate: number;
      if (resting) rate = R.restRecruit * (0.3 + 0.7 * this.calm);
      else rate = R.recruitBase * (1 + R.recruitK * this.alarm) * (s === 'recruit' ? R.recruit.flow / R.recruitBase : 1);
      if (busy < cap) {
        this.flowAcc += rate * dt / Math.max(0.2, R.recruit.capture);
        while (this.flowAcc >= 1) {
          this.flowAcc -= 1;
          this.addFlow(-4);
        }
      }
    }
    for (let i = this.flow.length - 1; i >= 0; i--) {
      const f = this.flow[i];
      f.t += dt;
      if (f.state === 'flow') {
        const x0 = f.x;
        f.x += (30 + f.seed * 12) * dt;
        for (const p of this.pads) {
          if (p.lit <= 0 || p.x < x0 || p.x > f.x) continue;
          if (this.rng() < R.recruit.capture * p.lit) {
            f.state = 'roll';
            f.t = 0;
            this.emit({ type: 'roll', x: f.x });
            if (!this.p.facts.includes('toczenie')) this.fact('toczenie');
            break;
          }
        }
        if (f.x > this.W + 6) this.flow.splice(i, 1);
      } else if (f.state === 'roll') {
        f.x += R.recruit.roll * dt;
        if (f.t >= f.until) this.arrest(f, false);
        if (f.x > this.W + 4) this.flow.splice(i, 1);
      } else if (f.state === 'arrest') {
        const tx = f.jx;
        f.x += clamp(tx - f.x, -dt * 8, dt * 8);
        if (f.t >= R.recruit.crawl) {
          f.state = 'squeeze';
          f.t = 0;
          this.emit({ type: 'squeeze', x: f.x });
          if (this.recruits === 0) this.talk.ask('squeeze', 2, 5);
          if (!this.p.facts.includes('diapedeza')) this.fact('diapedeza');
        }
      } else if (f.t >= R.recruit.squeeze) {
        this.flow.splice(i, 1);
        const c = this.addCell('neut', clamp(f.x, 4, this.W - 4), R.wallY - 5);
        c.vy = -12;
        this.recruits++;
        this.recruitsAll++;
        const n = this.swarm.length;
        this.emit({ type: 'join', x: c.x, y: c.y, n });
        if (this.recruitsAll === 1) this.fact('szpik');
        if (n >= 10) this.fact('procent');
        if (n >= 12) this.fact('roj');
      }
    }
  }

  private arrest(f: Flow, tapped: boolean): void {
    if (f.state !== 'roll') return;
    f.state = 'arrest';
    f.t = 0;
    f.tapped = tapped;
    f.jx = clamp(Math.round(f.x / 11) * 11 + 5.5, 4, this.W - 4);
    this.emit({ type: 'arrest', x: f.x, tapped });
  }

  // ── bacteria ─────────────────────────────────────────────────────────────────────
  private bugsStep(dt: number, resting: boolean): void {
    const R = RULES;
    const W = this.W;
    const divide = !resting && this.outro <= 0 && this.stage !== 'heal';
    for (let i = this.bugs.length - 1; i >= 0; i--) {
      const b = this.bugs[i];
      b.age += dt;
      if (b.grabbed) continue;
      if (b.netted > 0) {
        b.netted -= dt;
        b.vx *= 0.8;
        b.vy *= 0.8;
        if (b.netted <= 0) {
          // dissolved in the NET's antimicrobial proteins (or by the body's backup at a stage's cap)
          this.bugs.splice(i, 1);
          if (!this.outroGrace || this.outro <= 0) this.cleared(b, 'neut', false, b.x, b.y, true);
          this.emit({ type: 'digest', x: b.x, y: b.y });
        }
        continue;
      }
      if (b.hidden) continue;
      const spec = PATHOGEN[b.kind];
      if (spec.shape === 'swimmer') {
        b.run -= dt;
        if (b.run <= 0) {
          const running = b.run > -R.bug.tumble;
          if (!running) {
            b.a += (this.rng() - 0.5) * 2.6;
            b.run = R.bug.run * (0.6 + this.rng() * 0.8);
          }
        }
        const sp = b.run > 0 ? R.bug.swim * (resting ? 0.4 : 1) : 0.5;
        b.vx += (Math.cos(b.a) * sp - b.vx) * Math.min(1, dt * 5);
        b.vy += (Math.sin(b.a) * sp - b.vy) * Math.min(1, dt * 5);
      } else {
        // a slow Brownian drift, spreading away from the wound
        b.vx += (this.rng() - 0.5) * 18 * dt + (b.x - this.woundX) * 0.002 * dt * 10;
        b.vy += (this.rng() - 0.5) * 18 * dt + (this.stage === 'heal' ? 0.15 : R.bug.sink) * dt;
        const sp = Math.hypot(b.vx, b.vy), max = R.bug.drift * (resting ? 0.5 : 1);
        if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
        if (spec.shape === 'rod') b.a += (this.rng() - 0.5) * dt;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 2) { b.x = 2; b.vx = Math.abs(b.vx); b.a = Math.PI - b.a; }
      if (b.x > W - 2) { b.x = W - 2; b.vx = -Math.abs(b.vx); b.a = Math.PI - b.a; }
      if (b.y < 2) { b.y = 2; b.vy = Math.abs(b.vy); b.a = -b.a; }
      if (b.y > R.wallY - 4) { b.y = R.wallY - 4; b.vy = -Math.abs(b.vy); b.a = -b.a; }
      if (divide) {
        b.div -= dt;
        if (b.div <= 0) {
          b.div = span([R.divide[0] - R.divide[1], R.divide[0] + R.divide[1]], this.rng()) / (loopK(this.p.loop) * (1 + R.divideLoop * (Math.max(1, this.p.loop) - 1)));
          const c = this.spawnBug(b.kind, false, b);
          if (c) {
            this.spawned--;   // a daughter is not part of the wave count…
            c.tag = b.tag * 0.5;
            c.capsule = b.capsule;
            this.emit({ type: 'divide', x: b.x, y: b.y });
            if (!this.p.facts.includes('podzial')) this.fact('podzial');
            if (this.live.length >= 16) this.talk.ask('divide', 1, 4);
          }
        }
      }
    }
  }

  /** A pathogen cleared: the score, the combo, the memory's tally, the unlocks. */
  private cleared(b: Bug, by: CellKind, tagged: boolean, x: number, y: number, quiet = false): void {
    this.score++;
    this.bacteria++;
    this.p.total++;
    this.p.met[b.kind] = (this.p.met[b.kind] ?? 0) + 1;
    if (!quiet) {
      this.combo += tagged ? 2 : 1;
      this.comboT = 0;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      if (this.combo >= 5 && this.combo % 5 === 0) {
        this.emit({ type: 'combo', n: this.combo });
        this.talk.ask('combo', 1, 3);
      }
      if (this.combo >= 8) this.fact('roj');
      if (this.combo - this.comboNetAt >= RULES.comboNet && this.netShown) {
        this.comboNetAt = this.combo;
        if (this.nets < netMaxOf(this.p)) {
          this.nets++;
          this.emit({ type: 'netReady', n: this.nets });
          this.coach('net', { kind: 'net' });
        }
      }
      if (this.pushBlock && !this.blind) this.charge = clamp(this.charge + RULES.eatCharge);
    }
    if (!quiet) this.emit({ type: 'gulp', x, y, kind: b.kind, by, tagged, combo: this.combo });
    this.unlocks();
  }

  // ── cells ────────────────────────────────────────────────────────────────────────
  private cellsStep(dt: number, resting: boolean): void {
    const R = RULES;
    const swarm = this.cells.filter(c => c.kind === 'neut' && c.state === 'roam');
    this.swarmC.n = swarm.length;
    if (swarm.length) {
      this.swarmC.x = swarm.reduce((a, c) => a + c.x, 0) / swarm.length;
      this.swarmC.y = swarm.reduce((a, c) => a + c.y, 0) / swarm.length;
    }
    // the finger's formation: golden-angle slots around the lead
    swarm.forEach((c, k) => {
      if (!this.leadPt) return;
      const a = k * 2.39996 + c.seed;
      const rr = R.leadSpread * Math.sqrt((k + 0.5) / Math.max(1, swarm.length));
      (c as Cell & { sx?: number; sy?: number }).sx = this.leadPt.x + Math.cos(a) * rr;
      (c as Cell & { sx?: number; sy?: number }).sy = this.leadPt.y + Math.sin(a) * rr;
    });
    for (let i = this.cells.length - 1; i >= 0; i--) {
      const c = this.cells[i];
      c.st += dt;
      c.slipT = Math.max(0, c.slipT - dt);
      if (c.state === 'gone') continue;
      this.digest(c, dt);
      switch (c.kind) {
        case 'neut': this.neut(c, dt, resting); break;
        case 'mac': this.mac(c, dt, resting); break;
        case 'tcell':
        case 'nk': this.lymph(c, dt, resting); break;
        case 'dc': this.dc(c, dt); break;
        default: this.wobble(c, dt); break;
      }
      if (c.state === 'body' && c.st >= R.neut.bodySec) this.cells.splice(i, 1);
    }
    this.separate(dt);
  }

  /** Digestion in the phagosomes: the fizz, then the cell is free to eat again (or spent). */
  private digest(c: Cell, dt: number): void {
    if (c.grab) {
      const g = c.grab;
      g.t += dt * this.eatK * (this.bursting > 0 ? RULES.burstEat : 1);
      c.vx *= 0.85;
      c.vy *= 0.85;
      if (g.t >= g.dur) {
        const b = g.bug;
        c.grab = null;
        const i = this.bugs.indexOf(b);
        if (i >= 0) this.bugs.splice(i, 1);
        const tagged = b.tag >= 1;
        const dur = (c.kind === 'mac' ? RULES.mac.digest : RULES.neut.digest) / (tagged ? 1.5 : 1);
        c.gut.push({ kind: b.kind, t: 0, dur, tagged });
        c.eaten++;
        if (c.kind === 'neut') c.appetite--;
        this.cleared(b, c.kind, tagged, c.x, c.y);
        if (c.kind === 'neut' && this.bacteria === 1) this.fact('fagocytoza');
        if (c.kind === 'neut' && c.eaten === 1) this.talk.ask('gulp', 1, 3);
        if (c.kind === 'mac' && this.stage === 'alarm') this.ring(c.x, c.y, this.reach * RULES.gulpRing, 'gulp');
        if (tagged) this.talk.ask('tag', 1, 3);
      }
    }
    for (let k = c.gut.length - 1; k >= 0; k--) {
      const ph = c.gut[k];
      ph.t += dt * this.eatK * (this.bursting > 0 ? RULES.burstEat : 1);
      if (ph.t >= ph.dur) {
        c.gut.splice(k, 1);
        this.emit({ type: 'digest', x: c.x, y: c.y });
      }
    }
    if (c.kind === 'neut' && c.state === 'roam' && c.appetite <= 0 && !c.grab && !c.gut.length) {
      c.state = 'spent';
      c.st = 0;
      c.target = -1;
      this.emit({ type: 'spent', x: c.x, y: c.y });
      this.talk.ask('full', 1, 4);
      this.fact('apetyt');
    }
  }

  private seekPoint(c: Cell, tx: number, ty: number, speed: number, accel: number, dt: number, arrive = 6): void {
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    const want = d > 0.01 ? Math.min(speed, (speed * d) / arrive) : 0;
    const wx = d > 0.01 ? (dx / d) * want : 0, wy = d > 0.01 ? (dy / d) * want : 0;
    const sx = wx - c.vx, sy = wy - c.vy, sl = Math.hypot(sx, sy), max = accel * dt;
    if (sl > max) { c.vx += (sx / sl) * max; c.vy += (sy / sl) * max; } else { c.vx = wx; c.vy = wy; }
  }

  private move(c: Cell, dt: number, top: number, bottom: number): void {
    c.x = clamp(c.x + c.vx * dt, c.r, this.W - c.r);
    c.y = clamp(c.y + c.vy * dt, top + c.r, bottom - c.r);
  }

  private findBug(x: number, y: number, maxD: number, c?: Cell): Bug | null {
    let best: Bug | null = null, bd = maxD;
    for (const b of this.bugs) {
      if (b.grabbed || b.hidden) continue;
      if (c && c.slipT > 0 && c.slipId === b.id) continue;
      if (c && c.kind === 'neut' && b.capsule && b.tag < 1 && this.bursting <= 0 && !(c.target === b.id)) continue;
      const d = dist(x, y, b.x, b.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  private bugById(id: number): Bug | undefined {
    return id >= 0 ? this.bugs.find(b => b.id === id && !b.grabbed && !b.hidden) : undefined;
  }

  private neut(c: Cell, dt: number, resting: boolean): void {
    const R = RULES;
    if (c.state === 'spent') {
      c.vx *= 0.96;
      c.vy *= 0.96;
      c.vy -= 0.6 * dt;
      this.move(c, dt, 0, R.wallY);
      if (c.st >= R.neut.spentSec) {
        c.state = 'body';
        c.st = 0;
        this.emit({ type: 'body', x: c.x, y: c.y });
        this.fact('zycie');
      }
      return;
    }
    if (c.state === 'body') {
      c.vx *= 0.9;
      c.vy *= 0.9;
      this.move(c, dt, 0, R.wallY);
      return;
    }
    if (c.grab) { this.move(c, dt, 0, R.wallY); return; }
    const speed = R.neut.speed * (resting ? 0.6 : 1) * (this.bursting > 0 ? 1.25 : 1);
    const sniff = R.neut.sniff * (1 + R.sniffK * this.alarm) * (this.bursting > 0 ? R.burstSniff : 1);
    const full = c.gut.length >= R.neut.hold;
    let tb = this.bugById(c.target);
    if (!tb) c.target = -1;
    const slot = c as Cell & { sx?: number; sy?: number };
    if (full) {
      // chewing: drift with the swarm
      if (this.leadPt && slot.sx !== undefined) this.seekPoint(c, slot.sx, slot.sy!, speed * 0.5, R.neut.accel, dt);
      else { c.vx *= 0.94; c.vy *= 0.94; }
    } else if (tb) {
      this.seekPoint(c, tb.x, tb.y, speed, R.neut.accel, dt, 2);
    } else if (this.leadPt && slot.sx !== undefined) {
      this.seekPoint(c, slot.sx, slot.sy!, speed, R.neut.accel, dt);
    } else {
      // chemotaxis: up the gradient to the nearest bacterium it can smell
      const b = this.findBug(c.x, c.y, sniff, c);
      if (b) this.seekPoint(c, b.x, b.y, speed * 0.85, R.neut.accel, dt, 2);
      else {
        // while healing, the swarm keeps out of the wound bed (the repair shows): it patrols below it
        const cx = this.stage === 'heal' ? this.woundX + Math.sin(c.seed * 20) * 34 : this.swarmC.x;
        const cy = this.stage === 'heal' ? 66 : this.swarmC.y;
        // idle: a loose patrol around the swarm's centre; in a rest the swarm spreads out and dozes
        const spread = resting ? 26 : 10;
        const a = c.seed * 40 + this.t * (resting ? 0.08 : 0.4);
        const wx = cx + Math.cos(a) * spread * (0.4 + c.seed), wy = clamp(cy + Math.sin(a * 1.2) * spread * 0.7 * (0.4 + c.seed) - 4, 10, 90);
        this.seekPoint(c, wx, wy, speed * (resting ? 0.2 : 0.35), R.neut.accel * 0.5, dt, 10);
      }
    }
    this.move(c, dt, 0, R.wallY);
    if (full) return;
    // contact: engulf whatever it touches (a capsule bounces it off until tagged)
    for (const b of this.bugs) {
      if (b.grabbed || b.hidden) continue;
      if (dist(c.x, c.y, b.x, b.y) > c.r + 2.6) continue;
      if (b.capsule && b.tag < 1 && this.bursting <= 0) {
        if (c.slipT <= 0) {
          c.slipT = 1;
          c.slipId = b.id;
          if (c.target === b.id) c.target = -1;
          c.vx = (c.x - b.x) * 4;
          c.vy = (c.y - b.y) * 4;
          this.emit({ type: 'slip', x: b.x, y: b.y });
          this.talk.ask('capsule', 1, 4);
          this.coach('capsule', { kind: 'world', x: b.x, y: b.y });
        }
        continue;
      }
      this.engulf(c, b);
      break;
    }
  }

  private engulf(c: Cell, b: Bug): void {
    const R = RULES;
    b.grabbed = true;
    b.netted = 0;
    const base = c.kind === 'mac' ? R.mac.wrap : R.neut.wrap;
    const dur = this.bursting > 0 ? 0.06 : b.tag >= 1 ? base / R.tagK : base;
    c.grab = { bug: b, t: 0, dur };
    c.target = -1;
    if (b.tag >= 1 && b.c3 && !this.p.facts.includes('dopelniacz')) this.fact('dopelniacz');
  }

  private mac(c: Cell, dt: number, resting: boolean): void {
    const R = RULES;
    if (this.stage === 'heal' || resting) c.m2 = Math.min(1, c.m2 + dt * 0.15);
    else c.m2 = Math.max(0, c.m2 - dt * 0.05);
    if (c.grab) { this.move(c, dt, 0, R.wallY); return; }
    const isMain = c === this.makro;
    const player = isMain && this.stage === 'alarm';
    // a body to tidy: the one it was sent to, else (in rest and healing) the nearest
    const bodies = this.cells.filter(x => x.kind === 'neut' && (x.state === 'body' || (x.state === 'spent' && x.st > 1.5)));
    let body = c.target < 0 ? undefined : bodies.find(x => x.id === c.target);
    if (!body && !player && (resting || this.stage === 'heal') && bodies.length) {
      let bd = 1e9;
      for (const x of bodies) { const d = dist(c.x, c.y, x.x, x.y); if (d < bd) { bd = d; body = x; } }
    }
    if (body) {
      this.seekPoint(c, body.x, body.y, R.mac.speed * 1.3, R.mac.accel, dt, 3);
      this.move(c, dt, 0, R.wallY);
      if (dist(c.x, c.y, body.x, body.y) <= c.r + body.r * 0.6) {
        // efferocytosis: the spent neutrophil is eaten, the macrophage turns to repair
        const j = this.cells.indexOf(body);
        if (j >= 0) this.cells.splice(j, 1);
        c.target = -1;
        c.m2 = Math.min(1, c.m2 + 0.25);
        c.gut.push({ kind: this.bugKind, t: 0, dur: 1.4, tagged: false });
        this.emit({ type: 'tidy', x: body.x, y: body.y });
        this.fact('efferocytoza');
        this.talk.ask('tidy', 1, 4);
        if (this.stage === 'heal') this.closure = Math.min(1, this.closure + R.heal.tidy);
        else this.prep = Math.min(R.heal.pre, this.prep + R.heal.tidy * 0.5);
      }
      return;
    }
    let tb = this.bugById(c.target);
    if (!tb) c.target = -1;
    if (c.gut.length >= R.mac.hold) { c.vx *= 0.95; c.vy *= 0.95; this.move(c, dt, 0, R.wallY); return; }
    if (tb) this.seekPoint(c, tb.x, tb.y, R.mac.speed, R.mac.accel, dt, 3);
    else if (player && this.leadPt) this.seekPoint(c, this.leadPt.x, this.leadPt.y, R.mac.speed, R.mac.accel, dt, 4);
    else {
      const b = this.findBug(c.x, c.y, R.mac.sniff * (1 + 0.5 * this.alarm));
      if (b) this.seekPoint(c, b.x, b.y, R.mac.speed * (player ? 0.8 : 0.7), R.mac.accel, dt, 3);
      else {
        const hx = isMain ? this.W * 0.4 : this.W * 0.75, hy = 55;
        this.seekPoint(c, hx + Math.sin(this.t * 0.2 + c.seed * 5) * 8, hy, R.mac.speed * 0.3, R.mac.accel, dt, 12);
      }
    }
    this.move(c, dt, 0, R.wallY);
    for (const b of this.bugs) {
      if (b.grabbed || b.hidden) continue;
      if (dist(c.x, c.y, b.x, b.y) > c.r + 2.4) continue;
      // macrophages manage a capsule better (they are slow and patient), tagged or not
      this.engulf(c, b);
      break;
    }
  }

  /** The dendritic cell's trip: it samples a bacterium and leaves for the lymph node (absStep turns the antibodies on). */
  private dc(c: Cell, dt: number): void {
    const R = RULES;
    if (this.dcT < 1.4) {
      const b = c.grab ? null : this.findBug(c.x, c.y, 60);
      if (b) this.seekPoint(c, b.x, b.y, R.dc.speed, 60, dt, 3);
      else { c.vx *= 0.9; c.vy *= 0.9; }
      if (b && dist(c.x, c.y, b.x, b.y) < c.r + 2.5) {
        b.grabbed = true;
        c.grab = { bug: b, t: 0, dur: 0.5 };
        this.emit({ type: 'dc', phase: 'grab', x: c.x, y: c.y });
      }
    } else {
      if (this.dcT - dt < 1.4) this.emit({ type: 'dc', phase: 'leave', x: c.x, y: c.y });
      // to the lymphatic vessel at the side of the slice, and away to the node
      this.seekPoint(c, this.W + 14, 36, R.dc.speed * 1.5, 80, dt, 2);
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (c.x > this.W + 12) { c.state = 'gone'; c.vx = 0; c.vy = 0; }
  }

  private wobble(c: Cell, dt: number): void {
    c.vx = Math.sin(this.t * 0.7 + c.seed * 9) * 1.5;
    c.vy = Math.cos(this.t * 0.6 + c.seed * 7) * 1.2;
    this.move(c, dt, 0, RULES.wallY);
  }

  /** T cells and NK cells in the nose: to the infected cells (the tapped one first), dock, and the cell folds away. */
  private lymph(c: Cell, dt: number, resting: boolean): void {
    const R = RULES;
    const nk = c.kind === 'nk';
    const speed = (nk ? R.nk.speed : R.tcell.speed) * (resting ? 0.6 : 1) * (1 + 0.4 * this.alarm);
    const dockY = R.epi.y + R.epi.h / 2 + c.r * 0.9;
    if (c.state === 'dock') {
      const e = this.epi[c.target];
      c.dockT += dt;
      if (!e || (e.state !== 'docked' && e.state !== 'fold')) { c.state = 'roam'; c.target = -1; return; }
      this.seekPoint(c, e.x, dockY, speed, 90, dt, 2);
      this.move(c, dt, 0, R.wallY);
      if (e.state === 'docked' && c.dockT >= R.tcell.dock) {
        e.state = 'fold';
        e.t = 0;
      }
      if (e.state === 'fold' && e.t >= R.tcell.fold) {
        const n = Math.max(1, Math.round(e.load * R.epi.burst) + 1);
        e.state = 'gone';
        e.t = 0;
        e.load = 0;
        c.state = 'rest';
        c.st = 0;
        c.kills++;
        c.target = -1;
        this.score += n;
        this.virusesStopped += n;
        this.p.total += n;
        this.p.met[this.virusKind] = (this.p.met[this.virusKind] ?? 0) + n;
        this.emit({ type: 'fold', x: e.x, y: R.epi.y, n, by: c.kind });
        this.talk.ask(nk ? 'nk' : 'kill', 2, 4);
        this.fact(nk ? 'nk' : 'perforyna');
        if (!nk && c.kills >= 3) this.fact('ctl');
        this.unlocks();
      }
      return;
    }
    if (c.state === 'rest') {
      c.vx *= 0.9;
      c.vy *= 0.9;
      this.move(c, dt, 0, R.wallY);
      if (c.st >= R.tcell.rest) c.state = 'roam';
      return;
    }
    let e = c.target >= 0 ? this.epi[c.target] : undefined;
    const visible = (x: Epi) => x.state === 'infected' || (nk && x.state === 'hidden');
    if (!e || !visible(e)) {
      c.target = -1;
      e = undefined;
      // auto: the nearest infected cell it can see (NK cells see the hidden ones too)
      let bd: number = nk ? R.nk.sniff : R.tcell.sniff;
      this.epi.forEach((x, i) => {
        if (!visible(x)) return;
        if (this.cells.some(o => o !== c && o.target === i && o.state === 'dock')) return;
        const d = dist(c.x, c.y, x.x, dockY);
        if (d < bd) { bd = d; c.target = i; e = x; }
      });
    }
    if (e) {
      this.seekPoint(c, e.x, dockY, speed, R.tcell.accel, dt, 2);
      if (dist(c.x, c.y, e.x, dockY) < 2.5 && visible(e)) {
        e.state = 'docked';
        e.t = 0;
        c.state = 'dock';
        c.dockT = 0;
        this.emit({ type: 'dock', x: e.x, y: R.epi.y });
      }
    } else if (this.leadPt) {
      this.seekPoint(c, this.leadPt.x + Math.cos(c.seed * 9) * 6, this.leadPt.y + Math.sin(c.seed * 9) * 6, speed, R.tcell.accel, dt, 5);
    } else {
      this.seekPoint(c, this.W * (0.2 + 0.6 * c.seed) + Math.sin(this.t * 0.3 + c.seed * 8) * 10, 62 + Math.cos(this.t * 0.4 + c.seed * 5) * 10, speed * 0.3, 40, dt, 10);
    }
    this.move(c, dt, R.epi.y + R.epi.h / 2, R.wallY);
  }

  private separate(dt: number): void {
    const cs = this.cells;
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i];
      if (a.state === 'gone' || a.kind === 'dc') continue;
      for (let j = i + 1; j < cs.length; j++) {
        const b = cs[j];
        if (b.state === 'gone' || b.kind === 'dc') continue;
        const min = (a.r + b.r) * 1.04;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d >= min || d < 0.001) continue;
        const push = Math.min(min - d, ((min - d) / min) * 160 * dt);
        const ux = dx / d, uy = dy / d;
        const wa = a.kind === 'mac' ? 0.2 : 1, wb = b.kind === 'mac' ? 0.2 : 1;
        a.x -= ux * push * wa;
        a.y -= uy * push * wa;
        b.x += ux * push * wb;
        b.y += uy * push * wb;
      }
    }
  }

  // ── antibodies, complement, NETs ─────────────────────────────────────────────────
  private absStep(dt: number): void {
    const R = RULES;
    // the trip to the lymph node: B cells meet the piece, plasma cells start making antibodies (compressed)
    if (this.stage === 'antibodies' && !this.abOn) {
      const was = this.dcT;
      this.dcT += dt;
      if (was < 3.2 && this.dcT >= 3.2) this.emit({ type: 'dc', phase: 'node', x: this.W, y: 36 });
      if (this.dcT >= R.antibodies.trip) {
        this.abOn = true;
        this.emit({ type: 'dc', phase: 'back', x: this.W, y: 36 });
        this.emit({ type: 'abWave' });
        this.talk.ask('antibodies', 3, 8);
      }
    }
    if (this.abOn && this.stage === 'antibodies' && this.outro <= 0) {
      const m = memoryOf(this.p, this.bugKind);
      this.abT += dt * R.ab.rate * (1 + this.alarm) * (m > 0 ? 1.5 : 1);
      while (this.abT >= 1 && this.abs.length < 40) {
        this.abT -= 1;
        this.abs.push({ x: this.W * (0.06 + 0.88 * this.rng()), y: R.wallY - 1, vx: 0, vy: -R.ab.speed, target: -1, t: 0 });
      }
    }
    // complement: C3b settles on a bacterium now and then (the antibodies stage and after)
    if (this.stage === 'antibodies' && this.outro <= 0) {
      this.c3T -= dt;
      if (this.c3T <= 0) {
        this.c3T = 2.4;
        const free = this.bugs.filter(b => !b.grabbed && !b.hidden && b.tag < 1);
        if (free.length) {
          const b = free[Math.floor(this.rng() * free.length)];
          b.tag = 1;
          b.c3 = true;
          this.emit({ type: 'tag', x: b.x, y: b.y, by: 'c3' });
        }
      }
    }
    for (let i = this.abs.length - 1; i >= 0; i--) {
      const a = this.abs[i];
      a.t += dt;
      let b = a.target >= 0 ? this.bugs.find(x => x.id === a.target && !x.grabbed && x.tag < 1) : undefined;
      if (!b) {
        let bd: number = R.ab.look;
        a.target = -1;
        for (const x of this.bugs) {
          if (x.grabbed || x.hidden || x.tag >= 1) continue;
          const d = dist(a.x, a.y, x.x, x.y);
          if (d < bd) { bd = d; b = x; a.target = x.id; }
        }
      }
      if (b) {
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        a.vx += ((dx / d) * R.ab.speed - a.vx) * Math.min(1, dt * 4);
        a.vy += ((dy / d) * R.ab.speed - a.vy) * Math.min(1, dt * 4);
        if (d < 2.4) {
          b.tag = 1;
          this.abs.splice(i, 1);
          this.emit({ type: 'tag', x: b.x, y: b.y, by: 'ab' });
          if (!this.p.facts.includes('plazmatyczna')) this.fact('plazmatyczna');
          continue;
        }
      } else {
        a.vy = Math.max(a.vy, -6);
        a.vx += (this.rng() - 0.5) * 10 * dt;
      }
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.t > 9 || a.y < -4) this.abs.splice(i, 1);
    }
  }

  private netsStep(dt: number): void {
    for (let i = this.netsUp.length - 1; i >= 0; i--) {
      const n = this.netsUp[i];
      n.life -= dt;
      if (n.life <= 0) this.netsUp.splice(i, 1);
    }
  }

  // ── the nose's lining: infection, interferon, virions ────────────────────────────
  private epiStep(dt: number, resting: boolean): void {
    const R = RULES;
    const rep = R.epi.replicate / (1 + R.epi.replicateLoop * (this.p.loop - 1));
    for (let i = 0; i < this.epi.length; i++) {
      const e = this.epi[i];
      e.t += dt;
      e.protect = Math.max(0, e.protect - dt);
      if (e.state === 'gone') {
        // a basal cell divides and fills the gap
        if (e.t >= 6) { e.state = 'ok'; e.t = 0; e.protect = 4; }
        continue;
      }
      if (e.state !== 'infected' && e.state !== 'hidden') continue;
      // an infected cell warns its neighbours: interferon, as far as the alarm reaches
      e.ifnT -= dt;
      if (e.ifnT <= 0 && !resting && this.outro <= 0) {
        e.ifnT = 2.6;
        this.ring(e.x, R.epi.y, this.reach * R.epi.ifn, 'ifn');
      }
      if (resting || this.outro > 0) continue;
      e.load += dt / rep;
      if (e.load >= 1) {
        // the virus bursts out of the cell and drifts to the neighbours
        const n = R.epi.burst;
        for (let k = 0; k < n; k++) {
          const dir = k % 2 ? -1 : 1;
          this.virions.push({ x: e.x, y: R.epi.y - R.epi.h / 2 - 1.5, vx: dir * R.epi.virionSpeed * (0.4 + 0.6 * this.rng()), vy: (this.rng() - 0.5) * 3, life: R.epi.virionSec, d: 0 });
        }
        e.state = 'gone';
        e.t = 0;
        e.load = 0;
        this.emit({ type: 'virions', x: e.x, y: R.epi.y, n });
      }
    }
    // free virions: land on a neighbour and infect it, unless interferon protects it; antibodies of a remembered virus neutralise them
    const m = memoryOf(this.p, this.virusKind);
    const top = R.epi.y - R.epi.h / 2 - 1.5;
    for (let i = this.virions.length - 1; i >= 0; i--) {
      const v = this.virions[i];
      v.life -= dt;
      v.x += v.vx * dt;
      v.d += Math.abs(v.vx) * dt;
      v.vy += (top - v.y) * 2 * dt;
      v.y += v.vy * dt;
      if (m > 0 && this.rng() < dt * 0.35 * m) {
        this.virions.splice(i, 1);
        this.score++;
        this.virusesStopped++;
        this.p.total++;
        this.emit({ type: 'neutralise', x: v.x, y: v.y });
        continue;
      }
      if (v.life <= 0 || v.x < -2 || v.x > this.W + 2) { this.virions.splice(i, 1); continue; }
      if (v.d < R.epi.w * 0.6 || this.rng() > dt * 2.2) continue;
      // it settles on the cell under it: a healthy one is infected, unless interferon protects it
      let bi = -1, bd: number = R.epi.infectR;
      this.epi.forEach((e, j) => { const d = Math.abs(e.x - v.x); if (d < bd) { bd = d; bi = j; } });
      const e = bi >= 0 ? this.epi[bi] : undefined;
      if (!e || e.state !== 'ok') continue;
      this.virions.splice(i, 1);
      if (e.protect > 0) continue;
      e.state = has(this.p, 'nk') && this.p.loop >= 2 && this.rng() < RULES.tcells.hidden ? 'hidden' : 'infected';
      e.load = 0;
      e.t = 0;
      this.emit({ type: 'infect', i: bi });
    }
  }

  // ── healing ──────────────────────────────────────────────────────────────────────
  private healStep(dt: number, resting: boolean): void {
    const R = RULES;
    const rate = R.heal.base + (resting ? R.heal.calmRate * this.calm : 0);
    this.closure = Math.min(1, this.closure + rate * dt);
    // a straggler near a cell is found
    for (const b of this.bugs) if (b.hidden && this.cells.some(c => c.kind === 'neut' && c.state === 'roam' && dist(c.x, c.y, b.x, b.y) < R.neut.sniff * 0.6)) { b.hidden = false; b.age = 0; }
  }

  // ── the hands ────────────────────────────────────────────────────────────────────
  /**
   * A tap at a world point: on the card it closes it; in the vessel it stops the rolling cell nearest; on a
   * bacterium (or an infected cell, a spent neutrophil) it sends the defenders to it; on bare tissue it sends
   * the swarm to the nearest target from there (the centre tap of the smoke test).  Returns what it did.
   */
  tap(x: number, y: number): 'card' | 'arrest' | 'target' | 'seek' | 'tidy' | 'cell' | 'none' {
    if (!this.started || this.phase === 'done') return 'none';
    if (this.card) {
      if (this.card.t >= RULES.cardTap) { this.closeCard(); return 'card'; }
      return 'none';
    }
    const R = RULES;
    // the vessel: the rolling cell nearest the tap
    if (y >= R.wallY - 3 && this.flow.some(f => f.state === 'roll')) {
      let best: Flow | null = null, bd = 22;
      for (const f of this.flow) { if (f.state !== 'roll') continue; const d = Math.abs(f.x - x); if (d < bd) { bd = d; best = f; } }
      if (best) {
        this.arrest(best, true);
        return 'arrest';
      }
    }
    if (this.scene === 'nose') return this.tapNose(x, y);
    // a spent neutrophil or its body: Makro tidies it
    const body = this.cells.find(c => c.kind === 'neut' && (c.state === 'body' || c.state === 'spent') && dist(c.x, c.y, x, y) <= c.r + 8);
    if (body && this.makro) {
      const macs = this.cells.filter(c => c.kind === 'mac');
      let m = macs[0], bd = 1e9;
      for (const c of macs) { const d = dist(c.x, c.y, body.x, body.y); if (d < bd) { bd = d; m = c; } }
      m.target = body.id;
      this.mark = { x: body.x, y: body.y, t: 0 };
      this.emit({ type: 'target', x: body.x, y: body.y });
      return 'tidy';
    }
    // a bacterium under the finger, or the nearest from a tap on bare tissue
    const near = this.findBug(x, y, R.tapPick);
    const target = near ?? this.findBug(x, y, 999);
    if (target) {
      this.send(target);
      this.mark = { x: target.x, y: target.y, t: 0 };
      if (!near) {
        this.leadPt = { x, y };
        this.leadT = 0.25;
      }
      this.emit({ type: near ? 'target' : 'seek', x: target.x, y: target.y });
      if (near) this.coach('tap', { kind: 'free' });
      return near ? 'target' : 'seek';
    }
    // nothing to hunt: the swarm gathers where the finger tapped
    this.leadPt = { x, y };
    this.leadT = R.tapLead;
    this.mark = { x, y, t: 0 };
    this.emit({ type: 'seek', x, y });
    return 'seek';
  }

  private tapNose(x: number, y: number): 'cell' | 'seek' | 'none' {
    const R = RULES;
    let bi = -1, bd = R.epi.w * 0.9;
    this.epi.forEach((e, i) => { const d = Math.abs(e.x - x); if (d < bd && (e.state === 'infected' || e.state === 'hidden') && Math.abs(y - R.epi.y) < 26) { bd = d; bi = i; } });
    if (bi < 0) {
      // bare tissue: the nearest infected cell to the tap
      this.epi.forEach((e, i) => { if (e.state !== 'infected') return; const d = dist(e.x, R.epi.y, x, y); if (bi < 0 || d < bd) { bd = d; bi = i; } });
      if (bi < 0) {
        this.leadPt = { x, y: Math.max(y, R.epi.y + R.epi.h) };
        this.leadT = R.tapLead;
        return 'seek';
      }
    }
    const e = this.epi[bi];
    if (e.state === 'hidden') {
      this.emit({ type: 'noFlags', x: e.x, y: R.epi.y });
      this.coach('hidden', { kind: 'world', x: e.x, y: R.epi.y });
      const nk = this.cells.filter(c => c.kind === 'nk' && c.state === 'roam');
      if (nk.length) nk.reduce((a, c) => (Math.abs(c.x - e.x) < Math.abs(a.x - e.x) ? c : a)).target = bi;
      return 'cell';
    }
    const ts = this.cells.filter(c => (c.kind === 'tcell' || c.kind === 'nk') && c.state === 'roam');
    if (ts.length) {
      ts.sort((a, b) => dist(a.x, a.y, e.x, R.epi.y) - dist(b.x, b.y, e.x, R.epi.y));
      ts[0].target = bi;
    }
    this.mark = { x: e.x, y: R.epi.y, t: 0 };
    this.emit({ type: 'target', x: e.x, y: R.epi.y });
    return 'cell';
  }

  /** Send the nearest free defenders to a bacterium: Makro in the alarm, else part of the swarm (and Makro if close). */
  private send(b: Bug): void {
    const R = RULES;
    if (this.stage === 'alarm') {
      const m = this.makro;
      if (m) m.target = b.id;
      return;
    }
    const free = this.cells.filter(c => c.kind === 'neut' && c.state === 'roam' && c.gut.length < R.neut.hold && !c.grab);
    free.sort((a, c) => dist(a.x, a.y, b.x, b.y) - dist(c.x, c.y, b.x, b.y));
    const n = Math.max(1, Math.min(R.tapSend, Math.ceil(free.length / 2)));
    for (let i = 0; i < Math.min(n, free.length); i++) free[i].target = b.id;
    const m = this.makro;
    if (m && !free.length) m.target = b.id;
    // the others home in on the bacteria around it
    for (const c of free.slice(n)) {
      const o = this.findBug(b.x, b.y, 24, c);
      if (o) c.target = o.id;
    }
  }

  /** The finger leads (a drag): the swarm (Makro in the alarm, the T cells in the nose) follows the point; null lets go. */
  lead(x: number | null, y = 0): void {
    if (x === null) {
      this.leadPt = null;
      this.leadT = 0;
      return;
    }
    if (this.card) return;
    this.leadPt = { x: clamp(x, 2, this.W - 2), y: clamp(y, this.scene === 'nose' ? RULES.epi.y + RULES.epi.h : 2, RULES.wallY - 4) };
    this.leadT = -1;
    // following the finger means dropping a tapped target
    for (const c of this.cells) if ((c.kind === 'neut' || (c.kind === 'mac' && this.stage === 'alarm')) && c.target >= 0 && c.state === 'roam') c.target = -1;
  }

  /** A drag along the vessel stops every rolling cell it passes (the sweep). */
  sweep(x0: number, x1: number): number {
    if (this.card) return 0;
    const lo = Math.min(x0, x1) - 4, hi = Math.max(x0, x1) + 4;
    let n = 0;
    for (const f of this.flow) if (f.state === 'roll' && f.x >= lo && f.x <= hi) { this.arrest(f, true); n++; }
    return n;
  }

  /** The wound can be woven now: the healing stage, or any rest on the skin (the repair starts under the battle). */
  get canWeave(): boolean { return this.scene === 'skin' && (this.stage === 'heal' || this.restBlock); }

  /**
   * A drag across the wound: a fibroblast lays a strand of collagen along it — in the healing stage it closes the
   * wound, in a rest during the battle it adds to the repair prepared under the surface.
   */
  stroke(x0: number, y0: number, x1: number, y1: number): boolean {
    if (this.card || !this.canWeave || this.strokeT > 0 || this.closure >= 1) return false;
    const R = RULES;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 6) return false;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (Math.abs(mx - this.woundX) > 26 || my > 46) return false;
    const f: Fibre = { x1: x0, y1: clamp(y0, 1, 44), x2: x1, y2: clamp(y1, 1, 44), t: 0 };
    this.fibres.push(f);
    if (this.fibres.length > 22) this.fibres.shift();
    this.strokeT = 0.35;
    if (this.stage === 'heal') this.closure = Math.min(1, this.closure + R.heal.stroke * (0.6 + 0.8 * (1 - this.closure)));
    else this.prep = Math.min(R.heal.pre, this.prep + R.heal.stroke * 0.5);
    this.emit({ type: 'collagen', f });
    this.talk.ask('collagen', 1, 4);
    this.fact('kolagen');
    return true;
  }

  /** Space: the burst when it is ready, else the swarm to the nearest target (the vessel's next roller, a body to tidy). */
  key(key: string, down: boolean): boolean {
    if (!down) return key === ' ' || key === 'Spacebar' || key === 'Enter' || key === 'n' || key === 'N' || key === 'b' || key === 'B';
    if (key === 'n' || key === 'N') { this.net(); return true; }
    if (key === 'b' || key === 'B') { this.burst(); return true; }
    if (key !== ' ' && key !== 'Spacebar' && key !== 'Enter') return false;
    if (this.card) { if (this.card.t >= RULES.cardTap) this.closeCard(); return true; }
    if (this.burstReady && this.burstShown) { this.burst(); return true; }
    this.seekNearest();
    return true;
  }

  /** The defenders to the nearest target from where they are. */
  seekNearest(): void {
    if (this.card) return;
    const R = RULES;
    const roller = this.flow.find(f => f.state === 'roll');
    if (roller) this.arrest(roller, true);
    if (this.scene === 'nose') {
      const ts = this.cells.filter(c => c.kind === 'tcell' && c.state === 'roam');
      const cx = ts.length ? ts.reduce((a, c) => a + c.x, 0) / ts.length : this.W / 2;
      let bi = -1, bd = 1e9;
      this.epi.forEach((e, i) => { if (e.state !== 'infected') return; const d = Math.abs(e.x - cx); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) this.tapNose(this.epi[bi].x, R.epi.y);
      return;
    }
    const sw = this.stage === 'alarm' ? this.cells.filter(c => c.kind === 'mac') : this.swarm;
    const cx = sw.length ? sw.reduce((a, c) => a + c.x, 0) / sw.length : this.W / 2;
    const cy = sw.length ? sw.reduce((a, c) => a + c.y, 0) / sw.length : 50;
    const b = this.findBug(cx, cy, 999);
    if (b) {
      this.send(b);
      this.mark = { x: b.x, y: b.y, t: 0 };
      this.emit({ type: 'seek', x: b.x, y: b.y });
      return;
    }
    const body = this.cells.find(c => c.kind === 'neut' && (c.state === 'body' || c.state === 'spent'));
    if (body) this.tap(body.x, body.y);
  }

  /** The respiratory burst: every neutrophil engulfs at once and digests fast for a few seconds. */
  burst(): boolean {
    if (this.card || !this.burstReady || !this.burstShown) {
      if (!this.burstReady) this.emit({ type: 'burstNo' });
      return false;
    }
    this.burstReady = false;
    this.charge = 0;
    this.bursting = RULES.burstSec;
    this.freezeT = 0.08;
    this.burstsNow++;
    this.p.bursts++;
    this.emit({ type: 'burst' });
    this.talk.ask('burst', 3, 5);
    this.fact('wybuch');
    return true;
  }

  /** A NET: the neutrophil nearest the densest cluster of bacteria casts its DNA over it. */
  net(): boolean {
    if (this.card || this.nets <= 0 || !this.netShown) { this.emit({ type: 'netNo' }); return false; }
    const R = RULES;
    const live = this.live;
    if (!live.length) { this.emit({ type: 'netNo' }); return false; }
    const r = netROf(this.p);
    let best = live[0], bn = -1;
    for (const b of live) {
      const n = live.reduce((s, o) => s + (dist(b.x, b.y, o.x, o.y) <= r ? 1 : 0), 0);
      if (n > bn) { bn = n; best = b; }
    }
    const sw = this.swarm;
    let caster: Cell | null = null, cd = 1e9;
    for (const c of sw) { const d = dist(c.x, c.y, best.x, best.y); if (d < cd) { cd = d; caster = c; } }
    this.nets--;
    this.freezeT = 0.07;
    this.netsNow++;
    this.p.nets++;
    this.netsUp.push({ x: best.x, y: best.y, r, life: R.net.life, max: R.net.life });
    for (const b of this.bugs) if (!b.grabbed && !b.hidden && dist(b.x, b.y, best.x, best.y) <= r) b.netted = R.net.dissolve * (0.7 + 0.6 * this.rng());
    if (caster) caster.anucleate = true;
    this.emit({ type: 'net', x: best.x, y: best.y, r });
    this.talk.ask('net', 3, 5);
    this.fact('siec');
    return true;
  }

  // ── output ───────────────────────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The panel's gauge: the alarm in a sighted push past its lead-in, calm in a rest past its lead-in; null blind or without signal. */
  meter(): number | null {
    if (!this.started || !this.reliable || this.phase !== 'play') return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.leadSec ? null : clamp(this.alarm);
    if (this.restBlock) return this.blockT < this.restLead ? null : clamp(this.calm);
    return null;
  }

  /** The pad (when the song is off) follows the alarm in a sighted push, glows mid in the warm-up, holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(this.alarm);
    return null;
  }

  /** The song's level: the focus level in a sighted push, a gentle fixed level in rest and between blocks, null in a blind push. */
  songLevel(f: FocusFrame): number | null {
    if (!this.started) return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.sighted && f.reliable ? clamp(f.level) : 0.4;
    if (this.restBlock) return 0.3;
    return 0.45;
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reached the progress as they happened. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
      p.bestCombo = Math.max(p.bestCombo, this.bestCombo);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.loop'), `${p.loop} · ${stageName(STAGES[p.stage] ?? 'alarm')}`],
      [t('stat.bacteria'), fmtNum(this.bacteria)],
      [t('stat.virus'), fmtNum(this.virusesStopped)],
      [t('stat.combo'), `×${this.bestCombo}`],
      [t('stat.recruits'), fmtNum(this.recruitsAll)],
      [t('stat.stages'), fmtNum(this.stagesNow.length)],
      [t('stat.bursts'), fmtNum(this.burstsNow)],
      [t('stat.nets'), fmtNum(this.netsNow)],
      [t('stat.heal'), fmtNum(this.healedNow)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: the first session
   * (the root, Psalm 103:2-3), a wound closed (Proverbs 17:22), a loop done (Exodus 23:25), the T cells' watch
   * or a memory formed (Psalm 121:7-8), a battle stage won with a burst or a net (Isaiah 54:17); else Psalm 121.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push(ROOT);
    if (this.healedNow > 0) fit.push(CLOSINGS.healed);
    if (this.loopsNow.length) fit.push(CLOSINGS.loop);
    if (this.memoryNow.length || this.stagesNow.some(s => s.stage === 'tcells')) fit.push(CLOSINGS.kept);
    if ((this.burstsNow > 0 || this.netsNow > 0) && this.stagesNow.length) fit.push(CLOSINGS.defence);
    fit.push(CLOSINGS.kept);
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    const lastDone = this.stagesNow.at(-1);
    if (this.healedNow > 0) add(0, t('hl.close.healed'));
    else if (lastDone) add(0, t('hl.close.battle', { stage: stageName(lastDone.stage) }));
    else if (this.started) add(0, t('hl.close.calm'));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(1, t('hl.record', { pathogens: pathogensText(this.score) }));
    else if (this.bestBefore !== null && this.score > 0 && this.bestBefore - this.score <= Math.max(10, this.bestBefore * 0.3)) {
      add(1, t('hl.toBest', { pathogens: pathogensText(this.bestBefore - this.score) }));
    }
    for (const l of this.loopsNow) add(2, t('hl.loop', { place: placeName(loopSpec(l).place) }));
    for (const s of this.stagesNow.filter(x => x.stars > 0).slice(-2)) add(3, t('hl.stage', { stage: stageName(s.stage), stars: starText(s.stars) }));
    for (const id of [...new Set(this.memoryNow)]) add(4, t('hl.memory', { name: pathogenName(id) }));
    for (const id of this.unlocksNow) add(4, t('hl.unlock', { name: unlockName(id) }));
    if (this.factsNow.length) add(5, t('hl.facts', { n: this.factsNow.length }));
    if (this.bestCombo >= 8) add(6, t('hl.combo', { n: this.bestCombo }));
    if (this.blindShare >= 0) add(7, t('hl.blind', { n: this.blindShare }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
