/**
 * Źródła's session rules and state, without the DOM or the canvas (so every rule is unit-tested).
 *
 * The session alternates Nurt (push: the springs pour while the player turns stones) with Sela
 * (rest: the stones lock under a veil and the water soaks into green), ending with a Sela and a six
 * second finale.  One valley per pair: a closed valley gives way to the next one at the next Nurt,
 * an open one carries on with its stones, water and green.
 *
 * The hands build, the band fills.  Every source pours F = (F0 + 0.75·u)·(1 + min(h, 20)/50) jars
 * a second, u coming from the kit's `level` smoothed again (τ 3 s, 1.5 s on EEG) and h from the
 * steady stretch within this Nurt; F0 = 0.25 grows by 0.05 for each Nurt passed (a stone for the
 * well-curb).  The water runs through joined channels at 2.5 cells/s; a component's sources share
 * their water among its full outlets — fields, and leaks that count a quarter — a meeting pool
 * takes ×1.5 and a closed valley ×1.2.  In a Sela the green spreads from every watered field at
 * 0.03 + 0.12·c′ cells/s, c′ coming from the kit's `calm`, up to the field's depth.  The rain of
 * Selas 3, 6, 9 and 12 is given on a schedule, never by the signal.
 *
 * While the signal is unreliable the band's quantities hold for 2 s and then ease to neutral (the
 * water keeps running at F0 + 0.3, the green at 0.078 cells/s); nothing delivered is ever lost, the
 * block clock keeps running, and a block with fewer than 8 reliable seconds ends with no verdict and
 * a top-up to what the neutral strength would have given.  After a long dropout the doubly smoothed
 * level and calm may only rise for 6 s.  Verdicts come from the kit's RoundJudge, one per block, and
 * pay after the judged window: a curb stone at the next Sela's start, a nest at the next Nurt's.
 */
import { fmtNum, fmtSigned } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  ALBUM, BIRDS, DAILY, DEPTHS, DEPTH_NAME, GREEN_CAP, STAGES, TIPS, TREES, TUFT_CAP, VALLEYS_PER_STAGE, ROAD_LENGTH, depthOf, oasisRecipe,
  type Bird,
} from './content';
import { cap, t, unit } from './i18n';
import {
  mergeRoad, minTime, nextSkill, pityDue, plantTree, restoreOpen, roadPlace, roadValley, rollCard,
  type CardRoll, type OpenValley, type RoadValley, type ZrodlaProgress,
} from './meta';
import { BIT, DX, DY, FIELD, Valley, generate, mix } from './valley';

export const RULES = {
  /** blocks (s): Nurt 24 ± 3, Sela 20 ± 3, the telegraph inside the ending block, the finale, never a block under 12 */
  stream: 24,
  streamJitter: 3,
  sela: 20,
  selaJitter: 3,
  pair: 44,
  telegraph: 4,
  finale: 6,
  minBlock: 12,
  /** sessions under a minute: one Nurt of (planned − 18) s and a Sela of 12 */
  shortTail: 18,
  shortSela: 12,
  /** the band, smoothed again: τ on Mendi and on HALO; where L and C start */
  tau: 3,
  tauEeg: 1.5,
  L0: 0.3,
  C0: 0.4,
  uFrom: 0.35,
  cFrom: 0.3,
  span: 0.5,
  /** the springs (jars/s per source) */
  F0: 0.25,
  curb: 0.05,
  curbMax: 6,
  gain: 0.75,
  holdMax: 20,
  holdDiv: 50,
  warmF: 0.6,
  /** the gauge's span: 0.75 × 1.4 */
  phiSpan: 1.05,
  steady: [6, 12, 18],
  /** the green (cells/s) */
  greenBase: 0.03,
  greenGain: 0.12,
  /** the neutral fallback */
  neutral: 0.4,
  neutralTau: 1.5,
  keep: 2,
  recover: 6,
  minReliable: 8,
  /** deep calm: calm ≥ 0.6 for 12 s within one Sela */
  deepCalm: 0.6,
  deepCalmSec: 12,
  rainSelahs: [3, 6, 9, 12],
  rainSec: 5,
  rainJars: 2,
  /** the water's front and its draining (cells/s); a Sela soaks the channels dry at `soak` */
  front: 2.5,
  drain: 5,
  soak: 0.8,
  spill: 0.25,
  meet: 1.5,
  closed: 1.2,
  hintAfter: 10,
  /** "Jeszcze 2 dzbany do pasa" */
  near: 2,
  /** beats at a Nurt's start, the veil's fall, the lesson's last line (s) */
  nestBeat: 1.5,
  slide: 1,
  veilIn: 1.2,
  lessonPour: 4,
  /** the finale's moments (s) */
  finCard: 3,
  finTree: 3.8,
  /** the front's droplets at most this often (s); a field joining chimes again only after a pause in its drinking (s) */
  dripGap: 0.125,
  joinGap: 2,
} as const;

// ── pure rules ───────────────────────────────────────────────────
export type BlockKind = 'warmup' | 'nurt' | 'oaza' | 'sela';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

export const isPush = (k: BlockKind): boolean => k === 'nurt' || k === 'oaza';

/** u from the doubly smoothed level: 0 below 0.35, 1 from 0.85. */
export const uOf = (L: number): number => clamp((L - RULES.uFrom) / RULES.span);
/** c′ from the doubly smoothed calm: 0 below 0.3, 1 from 0.8. */
export const cOf = (C: number): number => clamp((C - RULES.cFrom) / RULES.span);
/** F0 with `stones` curb stones. */
export const baseFlow = (stones: number): number => RULES.F0 + RULES.curb * Math.min(RULES.curbMax, Math.max(0, stones));
/** Jars a second per source. */
export const flowRate = (F0: number, u: number, hold: number): number =>
  (F0 + RULES.gain * clamp(u)) * (1 + Math.min(Math.max(0, hold), RULES.holdMax) / RULES.holdDiv);
/** The green's speed (cells/s). */
export const greenRate = (c: number): number => RULES.greenBase + RULES.greenGain * clamp(c);
/** How far a field's green may spread: by its depth, half a cell while wet below the ankle, none while dry. */
export const greenCap = (jars: number): number => (jars > 0 ? GREEN_CAP[depthOf(jars)] : 0);

/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks.  Under a minute: one Nurt of (planned − 18) s and a Sela of 12 s.  Else
 * pairs of Nurt 24 ± 3 s and Sela 20 ± 3 s scaled to fill all but the finale's 6 s; the first-ever
 * session of 2 min or more opens with "Pierwszy nurt", and with 3 pairs or more the last Nurt is the
 * Oaza.  The last block is always a Sela.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  if (plannedSec < 60) {
    return [
      { kind: 'nurt', dur: Math.max(RULES.minBlock, plannedSec - RULES.shortTail), blind: false },
      { kind: 'sela', dur: RULES.shortSela, blind: false },
    ];
  }
  const left = plannedSec - RULES.finale;
  const pairs = Math.max(1, Math.round(left / RULES.pair));
  const j = left / (pairs * RULES.pair) >= 0.75 ? 1 : 0;
  const durs: number[] = [];
  for (let i = 0; i < pairs; i++) {
    durs.push(RULES.stream + j * (rnd() * 2 - 1) * RULES.streamJitter, RULES.sela + j * (rnd() * 2 - 1) * RULES.selaJitter);
  }
  const scale = left / durs.reduce((s, d) => s + d, 0);
  for (let i = 0; i < durs.length; i++) durs[i] *= scale;
  liftShort(durs, RULES.minBlock);
  const plan: Block[] = durs.map((dur, i) => ({ kind: i % 2 ? 'sela' : 'nurt', dur, blind: false }));
  if (firstEver && plannedSec >= 120) plan[0].kind = 'warmup';
  if (pairs >= 3) plan[plan.length - 2].kind = 'oaza';
  return plan;
}

// ── a valley in play ─────────────────────────────────────────────
export type ValleyKind = 'lesson' | 'road' | 'free' | 'daily' | 'oasis';
export interface Nest { field: number; bird: Bird; young: boolean }

/** One valley with its water and green, as the session plays it. */
export class Run {
  /** per cell: how full its channel is (0..1) */
  readonly wet: Float32Array;
  /** per field: jars held, the depth level announced, this block's jars and what the neutral strength would have given */
  readonly jars: Float64Array;
  readonly level: Uint8Array;
  readonly blockJars: Float64Array;
  readonly cfJars: Float64Array;
  /** per field: the green's radius (cells), and the neutral strength's for this Sela */
  readonly green: Float64Array;
  readonly cfGreen: Float64Array;
  /** per leak spot (cell × 4 + side): jars spilled there, and its green tuft (cells) */
  readonly spilt: Float32Array;
  readonly tuft: Float32Array;
  /** this frame: per field whether it drinks and its share (jars/s per unit of F); per leak spot its share */
  readonly active: Uint8Array;
  readonly share: Float64Array;
  readonly leakShare: Float32Array;
  readonly met: Uint8Array;
  /** per field: when it last started to drink (the session's clock), so a field joining chimes once, not on every flicker */
  readonly joinedAt: Float64Array;
  closed = false;
  /** Stream seconds since it appeared, and when it closed */
  sec = 0;
  closedSec = 0;
  nest: Nest | null = null;
  /** a closed road valley's line in the road (updated until it leaves) */
  entry: RoadValley | null = null;
  /** the "one stone left" line was said for the current state */
  oneLeft = false;
  private readonly outl: Float64Array;
  private readonly fa: Uint8Array;
  private readonly srcs: Uint8Array;

  constructor(readonly kind: ValleyKind, readonly idx: number, readonly seed: number, readonly skill: number, readonly v: Valley) {
    const n = v.n, nf = v.fields.length, nc = Math.max(1, v.sources.length);
    this.wet = new Float32Array(n);
    this.jars = new Float64Array(nf);
    this.level = new Uint8Array(nf);
    this.blockJars = new Float64Array(nf);
    this.cfJars = new Float64Array(nf);
    this.green = new Float64Array(nf);
    this.cfGreen = new Float64Array(nf);
    this.spilt = new Float32Array(n * 4);
    this.tuft = new Float32Array(n * 4);
    this.active = new Uint8Array(nf);
    this.share = new Float64Array(nf);
    this.leakShare = new Float32Array(n * 4);
    this.met = new Uint8Array(nf);
    this.joinedAt = new Float64Array(nf).fill(-Infinity);
    this.outl = new Float64Array(nc);
    this.fa = new Uint8Array(nc * Math.max(1, nf));
    this.srcs = new Uint8Array(Math.max(1, nf));
  }

  /** A road-kind valley: it counts on the road and may wait for the next session when left open. */
  get onRoad(): boolean { return this.kind === 'lesson' || this.kind === 'road' || this.kind === 'free'; }

  /**
   * This frame's shares of one unit of F: every component's sources split their water evenly over
   * its full outlets (each field once, each leak), a field fed by two sources or more takes ×1.5,
   * a closed valley ×1.2.  Fills `share`, `active` and `leakShare`; no garbage.
   */
  shares(): void {
    const f = this.v.flow, nf = this.v.fields.length, wet = this.wet;
    this.outl.fill(0);
    this.fa.fill(0);
    this.srcs.fill(0);
    this.share.fill(0);
    this.active.fill(0);
    this.leakShare.fill(0);
    for (let k = 0; k < f.nOut; k++) {
      if (wet[f.outCell[k]] < 1) continue;
      const c = f.outComp[k], fi = f.outField[k];
      if (fi < 0) this.outl[c]++;
      else if (!this.fa[c * nf + fi]) {
        this.fa[c * nf + fi] = 1;
        this.outl[c]++;
      }
    }
    for (let k = 0; k < f.nOut; k++) {
      if (wet[f.outCell[k]] < 1 || f.outField[k] >= 0) continue;
      const c = f.outComp[k];
      this.leakShare[f.outCell[k] * 4 + f.outDir[k]] += f.compSources[c] / this.outl[c];
    }
    for (let c = 0; c < f.nComps; c++) {
      if (!this.outl[c]) continue;
      const s = f.compSources[c] / this.outl[c];
      for (let fi = 0; fi < nf; fi++) {
        if (!this.fa[c * nf + fi]) continue;
        this.share[fi] += s;
        this.srcs[fi] += f.compSources[c];
        this.active[fi] = 1;
      }
    }
    const bonus = this.closed ? RULES.closed : 1;
    for (let fi = 0; fi < nf; fi++) this.share[fi] *= (this.srcs[fi] >= 2 ? RULES.meet : 1) * bonus;
  }

  /** Sources pouring into field `fi` this frame (after shares()). */
  sourcesInto(fi: number): number { return this.srcs[fi]; }

  /** The deepest level among the fields. */
  get deepest(): number {
    let d = 0;
    for (let fi = 0; fi < this.jars.length; fi++) d = Math.max(d, depthOf(this.jars[fi]));
    return d;
  }

  /** The share of the valley the green covers (0..1), sampled on a 3×3 grid per cell. */
  greenShare(): number {
    const v = this.v, cols = v.cols, rows = v.rows;
    let covered = 0, all = 0;
    for (let y = 0; y < rows * 3; y++) {
      for (let x = 0; x < cols * 3; x++) {
        const px = (x + 0.5) / 3, py = (y + 0.5) / 3;
        all++;
        let hit = false;
        for (let fi = 0; fi < v.fields.length && !hit; fi++) {
          const r = this.green[fi];
          if (r <= 0) continue;
          const c = v.fields[fi], cx = (c % cols) + 0.5, cy = Math.floor(c / cols) + 0.5;
          hit = (px - cx) ** 2 + (py - cy) ** 2 <= (r + 0.5) ** 2;
        }
        for (let k = 0; k < this.tuft.length && !hit; k++) {
          const r = this.tuft[k];
          if (r <= 0) continue;
          const c = k >> 2, d = k & 3;
          const cx = (c % cols) + 0.5 + DX[d] * 0.5, cy = Math.floor(c / cols) + 0.5 + DY[d] * 0.5;
          hit = (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
        }
        if (hit) covered++;
      }
    }
    return all ? covered / all : 0;
  }

  /** What the progress keeps of an open road valley. */
  snapshot(): OpenValley {
    return { idx: this.idx, seed: this.seed, skill: this.skill, rot: this.v.rotations(), jars: Array.from(this.jars), green: Array.from(this.green) };
  }
}

// ── the session ──────────────────────────────────────────────────
export type SimEvent =
  | { type: 'turn'; cell: number; dir: 1 | -1 }
  | { type: 'knock'; cell: number; selah: boolean }
  | { type: 'drip'; cell: number; dist: number }
  | { type: 'join'; field: number }
  | { type: 'meet'; field: number }
  | { type: 'depth'; field: number; level: number }
  | { type: 'closed'; sec: number; hidden: boolean }
  | { type: 'oneLeft' }
  | { type: 'short'; field: number; n: number; level: number }
  | { type: 'steady'; step: number }
  | { type: 'telegraph'; next: Block }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null }
  | { type: 'curb'; stones: number }
  | { type: 'reveal'; fields: number; deepest: number }
  | { type: 'rain' }
  | { type: 'nest'; nest: Nest; upgrade: boolean }
  | { type: 'valley'; kind: ValleyKind; idx: number }
  | { type: 'stage'; stage: number }
  | { type: 'card'; roll: CardRoll }
  | { type: 'tree'; kind: number }
  | { type: 'lesson'; step: LessonStep }
  | { type: 'finale' };

export type LessonStep = 'tap' | 'join' | 'pour' | null;
export type Phase = 'play' | 'finale' | 'done';

export interface SimInit {
  progress: ZrodlaProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning (the kit's defaults, the game's entry, a beginner's bias): the judges follow it */
  tuning: FocusTuning;
}

const NO_EVENTS: readonly SimEvent[] = [];

export class ZrodlaSim {
  readonly p: ZrodlaProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly tau: number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  private readonly events: SimEvent[] = [];

  started = false;
  /** this session's number in the game (1 = the first ever) */
  session = 0;
  /** the day's first session from the second on: "Dolina dnia" comes first */
  dailySession = false;
  plan: Block[] = [];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  tip = '';
  /** Selas begun in this session (the rain falls in the 3rd, 6th, 9th and 12th) */
  selahNo = 0;

  // the band
  L: number = RULES.L0;
  C: number = RULES.C0;
  u = uOf(RULES.L0);
  c = cOf(RULES.C0);
  /** what the water and the green follow: u and c′, eased to neutral while the signal is unreliable */
  uEff = uOf(RULES.L0);
  cEff = cOf(RULES.C0);
  hold = 0;
  holdMul = 1;
  private holdCarry = 0;
  private rawHold = 0;
  private fogT = 0;
  private recover = 0;
  reliable = false;
  /** how deep the haze over the sources is (0..1): the signal failing, told by the scene */
  haze = 0;
  F = 0;
  phi = 0;
  curbStones = 0;
  private steadyStep = 0;
  /** reliable seconds in the block, and the Sela's run of deep calm */
  private reliableT = 0;
  private calmRun = 0;
  private deepCalm = false;
  private curbDue = false;

  // the valley
  run!: Run;
  /** the valley sliding away while the next one comes (the view draws both) */
  prev: Run | null = null;
  /** the open road valley set aside for the Oaza; the saved one waiting behind "Dolina dnia" */
  private stash: Run | null = null;
  private pendingOpen: OpenValley | null = null;
  beat: { kind: 'nest' | 'slide'; t: number; dur: number } | null = null;
  private nestDue: { young: boolean } | null = null;
  private birdTurn = 0;
  veil = 0;
  /** the water's edge, the hint on it, the keyboard cursor */
  edgeCell = -1;
  hintT = 0;
  cursor = -1;
  cursorShown = false;
  lesson: LessonStep = null;
  private lessonT = 0;
  private dripT = 0;
  /** seconds since start() */
  private clock = 0;

  // the session's tallies
  /** jars delivered this session (field intake, a quarter of spills, rain, top-ups); the score is its floor */
  jars = 0;
  /** the jar count on screen: held still in a blind Nurt */
  shownJars = 0;
  private wasBlind = false;
  valleysClosed = 0;
  nestsBuilt = 0;
  private youngNow = 0;
  pushesBegun = 0;
  streamsJudged = 0;
  streamsPassed = 0;
  selahsJudged = 0;
  selahsPassed = 0;
  private deepCalmAny = false;
  private riverNow = false;
  private greenHalf = false;
  private readonly stagesDone: number[] = [];
  /** the session's fastest close of a 5×5 or larger road or daily valley (the record), and of any road or daily valley (the summary) */
  private fastestNow = 0;
  private fastestAny = 0;
  steadyBest = 0;
  deepestJars = 0;
  deepestLevel = 0;
  private dailyClosedSec = 0;
  private revealLine = '';
  roadIndex = 0;
  skill = 0;
  private readonly closedRoad: RoadValley[] = [];
  cardRoll: CardRoll | null = null;
  treeNow: number | null = null;
  private rolled = false;
  private planted = false;
  /** the progress as it was at the start: the counters are base + session, the records compare with it */
  private base!: Pick<ZrodlaProgress, 'jars' | 'valleys' | 'nests' | 'pushes' | 'fastest' | 'dailyBest' | 'deepestJars' | 'steady' | 'road'>;
  private bestBefore: number | null = null;

  constructor(private readonly init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.tau = init.eeg ? RULES.tauEeg : RULES.tau;
    this.judge = RoundJudge.from(init.tuning);
    this.run = new Run('lesson', 0, 0, 0, roadValley(0, 0));
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get score(): number { return Math.floor(this.jars + 1e-9); }
  get F0(): number { return baseFlow(this.curbStones); }
  /** a Nurt, Oaza or the warm-up, in play, with no beat: the springs pour and the stones turn */
  get flowing(): boolean { return this.started && this.phase === 'play' && this.block.kind !== 'sela' && !this.beat; }
  get blind(): boolean { return this.phase === 'play' && this.block?.kind === 'nurt' && this.block.blind; }
  /** the hint's glow is on (the lesson's from the start) */
  get hint(): number {
    if (!this.flowing || this.run.closed) return -1;
    return this.run.kind === 'lesson' || this.hintT >= RULES.hintAfter ? this.edgeCell : -1;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    const p = this.p, day = this.init.day;
    this.session = p.sessions + 1;
    this.bestBefore = p.sessions > 0 ? p.bestSession : null;
    this.base = { jars: p.jars, valleys: p.valleys, nests: p.nests, pushes: p.pushes, fastest: p.fastest, dailyBest: p.dailyBest, deepestJars: p.deepestJars, steady: p.steady, road: p.road.slice() };
    this.roadIndex = p.roadIndex;
    this.skill = Math.max(-1, Math.min(2, Math.round(p.skill) || 0));
    this.dailySession = this.session >= 2 && p.dailyDay !== day;
    this.pendingOpen = p.open && p.open.idx === p.roadIndex ? p.open : null;
    this.plan = planBlocks(this.plannedSec, this.session === 1, this.rng);
    this.run = this.dailySession ? this.dailyRun() : this.nextRun();
    this.startBlock(0);
    this.valleyAppeared();
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0) || this.phase === 'done') return;
    this.clock += dt;
    this.reliable = f.reliable;
    this.haze = approach(this.haze, f.reliable ? 0 : 1, dt, 0.7);
    this.brain(dt, f);
    if (this.phase === 'finale') {
      this.phaseT += dt;
      this.veil = Math.min(1, this.veil + dt / RULES.veilIn);
      if (this.phaseT >= RULES.finCard) this.rollAlbum();
      if (this.phaseT >= RULES.finTree) this.plantGift();
      if (this.phaseT >= RULES.finale) this.phase = 'done';
      this.soak(dt);
      return;
    }
    this.schedule(dt, f, t);
    this.pour();
    if (this.phase !== 'play') return;
    this.beats(dt);
    this.water(dt);
    this.growGreen(dt);
    this.veil = this.veilNow();
    if (this.flowing && !this.run.closed) {
      this.run.sec += dt;
      this.hintT += dt;
    }
    if (this.lesson === 'pour' && (this.lessonT += dt) >= RULES.lessonPour) this.setLesson(null);
    if (!this.blind) this.shownJars = this.score;
  }

  /**
   * The band's slow quantities.  L and C follow the level and the calm in every block (silently
   * where they show nothing), so every block starts honestly.  While the signal is unreliable they
   * hold, and what the water and the green follow eases to neutral after 2 s; after a long dropout
   * L and C may only rise for 6 s, and a steady stretch the gap broke carries on.
   */
  private brain(dt: number, f: FocusFrame): void {
    const R = RULES;
    if (!f.reliable) {
      this.fogT += dt;
      if (this.fogT > R.keep) {
        this.uEff = approach(this.uEff, R.neutral, dt, R.neutralTau);
        this.cEff = approach(this.cEff, R.neutral, dt, R.neutralTau);
        this.holdMul = approach(this.holdMul, 1, dt, R.neutralTau);
      }
    } else {
      if (this.fogT > 0) {
        if (this.fogT >= R.keep) this.recover = R.recover;
        if (f.hold < this.rawHold) this.holdCarry += this.rawHold;
        this.fogT = 0;
      } else this.recover = Math.max(0, this.recover - dt);
      if (!f.focused && this.recover <= 0) this.holdCarry = 0;
      this.rawHold = f.hold;
      const L = approach(this.L, clamp(f.level), dt, this.tau), C = approach(this.C, clamp(f.calm), dt, this.tau);
      this.L = this.recover > 0 ? Math.max(this.L, L) : L;
      this.C = this.recover > 0 ? Math.max(this.C, C) : C;
      this.u = uOf(this.L);
      this.c = cOf(this.C);
      this.uEff = approach(this.uEff, this.u, dt, 0.3);
      this.cEff = approach(this.cEff, this.c, dt, 0.3);
      const push = this.phase === 'play' && isPush(this.block.kind);
      this.hold = push ? Math.min(this.holdCarry + f.hold, this.blockT) : 0;
      this.holdMul = approach(this.holdMul, 1 + Math.min(this.hold, R.holdMax) / R.holdDiv, dt, 0.4);
      if (push && !this.block.blind) {
        this.steadyBest = Math.max(this.steadyBest, this.hold);
        const step = R.steady.filter(s => this.hold >= s).length;
        if (step > this.steadyStep) this.emit({ type: 'steady', step });
        this.steadyStep = step;
      }
    }
  }

  /** How much each source pours now (F) and the gauge's reading (φ), for the block as it stands. */
  private pour(): void {
    const R = RULES, k = this.phase === 'play' ? this.block.kind : 'sela';
    if (!isPush(k)) this.hold = 0;
    this.F = k === 'warmup' ? R.warmF : isPush(k) ? (this.F0 + R.gain * this.uEff) * this.holdMul : 0;
    this.phi = isPush(k) ? clamp((this.F - this.F0) / R.phiSpan) : k === 'warmup' ? 0.5 : 0;
  }

  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block;
    this.blockT += dt;
    if (f.reliable) this.reliableT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'sela' ? 'rest' : 'focus';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'sela' && f.reliable) {
      // while the kit's calm climbs back after a dropout, a dip does not break the run
      if (f.calm >= RULES.deepCalm) this.calmRun += dt;
      else if (this.recover <= 0) this.calmRun = 0;
      if (this.calmRun >= RULES.deepCalmSec) this.deepCalm = this.deepCalmAny = true;
    }
    const last = this.blockIndex >= this.plan.length - 1;
    if (!last && !this.telegraphed && this.blockT >= b.dur - RULES.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: this.plan[this.blockIndex + 1] });
    }
    if ((last && this.blockT >= b.dur) || t >= this.plannedSec - RULES.finale) {
      this.endBlock();
      this.startFinale();
    } else if (!last && this.blockT >= b.dur) {
      this.endBlock();
      this.startBlock(this.blockIndex + 1);
    }
  }

  private startBlock(i: number): void {
    this.blockIndex = i;
    this.blockT = 0;
    this.reliableT = 0;
    this.telegraphed = false;
    this.judge.reset();
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind || (isPush(x.kind) && isPush(b.kind)));
    if (b.kind === 'nurt' && i > 0) {
      // every 4th eligible Nurt (not the session's first, not the warm-up, not the Oaza) runs underground, from the 4th session
      this.pushesBegun++;
      b.blind = this.session >= 4 && (this.base.pushes + this.pushesBegun) % 4 === 0;
    }
    const list = b.kind === 'sela' ? TIPS.sela : b.blind ? TIPS.blind : TIPS.nurt;
    this.tip = b.kind === 'warmup' ? TIPS.warmup
      : b.kind === 'oaza' ? TIPS.oaza
        : first && this.session <= 2 && !b.blind ? (b.kind === 'sela' ? TIPS.firstSela : TIPS.firstNurt)
          : list[(this.session - 1 + i) % list.length];
    this.emit({ type: 'blockStart', block: b, index: i });
    if (b.kind === 'sela') {
      this.selahNo++;
      this.calmRun = 0;
      this.deepCalm = false;
      this.hold = 0;
      this.run.cfGreen.set(this.run.green);
      // after the judged window, in order: the water surfaces, the curb stone is laid, the rain comes
      if (this.wasBlind) this.revealBlind();
      if (this.curbDue) {
        this.curbDue = false;
        this.curbStones = Math.min(RULES.curbMax, this.curbStones + 1);
        this.emit({ type: 'curb', stones: this.curbStones });
      }
      if ((RULES.rainSelahs as readonly number[]).includes(this.selahNo)) this.emit({ type: 'rain' });
    } else {
      this.holdCarry = 0;
      this.steadyStep = 0;
      this.wasBlind = b.blind;
      this.shownJars = this.score;
      if (i > 0) this.nextValleyBeat(b);
      this.run.blockJars.fill(0);
      this.run.cfJars.fill(0);
    }
  }

  /**
   * A Nurt begins after a Sela: the pair that earned its nest lands in the valley's greenest spot;
   * then a closed valley (or any, before the Oaza) gives way to the next one — after the nest's beat,
   * with a short slide.  An open road valley before the Oaza waits for the next session.
   */
  private nextValleyBeat(b: Block): void {
    const nest = this.landNest();
    const oaza = b.kind === 'oaza';
    if (!this.run.closed && !oaza) return;
    if (nest) {
      this.beat = { kind: 'nest', t: 0, dur: RULES.nestBeat };
      return;
    }
    this.switchValley();
  }

  private switchValley(): void {
    const old = this.run, oaza = this.phase === 'play' && this.block.kind === 'oaza';
    this.retire(old);
    if (oaza && !old.closed && old.onRoad) this.stash = old;
    this.prev = old;
    this.run = oaza ? this.oasisRun() : this.nextRun();
    this.beat = { kind: 'slide', t: 0, dur: RULES.slide };
    this.valleyAppeared();
  }

  private beats(dt: number): void {
    const b = this.beat;
    if (!b) return;
    b.t += dt;
    if (b.t < b.dur) return;
    if (b.kind === 'nest') this.switchValley();
    else {
      this.beat = null;
      this.prev = null;
    }
  }

  private endBlock(): void {
    const b = this.block, enough = this.reliableT >= RULES.minReliable;
    let verdict: boolean | null = null;
    if (b.kind === 'warmup') {
      // the warm-up is a no-feedback pre-run: not judged
    } else if (isPush(b.kind)) {
      verdict = enough ? this.judge.verdict() : null;
      if (verdict !== null) this.streamsJudged++;
      if (verdict) {
        this.streamsPassed++;
        this.curbDue = true;
      }
      if (!enough) this.topUpWater();
      if (!b.blind && !this.beat) this.nearMiss();
    } else {
      verdict = enough ? this.judge.verdict() : null;
      if (verdict !== null) this.selahsJudged++;
      if (verdict) this.selahsPassed++;
      if (!enough) this.topUpGreen();
      // the very first Sela always brings the sparrows
      const firstEver = this.session === 1 && this.selahNo === 1;
      if (verdict || firstEver) this.nestDue = { young: !!verdict && this.deepCalm };
      if (this.run.greenShare() >= 0.5) this.greenHalf = true;
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict });
  }

  /** "Jeszcze 2 dzbany do pasa": the field closest to its next depth, within two jars. */
  private nearMiss(): void {
    const r = this.run;
    let best = -1, need = Infinity, lvl = 0;
    for (let fi = 0; fi < r.jars.length; fi++) {
      const d = depthOf(r.jars[fi]);
      if (d >= DEPTHS.length || r.jars[fi] <= 0) continue;
      const gap = DEPTHS[d] - r.jars[fi];
      if (gap > 0 && gap <= RULES.near && gap < need) {
        best = fi;
        need = gap;
        lvl = d + 1;
      }
    }
    if (best >= 0) this.emit({ type: 'short', field: best, n: Math.ceil(need), level: lvl });
  }

  /** A Nurt short of reliable time: each field gets at least what the neutral strength would have given it. */
  private topUpWater(): void {
    const r = this.run;
    for (let fi = 0; fi < r.jars.length; fi++) {
      const add = r.cfJars[fi] - r.blockJars[fi];
      if (add <= 0) continue;
      r.jars[fi] += add;
      r.blockJars[fi] += add;
      this.addJars(add);
      this.depthCheck(fi);
    }
  }

  /** A Sela short of reliable time: each field's green reaches at least the neutral strength's. */
  private topUpGreen(): void {
    const r = this.run;
    for (let fi = 0; fi < r.green.length; fi++) r.green[fi] = Math.max(r.green[fi], r.cfGreen[fi]);
  }

  /** The water, hidden under the rock during the blind Nurt, surfaces at the Sela's start. */
  private revealBlind(): void {
    this.wasBlind = false;
    const r = this.run;
    let fields = 0;
    for (let fi = 0; fi < r.blockJars.length; fi++) if (r.blockJars[fi] > 0) fields++;
    for (let fi = 0; fi < r.jars.length; fi++) this.depthCheck(fi, true);
    const deepest = r.deepest;
    this.revealLine = fields > 0 ? t('card.reveal', { n: fields, depth: DEPTH_NAME[Math.max(1, deepest)] }) : t('card.revealNone');
    this.emit({ type: 'reveal', fields, deepest });
    this.shownJars = this.score;
  }

  private landNest(): boolean {
    const due = this.nestDue;
    if (!due) return false;
    this.nestDue = null;
    const r = this.run;
    if (r.nest) {
      // one pair per valley: a second calm Sela over the same valley raises young in its nest
      if (r.nest.young) return false;
      r.nest.young = true;
      this.youngNow++;
      this.emit({ type: 'nest', nest: r.nest, upgrade: true });
      this.syncEntry(r);
      return true;
    }
    let field = 0;
    for (let fi = 1; fi < r.green.length; fi++) if (r.green[fi] > r.green[field]) field = fi;
    const bird = BIRDS[this.birdTurn++ % BIRDS.length];
    r.nest = { field, bird, young: due.young };
    this.nestsBuilt++;
    if (due.young) this.youngNow++;
    this.emit({ type: 'nest', nest: r.nest, upgrade: false });
    this.syncEntry(r);
    return true;
  }

  private startFinale(): void {
    this.phase = 'finale';
    this.phaseT = 0;
    this.F = this.phi = this.hold = 0;
    this.beat = null;
    this.prev = null;
    this.landNest();
    this.retire(this.run);
    this.emit({ type: 'finale' });
  }

  /**
   * The session ends before its finale ("Zakończ i zapisz", the overtime limit): settle as the
   * finale would — the open block is judged (a blind Nurt's water surfaces), its nest lands, the
   * album rolls once and the day's tree is planted once.  The view is gone by then: no animation.
   */
  finish(): void {
    if (!this.started || this.phase === 'done') return;
    if (this.phase === 'play') {
      this.endBlock();
      if (this.wasBlind) this.revealBlind();
      this.landNest();
      this.retire(this.run);
    }
    this.rollAlbum();
    this.plantGift();
    this.phase = 'done';
    this.shownJars = this.score;
  }

  // ── the valleys ─────────────────────────────────────────────────
  private dailyRun(): Run {
    return new Run('daily', -1, this.init.daySeed, 0, generate(DAILY, this.init.daySeed));
  }

  private oasisRun(): Run {
    const seed = mix(Math.floor(this.rng() * 0xffffffff), 0x0a515);
    return new Run('oasis', -1, seed, 0, generate(oasisRecipe(this.roadIndex), seed));
  }

  /** The saved open road valley if it waits, else the road's next valley. */
  private nextRun(): Run {
    const o = this.pendingOpen;
    this.pendingOpen = null;
    const back = o && o.idx === this.roadIndex ? restoreOpen(o) : null;
    if (back && o) {
      const r = this.roadRun(o.idx, o.skill, back.valley);
      back.jars.forEach((j, fi) => {
        r.jars[fi] = j;
        r.level[fi] = depthOf(j);
      });
      back.green.forEach((g, fi) => { r.green[fi] = g; });
      return r;
    }
    return this.roadRun(this.roadIndex, this.skill);
  }

  private roadRun(idx: number, skill: number, v = roadValley(idx, skill)): Run {
    const kind: ValleyKind = idx === 0 ? 'lesson' : idx >= ROAD_LENGTH ? 'free' : 'road';
    return new Run(kind, idx, roadPlace(idx).seed, skill, v);
  }

  /** A valley comes into play: the cursor and the hint start at the water's edge; the lesson speaks. */
  private valleyAppeared(): void {
    const r = this.run;
    this.edgeCell = r.v.edge();
    this.cursor = this.edgeCell >= 0 ? this.edgeCell : r.v.fields[0] ?? 0;
    this.hintT = 0;
    this.emit({ type: 'valley', kind: r.kind, idx: r.idx });
    this.setLesson(r.kind === 'lesson' && !r.closed ? 'tap' : null);
  }

  /** A valley leaves (or the session ends): its line in the road gets its final green and nest. */
  private retire(r: Run): void {
    this.syncEntry(r);
    if (r.greenShare() >= 0.5) this.greenHalf = true;
  }

  private syncEntry(r: Run): void {
    const e = r.entry;
    if (!e) return;
    e.d = r.deepest;
    e.g = Math.round(r.greenShare() * 100);
    e.n = r.nest ? (r.nest.bird === 'sparrow' ? 1 : 2) : 0;
    e.y = r.nest?.young ? 1 : 0;
  }

  private setLesson(step: LessonStep): void {
    if (step === this.lesson) return;
    this.lesson = step;
    this.lessonT = 0;
    this.emit({ type: 'lesson', step });
  }

  // ── the hands ───────────────────────────────────────────────────
  /** A tap on cell `cell` (−1: off the board): the stone turns a quarter clockwise, or knocks. */
  tap(cell: number): void {
    if (cell < 0 || cell >= this.run.v.n || !this.started) return;
    this.turnAt(cell, 1);
  }

  /** Space, Enter, E (1) or Q (−1): turn the cursor's stone; the first key press shows the cursor. */
  turnCursor(dir: 1 | -1): void {
    if (!this.started) return;
    this.cursorShown = true;
    if (this.cursor < 0) return;
    const c = this.cursor, before = this.passes(c);
    if (!this.turnAt(c, dir)) return;
    // the water passes through the cursor's stone now: the cursor hops on to the new water's edge
    if (!before && this.passes(c) && this.edgeCell >= 0) this.cursor = this.edgeCell;
  }

  /** The arrows move the cursor (auto-repeat allowed); the first key press shows it. */
  moveCursor(dx: number, dy: number): void {
    if (!this.started) return;
    this.cursorShown = true;
    const v = this.run.v;
    const c = Math.max(0, this.cursor);
    const x = Math.max(0, Math.min(v.cols - 1, (c % v.cols) + dx)), y = Math.max(0, Math.min(v.rows - 1, Math.floor(c / v.cols) + dy));
    this.cursor = y * v.cols + x;
  }

  /** Water reaches this stone and none of its channels leaks. */
  private passes(cell: number): boolean {
    const f = this.run.v.flow;
    if (f.comp[cell] < 0) return false;
    for (let k = 0; k < f.nOut; k++) if (f.outCell[k] === cell && f.outField[k] < 0) return false;
    return true;
  }

  private turnAt(cell: number, dir: 1 | -1): boolean {
    const r = this.run, v = r.v;
    const selah = this.phase === 'play' && this.block.kind === 'sela';
    if (!this.flowing || r.closed || !v.turnable(cell)) {
      this.emit({ type: 'knock', cell, selah });
      return false;
    }
    v.turn(cell, dir);
    this.hintT = 0;
    this.emit({ type: 'turn', cell, dir });
    if (this.lesson === 'tap') this.setLesson('join');
    if (v.closed) this.close();
    else {
      const f = v.flow;
      const one = f.leaks === 1 && f.reachedFields === v.fields.length - 1;
      if (one && !r.oneLeft) this.emit({ type: 'oneLeft' });
      r.oneLeft = one;
    }
    this.edgeCell = v.closed ? -1 : v.edge();
    return true;
  }

  /** Every field reached and nothing leaks: the stones set, the bonus runs, the road counts it. */
  private close(): void {
    const r = this.run;
    r.closed = true;
    r.closedSec = r.sec;
    this.valleysClosed++;
    this.emit({ type: 'closed', sec: r.sec, hidden: this.blind });
    if (r.kind === 'lesson') this.setLesson('pour');
    if (r.onRoad) {
      this.roadIndex = Math.max(this.roadIndex, r.idx + 1);
      r.entry = { i: r.idx, d: r.deepest, g: 0, n: 0, y: 0 };
      this.closedRoad.push(r.entry);
      if (r.kind !== 'lesson') this.skill = nextSkill(this.skill, r.sec, RULES.stream);   // three taps say little about a hand
      if (r.idx < ROAD_LENGTH && (r.idx + 1) % VALLEYS_PER_STAGE === 0) {
        const stage = Math.floor(r.idx / VALLEYS_PER_STAGE);
        this.stagesDone.push(stage);
        this.emit({ type: 'stage', stage });
      }
    }
    if (r.kind === 'daily' && !this.dailyClosedSec) this.dailyClosedSec = Math.max(1, Math.round(r.sec));
    const timed = (r.onRoad && r.kind !== 'lesson') || r.kind === 'daily', s = Math.max(1, Math.round(r.sec));
    if (timed) this.fastestAny = minTime(this.fastestAny, s);
    if (timed && r.v.cols * r.v.rows >= 25) this.fastestNow = minTime(this.fastestNow, s);
  }

  // ── the water ───────────────────────────────────────────────────
  private water(dt: number): void {
    const r = this.run, v = r.v, f = v.flow, wet = r.wet;
    if (!this.flowing) {
      this.soak(dt);
      return;
    }
    // the front: a stone fills once the stone its water comes from is full; cut-off channels drain
    for (let i = 0; i < v.n; i++) if (f.comp[i] < 0 && wet[i] > 0) wet[i] = Math.max(0, wet[i] - RULES.drain * dt);
    this.dripT -= dt;
    for (let k = 0; k < f.count; k++) {
      const i = f.order[k], up = f.from[i];
      if (wet[i] >= 1 || (up >= 0 && wet[up] < 1)) continue;
      wet[i] = Math.min(1, wet[i] + RULES.front * dt);
      if (wet[i] >= 1 && this.dripT <= 0 && !this.blind) {
        this.dripT = RULES.dripGap;
        this.emit({ type: 'drip', cell: i, dist: f.dist[i] });
      }
    }
    r.shares();
    const F = this.F, Fcf = this.F0 + RULES.gain * RULES.neutral, warm = this.block.kind === 'warmup';
    const blind = this.blind;
    for (let fi = 0; fi < r.jars.length; fi++) {
      if (!r.active[fi]) continue;
      if (!blind && this.clock - r.joinedAt[fi] > RULES.joinGap) this.emit({ type: 'join', field: fi });
      r.joinedAt[fi] = this.clock;
      if (r.sourcesInto(fi) >= 2 && !r.met[fi]) {
        r.met[fi] = 1;
        if (!blind) this.emit({ type: 'meet', field: fi });
      }
      const add = F * r.share[fi] * dt;
      r.jars[fi] += add;
      r.blockJars[fi] += add;
      if (!warm) r.cfJars[fi] += Fcf * r.share[fi] * dt;
      this.addJars(add);
      this.depthCheck(fi);
    }
    for (let k = 0; k < r.leakShare.length; k++) {
      const s = r.leakShare[k];
      if (s <= 0) continue;
      const spill = F * s * dt;
      r.spilt[k] += spill;
      this.addJars(spill * RULES.spill);
    }
  }

  /** In a Sela (and the finale) the channels' water soaks away; the fields keep theirs. */
  private soak(dt: number): void {
    const wet = this.run.wet;
    for (let i = 0; i < wet.length; i++) if (wet[i] > 0) wet[i] = Math.max(0, wet[i] - RULES.soak * dt);
  }

  private addJars(n: number): void {
    this.jars += n;
  }

  /** A field crossed a depth: announced at once in sight, kept for the reveal under the rock. */
  private depthCheck(fi: number, reveal = false): void {
    const r = this.run, d = depthOf(r.jars[fi]);
    this.deepestJars = Math.max(this.deepestJars, r.jars[fi]);
    this.deepestLevel = Math.max(this.deepestLevel, d);
    if (d >= 4) this.riverNow = true;
    if (d <= r.level[fi] || (this.blind && !reveal)) return;
    r.level[fi] = d;
    if (r.entry) r.entry.d = Math.max(r.entry.d, d);
    this.emit({ type: 'depth', field: fi, level: d });
  }

  /** The Sela's green (and the rain in the 3rd, 6th, 9th and 12th Sela's first 5 s). */
  private growGreen(dt: number): void {
    if (this.phase !== 'play' || this.block.kind !== 'sela') return;
    const r = this.run, nf = r.jars.length;
    if ((RULES.rainSelahs as readonly number[]).includes(this.selahNo) && this.blockT <= RULES.rainSec) {
      const add = (RULES.rainJars / RULES.rainSec) * Math.min(dt, RULES.rainSec - (this.blockT - dt));
      for (let fi = 0; fi < nf; fi++) {
        if (add <= 0) break;
        r.jars[fi] += add;
        this.addJars(add);
        this.depthCheck(fi);
      }
    }
    const g = greenRate(this.cEff), gcf = greenRate(RULES.neutral);
    for (let fi = 0; fi < nf; fi++) {
      const capR = greenCap(r.jars[fi]);
      if (r.green[fi] < capR) r.green[fi] = Math.min(capR, r.green[fi] + g * dt);
      if (r.cfGreen[fi] < capR) r.cfGreen[fi] = Math.min(capR, r.cfGreen[fi] + gcf * dt);
    }
    for (let k = 0; k < r.spilt.length; k++) if (r.spilt[k] > 0 && r.tuft[k] < TUFT_CAP) r.tuft[k] = Math.min(TUFT_CAP, r.tuft[k] + g * dt);
  }

  /**
   * The veil over the stones (0..1): it falls over 1.2 s as a Sela begins, and lifts across the
   * telegraph to the next Nurt only for an open valley (still unreadable for its first 2.5 s); a
   * closed valley stays veiled until it slides away.
   */
  private veilNow(): number {
    const b = this.block;
    if (b.kind === 'sela') {
      const down = Math.min(1, this.blockT / RULES.veilIn);
      const toGo = b.dur - this.blockT;
      if (this.run.closed || toGo > RULES.telegraph || this.blockIndex >= this.plan.length - 1) return down;
      const k = clamp(1 - toGo / RULES.telegraph);
      return Math.min(down, 1 - k * k * k);
    }
    if (this.beat?.kind === 'nest') return 1;
    return 0;
  }

  // ── the finale's gifts ──────────────────────────────────────────
  /** The album's one roll of the session: with a closed valley, or when pity is due. */
  private rollAlbum(): void {
    if (this.rolled) return;
    this.rolled = true;
    if (this.valleysClosed < 1 && !pityDue(this.p, this.session)) return;
    this.cardRoll = rollCard(this.p, this.rng, this.session, this.deepCalmAny);
    this.emit({ type: 'card', roll: this.cardRoll });
  }

  /** The day's tree, the same for everyone, planted by the first session of the day. */
  private plantGift(): void {
    if (this.planted) return;
    this.planted = true;
    this.treeNow = plantTree(this.p, this.init.day, this.init.daySeed);
    if (this.treeNow !== null) this.emit({ type: 'tree', kind: this.treeNow });
  }

  // ── output ──────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  /** The events since the last call, oldest first (most frames have none: then nothing is allocated). */
  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /**
   * What the ambient pad's brightness follows (kit/types.ts): how much water runs in a sighted Nurt
   * or the Oaza, steady in the warm-up; held still in a blind Nurt, a Sela, the finale and while the
   * signal is unreliable, so no live feedback reaches the sound where the screen shows none.
   */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    const b = this.block;
    if (b.kind === 'warmup') return 0.5;
    if (b.kind === 'sela' || this.blind) return null;
    return this.phi;
  }

  /** Time is up: the session may stop once the finale has played. */
  canStop(): boolean { return this.phase === 'done'; }

  /** The road valley to keep for the next session (null: none open). */
  private openToSave(): OpenValley | null {
    if (this.run.onRoad && !this.run.closed) return this.run.snapshot();
    if (this.stash && !this.stash.closed) return this.stash.snapshot();
    return this.pendingOpen;
  }

  /**
   * The session's numbers, idempotent.  Only a saved session calls it for good, so the session's
   * counters reach the progress here as base + session, the road and the open valley as assignments
   * recomputed from the session, and the records with Math.max / the smaller time.
   */
  result(): ArcadeOutcome {
    const p = this.p, score = this.score;
    if (this.started) {
      const b = this.base;
      p.sessions = Math.max(p.sessions, this.session);
      p.jars = Math.max(p.jars, b.jars + score);
      p.valleys = Math.max(p.valleys, b.valleys + this.valleysClosed);
      p.nests = Math.max(p.nests, b.nests + this.nestsBuilt);
      p.pushes = Math.max(p.pushes, b.pushes + this.pushesBegun);
      p.roadIndex = Math.max(p.roadIndex, this.roadIndex);
      p.road = mergeRoad(b.road, this.closedRoad);
      p.open = this.openToSave();
      p.skill = this.skill;
      if (this.dailySession) {
        p.dailyDay = this.init.day;
        p.dailySec = this.dailyClosedSec;
        p.dailyBest = minTime(b.dailyBest, this.dailyClosedSec);
      }
      p.lastDay = this.init.day;
      p.fastest = minTime(b.fastest, this.fastestNow);
    }
    const deepJars = Math.floor(this.deepestJars + 1e-9);
    p.bestSession = Math.max(p.bestSession, score);
    p.deepestJars = Math.max(p.deepestJars, deepJars);
    p.deepest = Math.max(p.deepest, this.deepestLevel);
    p.steady = Math.max(p.steady, Math.floor(this.steadyBest));
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    if (c !== null) p.rytm = p.rytm === null ? c : Math.max(p.rytm, c);
    const sec = (s: number) => t('sec', { n: fmtNum(Math.round(s)) });
    const stats: [string, string][] = [
      [t('stat.valleys'), String(this.valleysClosed)],
      [t('stat.deepest'), this.deepestLevel ? cap(DEPTH_NAME[this.deepestLevel]) : '—'],
      [t('stat.nests'), String(this.nestsBuilt)],
      [t('stat.curb'), this.streamsJudged ? `${this.streamsPassed}/${this.streamsJudged}` : '—'],
      [t('stat.sela'), this.selahsJudged ? `${this.selahsPassed}/${this.selahsJudged}` : '—'],
      [t('stat.rytm'), c === null ? '—' : t('pct', { n: c === 0 ? fmtNum(0, 1) : fmtSigned(c, 1) })],
      [t('stat.fastest'), this.fastestAny ? sec(this.fastestAny) : '—'],
      [t('stat.steady'), sec(this.steadyBest)],
    ];
    return {
      score, unit: unit(score), record: this.bestBefore !== null && score > this.bestBefore,
      stats, highlights: this.highlights(deepJars), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage (kit/scripture.ts), one of those the session fits, best fit first,
   * in turn from session to session.  The lobby already opens with Psalm 84:5-6.
   */
  closingVerse(): PassageId {
    return inTurn(this.verseFit(), Math.max(1, this.session));
  }

  /** The passages this session fits, best first (the last two always). */
  verseFit(): PassageId[] {
    const fit: PassageId[] = [];
    if (this.stagesDone.length) fit.push('psa121.1-2');
    if (this.riverNow) fit.push('isa35.7');
    if (this.nestsBuilt > 0) fit.push('psa84.3');
    if (this.valleysClosed > 0) fit.push('isa41.18');
    if (this.greenHalf) fit.push('1co3.6');
    if (this.streamsPassed > 0) fit.push('psa1.2-3');
    fit.push('isa58.11', 'psa23.1-3');
    return fit;
  }

  /** At most five lines for the summary, the best moments first. */
  private highlights(deepJars: number): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    const roll = this.cardRoll;
    if (roll) {
      if (roll.kind === 'new' || roll.kind === 'dawn') add(0, t(roll.kind === 'dawn' ? 'hl.cardDawn' : 'hl.card', { name: ALBUM[roll.id].name }));
      if (roll.crafted !== null) add(0, t('hl.card', { name: ALBUM[roll.crafted].name }));
    }
    for (const s of this.stagesDone) add(1, t('hl.stage', { n: s + 1, name: STAGES[s].name }));
    if (this.bestBefore !== null) {
      const b = this.base, one: string[] = [], part: string[] = [];
      const sec = (s: number) => t('sec', { n: fmtNum(s) });
      if (this.score > this.bestBefore) {
        part.push(t('rec.jars', { jars: t('jars', { n: this.score }) }));
      }
      if (this.fastestNow > 0 && b.fastest > 0 && this.fastestNow < b.fastest) part.push(t('rec.fastest', { sec: sec(this.fastestNow) }));
      if (b.deepestJars > 0 && deepJars > b.deepestJars) part.push(t('rec.deepest', { jars: t('jars', { n: deepJars }) }));
      if (b.steady > 0 && Math.floor(this.steadyBest) > b.steady) part.push(t('rec.steady', { sec: sec(Math.floor(this.steadyBest)) }));
      for (const x of part) one.push(t('hl.record', { what: x }));
      if (part.length) add(2, part.length === 1 ? one[0] : t('hl.records', { list: part.join(', ') }));
    }
    if (this.riverNow) add(3, t('hl.river'));
    if (this.youngNow > 0) add(4, t('hl.young'));
    if (this.dailyClosedSec > 0) add(5, t('hl.daily', { sec: t('sec', { n: fmtNum(this.dailyClosedSec) }) }));
    if (this.revealLine) add(6, this.revealLine);
    if (this.treeNow !== null) add(7, t('hl.tree', { tree: TREES[this.treeNow].name }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}

/** A field cell's side that the water comes in from (the inlet stone's side), for the picture: −1 none. */
export function inletSide(v: Valley, fi: number): number {
  const cell = v.fields[fi], f = v.flow;
  for (let k = 0; k < f.nOut; k++) if (f.outField[k] === fi) return (f.outDir[k] + 2) & 3;
  for (let d = 0; d < 4; d++) {
    const nb = v.neighbour(cell, d);
    if (nb >= 0 && v.kind[nb] !== FIELD && v.solvedPorts(nb) & BIT[(d + 2) & 3]) return d;
  }
  return -1;
}
