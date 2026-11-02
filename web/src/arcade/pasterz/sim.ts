/**
 * Pasterz's session, without the DOM or the canvas (so every rule is unit-tested): the shepherd
 * on a seeded pasture (hill.ts), the sheep (flock.ts), the call ring, the pastures and their fold,
 * the blocks, what the band changes, the lost lamb, the meta (meta.ts) and the session's numbers.
 * All numbers are in rules.ts (re-exported here).
 *
 * The hands walk: a tap sets a goal, a drag steers, the arrows walk, Space calls.  Any grazing
 * sheep inside the call ring joins the flock.  The band only adds:
 *   Wołanie (push)      after a lead-in, the ring's radius is r0 + level × rExtra (r0 always: grace);
 *                       a held focus (5 s Mendi / 3 s HALO) sends "Głos": every sheep in view walks
 *                       to the shepherd and the lost lamb bleats (a compass mark shows where).
 *   Nocna straż (rest)  night falls, the flock lies down by a fire; calm lights the stars one by
 *                       one and lulls the lambs to sleep; a passed night brings morning lambs.
 *   Zmrok (blind)       every 4th Wołanie from the 3rd session: the ring stays dim at r0 and the
 *                       trail is veiled; at its end the ring flares by the block's judged share
 *                       and the footprints are revealed.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the ring rests at r0 and the stars wait; the block clock runs on.  The blocks run on
 * their own clock; the pastures (45–60 s of grazing each, the night does not count) end at the
 * fold, where the flock files through the gate and the count runs up.
 *
 * The headline is the sheep gathered this session (in the flock and folded), live from the first
 * second: the first grazing group stands around the shepherd's start.
 */
import { mulberry32 } from '../../core/random';
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp, lerp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome } from '../kit/types';
import { LAMBS, TIPS, missionById, type MissionId, type MissionKind } from './content';
import { Shepherd, keepFor, makeSheep, stepSheep, type Sheep } from './flock';
import { Hill } from './hill';
import { sheep as sheepText, t, unit } from './i18n';
import { addToFlock, bestFor, lenKey, nameLamb, turnPages, type PasterzProgress } from './meta';
import { RULES, span } from './rules';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'call' | 'watch';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

/** The pasture's stage: grazing, the fold waiting, the count at the gate, the count done. */
export type Stage = 'graze' | 'fold' | 'count' | 'done';
export type Phase = 'play' | 'finale' | 'done';
/** How the ring looks: the warm-up's, live in a sighted Wołanie, grey without signal, the night's, the dusk's. */
export type RingLook = 'warm' | 'live' | 'grey' | 'rest' | 'blind';

/** A footprint: where, which way, when (seconds of play: the trace colours it). */
export interface Print { x: number; y: number; dir: number; t: number; side: 1 | -1 }

/** The fold: its centre, the gate's direction (outward) and point; `self`: the flock walks in on its own. */
export interface Fold { x: number; y: number; gx: number; gy: number; gateX: number; gateY: number; self: boolean; age: number }

export type LambState = 'hidden' | 'carried' | 'home';

export type SimEvent =
  | { type: 'join'; id: number; x: number; y: number; via: 'ring' | 'voice' | 'morning' | 'flare' }
  | { type: 'call' }
  | { type: 'voice'; called: number; lamb: boolean }
  | { type: 'snag'; id: number; x: number; y: number }
  | { type: 'free'; id: number; x: number; y: number }
  | { type: 'lambFound'; x: number; y: number }
  | { type: 'pastureEnd'; why: 'time' | 'gathered' | 'finale' }
  | { type: 'foldEnter'; self: boolean }
  | { type: 'folded'; n: number; x: number; y: number }
  | { type: 'step'; n: number }
  | { type: 'lambNamed'; index: number; isNew: boolean }
  | { type: 'pastureDone'; folded: number; onHill: number; all: boolean }
  | { type: 'newPasture'; index: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  /** the judged window's share on the asked side and the share it needed; the block's span of play time */
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; t0: number; t1: number; stars: number }
  | { type: 'star'; n: number }
  | { type: 'morning'; n: number }
  | { type: 'flare'; share: number; r: number }
  | { type: 'mission'; id: MissionId }
  | { type: 'gift'; n: number }
  | { type: 'hundred'; season: number }
  | { type: 'finale' };

const NO_EVENTS: readonly SimEvent[] = [];
/** The session's pastures draw from their own stream. */
const HILL_SALT = 0x6a09e667;

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
 * The session's blocks.  A first-ever session opens with the warm-up "Pierwsze kroki" (30 s in 5
 * and 10 min, 20 s in 3, 6 s in a 40 s test); then Wołanie / Nocna straż pairs (24 ± 4 s and 23 ± 3 s,
 * scaled to end on time, jittered only when there is room) ending with a night, leaving the last
 * 6 s to the finisher at the fold.  No block under 12 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * R.minBlock, plannedSec - R.finale);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(2 * R.minBlock, left - warm);
      return [b('warmup', warm), b('call', rest / 2), b('watch', rest / 2)];
    }
    const watch = Math.max(R.minBlock, Math.min(14, left / 2));
    return [b('call', left - watch), b('watch', watch)];
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
  durs.forEach((dur, i) => plan.push(b(i % 2 ? 'watch' : 'call', dur)));
  return plan;
}

/** The ring's radius for a level (m): the band can only add. */
export const ringFor = (level: number): number => RULES.r0 + clamp(level) * RULES.rExtra;
/** The radius at the threshold (level 0.5): the dotted circle. */
export const RING_MARK = ringFor(0.5);

/** A passed night's morning lambs for its stars: 2, +1 at 6 stars, +1 at 10. */
export const morningFor = (stars: number): number => RULES.morning + RULES.morningAt.filter(n => stars >= n).length;

/** Sheep grazing on the i-th pasture of a session (0-based) for a draw `u` (0..1). */
export const hillSheep = (i: number, u: number): number => Math.min(RULES.hillMax, Math.round(span(RULES.hill, u)) + RULES.hillGrow * i);

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: PasterzProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

export class PasterzSim {
  readonly p: PasterzProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly hillRng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  /** the band's last 40 s, drawn as the tally strip and colouring the footprints */
  readonly trace = new SignalTrace(40, 0.1);
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly voiceHold: number;
  private readonly starLead: number;

  started = false;
  readonly session: number;
  /** the day's first session: its first pasture ("Wzgórze dnia") comes from the date */
  readonly daily: boolean;
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  t = 0;
  tip = '';
  hint = false;
  private lastInput = 0;

  // the hill and its bodies
  hill!: Hill;
  readonly shepherd: Shepherd;
  readonly sheep: Sheep[] = [];
  private nextId = 1;
  readonly prints: Print[] = [];
  private printAcc = 0;
  private printSide: 1 | -1 = 1;
  /** the half size of the view (m), set by the picture: "in view" for the voice and the strays */
  viewW = 14;
  viewH = 9;
  private dragging = -1;
  private readonly keys = new Set<string>();

  // the pasture
  pastureIndex = -1;
  pastureT = 0;
  pastureDur = 50;
  stage: Stage = 'graze';
  stageT = 0;
  /** sheep put on this hill, and gathered from it */
  onHill = 0;
  gatheredHere = 0;
  fold: Fold | null = null;
  private queue: Sheep[] = [];
  private gapT = 0;
  private released = 0;
  foldedHere = 0;
  lamb = { x: 0, y: 0, state: 'hidden' as LambState, bleat: 0 };

  // the band
  reliable = false;
  /** the ring's radius now (m) and how it looks; the call's flash (s left); the blind block's flare */
  ringR: number = RULES.r0;
  ringLook: RingLook = 'warm';
  callT = 0;
  flareT = 0;
  flareR = 0;
  /** the lost lamb's compass (s left) after a voice */
  compassT = 0;
  private voiceBlock = 0;
  private nextVoice = 0;
  private lastHold = 0;
  /** the night: how dark (0..1), the fire, the stars lit */
  night = 0;
  fire: { x: number; y: number } | null = null;
  private starP = 0;
  stars = 0;
  private relSec = 0;

  // the session's numbers
  score = 0;
  freed = 0;
  voices = 0;
  maxStars = 0;
  pasturesDone = 0;
  cleanPastures = 0;
  morningLambs = 0;
  passedNights = 0;
  blindShare = -1;
  readonly lambsNamed: { index: number; isNew: boolean }[] = [];
  private readonly done: MissionId[] = [];
  private giftNow = 0;
  private seasonsNow = 0;
  private settled = false;
  private readonly callsBase: number;
  private callsBegun = 0;
  private readonly bestBefore: number | null;
  private dailyCount = -1;

  constructor(private readonly init: SimInit) {
    const p = (this.p = init.progress);
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.hillRng = mulberry32((Math.floor(init.rng() * 2 ** 32) ^ HILL_SALT) >>> 0);
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.voiceHold = RULES.voiceHold[band];
    this.starLead = RULES.starLead[band];
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.callsBase = p.calls;
    this.daily = p.dailyDay !== init.day;
    this.plan = planBlocks(init.plannedSec, this.session === 1, this.daily ? mulberry32((init.daySeed ^ HILL_SALT) >>> 0) : init.rng);
    this.shepherd = new Shepherd(0, 0);
    this.newPasture();
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'call' && this.block.blind && this.phase === 'play'; }
  /** a sighted Wołanie past its lead-in: the ring answers the band */
  get sighted(): boolean { return this.block?.kind === 'call' && !this.block.blind && this.blockT >= this.lead && this.phase === 'play'; }
  get nightBlock(): boolean { return this.block?.kind === 'watch' && this.phase === 'play'; }
  /** the ring that gathers now: the live one, or the blind block's flare */
  get ring(): number { return this.flareT > 0 ? Math.max(this.ringR, this.flareR) : this.ringR; }
  /** sheep in the flock now (following, snagged, walking to the gate) */
  get flockSize(): number {
    let n = 0;
    for (const s of this.sheep) if (s.state === 'follow' || s.state === 'snag' || s.state === 'gate') n++;
    return n;
  }
  get leadIn(): number { return this.lead; }
  get voiceNeed(): number { return this.voiceHold; }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startBlock(0);
  }

  // ── the pastures ────────────────────────────────────────────────
  /** A new pasture: the day's hill first in the day's first session, then the session's own. */
  private newPasture(): void {
    this.pastureIndex++;
    const i = this.pastureIndex;
    const seed = i === 0 && this.daily ? this.init.daySeed >>> 0 : Math.floor(this.hillRng() * 2 ** 32) >>> 0;
    const gen = mulberry32(seed ^ 0x9e3779b9);
    const n = hillSheep(i, gen());
    this.hill = new Hill(seed, n);
    this.sheep.length = 0;
    this.prints.length = 0;
    this.shepherd.place(this.hill.start.x, this.hill.start.y);
    this.shepherd.carrying = false;
    this.onHill = 0;
    this.gatheredHere = 0;
    this.foldedHere = 0;
    this.fold = null;
    this.queue = [];
    this.stage = 'graze';
    this.stageT = 0;
    this.pastureT = 0;
    this.pastureDur = span(RULES.pasture, gen());
    this.lamb = { x: this.hill.lamb.x, y: this.hill.lamb.y, state: 'hidden', bleat: 0 };
    this.hill.groups.forEach((g, gi) => {
      for (let k = 0; k < g.n; k++) {
        let x: number, y: number;
        if (gi === 0) {
          // the first group stands right around the start: it joins at once
          const a = (k / g.n) * Math.PI * 2 + gen() * 0.6 + 0.4;
          const r = 1.25 + gen() * 0.6;
          x = g.x + Math.cos(a) * r;
          y = g.y + Math.sin(a) * r;
        } else {
          const a = gen() * Math.PI * 2, r = Math.sqrt(gen()) * RULES.grazeR;
          const q = this.hill.freeNear(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r, RULES.sheepR + 0.1);
          x = q.x;
          y = q.y;
        }
        const s = makeSheep(this.nextId++, x, y, gen);
        s.homeX = gi === 0 ? x : g.x;
        s.homeY = gi === 0 ? y : g.y;
        this.sheep.push(s);
        this.onHill++;
      }
    });
    if (i > 0) this.emit({ type: 'newPasture', index: i });
  }

  /** The pasture's grazing is over: the fold appears ahead of the shepherd. */
  private endPasture(why: 'time' | 'gathered' | 'finale'): void {
    if (this.stage !== 'graze') return;
    const sh = this.shepherd, R = RULES, H = this.hill;
    let dx = Math.cos(sh.dir), dy = Math.sin(sh.dir);
    if (sh.speed < 0.3) {
      const cx = H.w / 2 - sh.x, cy = H.h / 2 - sh.y, d = Math.hypot(cx, cy);
      if (d > 1) {
        dx = cx / d;
        dy = cy / d;
      }
    }
    const dist = why === 'finale' ? 4.5 : R.foldDist;
    const away = why === 'finale' ? R.foldR + 1.2 : R.foldR + R.gateR + 1;
    const c = H.freeNear(sh.x + dx * dist, sh.y + dy * dist, R.foldR + 1, (x, y) => Math.hypot(x - sh.x, y - sh.y) >= away);
    let gx = sh.x - c.x, gy = sh.y - c.y;
    const gl = Math.hypot(gx, gy) || 1;
    gx /= gl;
    gy /= gl;
    this.fold = { x: c.x, y: c.y, gx, gy, gateX: c.x + gx * R.foldR, gateY: c.y + gy * R.foldR, self: false, age: 0 };
    this.stage = 'fold';
    this.stageT = 0;
    this.emit({ type: 'pastureEnd', why });
  }

  /** The count begins: the flock files through the gate, the shepherd stands beside it (unless the flock walks in alone). */
  private beginCount(self: boolean): void {
    const f = this.fold;
    if (!f || this.stage === 'count' || this.stage === 'done') return;
    f.self = self;
    this.stage = 'count';
    this.stageT = 0;
    this.released = 0;
    this.gapT = 0.25;
    this.queue = this.sheep.filter(s => s.state === 'follow' || s.state === 'snag' || s.state === 'called')
      .sort((a, b) => Math.hypot(a.x - f.gateX, a.y - f.gateY) - Math.hypot(b.x - f.gateX, b.y - f.gateY));
    for (const s of this.queue) if (s.state === 'snag') s.state = 'follow';
    if (!self) {
      // beside the gate, out of the way
      const sh = this.shepherd;
      const side = (sh.x - f.gateX) * -f.gy + (sh.y - f.gateY) * f.gx >= 0 ? 1 : -1;
      sh.goal = { x: f.gateX + f.gx * 1.2 - f.gy * side * 1.5, y: f.gateY + f.gy * 1.2 + f.gx * side * 1.5 };
      sh.kx = sh.ky = 0;
      this.keys.clear();
    }
    this.emit({ type: 'foldEnter', self });
  }

  private countTick(dt: number): void {
    const f = this.fold!, R = RULES;
    this.gapT -= dt;
    const fast = this.phase !== 'play';
    if (this.gapT <= 0 && this.queue.length) {
      const s = this.queue.shift()!;
      if (s.state !== 'folded' && s.state !== 'gate') {
        s.state = 'gate';
        s.gateT = 0;
        s.counted = false;
        s.lie = 0;
        s.asleep = false;
        // a spot inside: a sunflower over the fold's floor
        const k = this.released, cap = Math.max(14, this.queue.length + this.released + 1);
        const r = (R.foldR - 0.75) * Math.sqrt((k + 0.5) / cap), a = k * 2.39996;
        s.spotX = f.x + Math.cos(a) * r;
        s.spotY = f.y + Math.sin(a) * r;
      }
      this.released++;
      const gap = lerp(R.countGap[0], R.countGap[1], clamp(this.released / 20));
      this.gapT += fast ? Math.min(gap, 2.5 / Math.max(1, this.queue.length + 1)) : gap;
    }
    for (const s of this.sheep) {
      if (s.state !== 'gate' || s.counted) continue;
      if (Math.hypot(s.x - f.gateX, s.y - f.gateY) < 0.75 || s.gateT >= R.gateMax) {
        if (s.gateT >= R.gateMax) {
          s.x = f.gateX - f.gx * 0.6;
          s.y = f.gateY - f.gy * 0.6;
        }
        s.counted = true;
        this.foldedHere++;
        this.emit({ type: 'folded', n: this.foldedHere, x: s.x, y: s.y });
        if (this.foldedHere % R.stepEvery === 0) this.emit({ type: 'step', n: this.foldedHere });
      }
    }
    for (const s of this.sheep) if (s.state === 'gate' && s.counted && Math.hypot(s.x - s.spotX, s.y - s.spotY) < 0.4) s.state = 'folded';
    const walking = this.sheep.some(s => s.state === 'gate' && !s.counted);
    if (!this.queue.length && !walking) this.countDone();
  }

  private countDone(): void {
    if (this.lamb.state === 'carried') {
      this.lamb.state = 'home';
      this.shepherd.carrying = false;
      const f = this.fold!;
      this.lamb.x = f.x;
      this.lamb.y = f.y;
      const named = nameLamb(this.p);
      this.lambsNamed.push(named);
      this.emit({ type: 'lambNamed', index: named.index, isNew: named.isNew });
    }
    this.stage = 'done';
    this.stageT = 0;
    this.pasturesDone++;
    const all = this.gatheredHere >= this.onHill;
    if (all) this.cleanPastures++;
    this.emit({ type: 'pastureDone', folded: this.foldedHere, onHill: this.onHill, all });
  }

  private pastureTick(dt: number): void {
    const R = RULES, sh = this.shepherd;
    if (this.fold) this.fold.age += dt;
    switch (this.stage) {
      case 'graze':
        if (this.phase !== 'play' || this.block.kind === 'watch') break;
        this.pastureT += dt;
        if (this.pastureT >= this.pastureDur) this.endPasture('time');
        else if (this.pastureT >= R.earliest && this.gatheredHere >= R.gatherEnd * this.onHill) this.endPasture('gathered');
        break;
      case 'fold': {
        this.stageT += dt;
        const f = this.fold!;
        if (Math.hypot(sh.x - f.gateX, sh.y - f.gateY) < R.gateR || Math.hypot(sh.x - f.x, sh.y - f.y) < R.foldR + 0.4) this.beginCount(false);
        else if (this.stageT >= R.foldWait || this.phase !== 'play') this.beginCount(true);
        break;
      }
      case 'count':
        this.stageT += dt;
        this.countTick(dt);
        break;
      case 'done':
        this.stageT += dt;
        if (this.stageT >= R.doneHold && this.phase === 'play') this.newPasture();
        break;
    }
  }

  // ── the hands ───────────────────────────────────────────────────
  /** A finger or the mouse, at a point of the hill (m): down sets a goal, a drag steers. */
  pointer(type: 'down' | 'move' | 'up', x: number, y: number, id: number): void {
    if (!this.started) return;
    if (type === 'down') {
      this.dragging = id;
      this.lastInput = this.t;
    } else if (type === 'up') {
      if (this.dragging === id) this.dragging = -1;
      return;
    } else if (this.dragging !== id) return;
    if (this.handsFree) this.shepherd.goal = { x: clamp(x, 0, this.hill.w), y: clamp(y, 0, this.hill.h) };
  }

  /** Arrows and WASD walk, Space calls; true when the key is the game's. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const dirs: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    };
    if (k in dirs) {
      if (down) {
        this.keys.add(k);
        this.lastInput = this.t;
      } else this.keys.delete(k);
      this.readKeys();
      return true;
    }
    if (k === ' ' || k === 'Enter') {
      if (down) this.call();
      return true;
    }
    return false;
  }

  private readKeys(): void {
    const dirs: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    };
    let x = 0, y = 0;
    for (const k of this.keys) {
      x += dirs[k][0];
      y += dirs[k][1];
    }
    const free = this.handsFree;
    this.shepherd.kx = free ? x : 0;
    this.shepherd.ky = free ? y : 0;
  }

  /** Every input lets go (the runner's pause, a lost focus). */
  release(): void {
    this.keys.clear();
    this.dragging = -1;
    this.shepherd.kx = this.shepherd.ky = 0;
  }

  /** The shepherd walks where the player says, except while he stands at the gate for the count. */
  get handsFree(): boolean { return !(this.stage === 'count' && this.fold && !this.fold.self); }

  /** Space: the shepherd's call — a ring flash; the sheep near look up. */
  call(): void {
    if (!this.started || this.phase === 'done') return;
    this.lastInput = this.t;
    this.callT = RULES.callSec;
    const reach = this.ring * RULES.lookRings, sh = this.shepherd;
    for (const s of this.sheep) {
      if (s.state === 'folded') continue;
      if (Math.hypot(s.x - sh.x, s.y - sh.y) <= reach) s.look = RULES.lookSec;
    }
    this.emit({ type: 'call' });
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.phaseT += dt;
    this.brain(dt, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    this.pastureTick(dt);
    this.walk(dt);
    this.flockTick(dt);
    this.gather();
    if (this.phase === 'finale' && this.phaseT >= RULES.finale && (this.stage === 'done' || this.stage === 'graze')) {
      this.phase = 'done';
      this.settle();
    }
    this.hint = this.phase === 'play' && this.block.kind === 'warmup' && t - this.lastInput >= RULES.idleHint;
    this.checkMissions();
  }

  /**
   * The band's slow quantities: the ring in a sighted Wołanie past its lead-in, the voice from the
   * hold, the stars from calm in a night past its lead-in; the trace and the night's darkness.
   */
  private brain(dt: number, f: FocusFrame): void {
    const R = RULES, b = this.block;
    this.reliable = f.reliable;
    const play = this.phase === 'play';
    if (play && f.reliable) this.relSec += dt;
    const live = this.sighted && f.reliable;
    this.ringR = approach(this.ringR, live ? ringFor(f.level) : R.r0, dt, R.ringTau);
    this.ringLook = !play ? 'warm' : b.kind === 'warmup' ? 'warm' : b.kind === 'watch' ? 'rest' : b.blind ? 'blind' : f.reliable ? 'live' : 'grey';
    this.callT = Math.max(0, this.callT - dt);
    this.flareT = Math.max(0, this.flareT - dt);
    this.compassT = Math.max(0, this.compassT - dt);
    this.lamb.bleat = Math.max(0, this.lamb.bleat - dt);
    const phase: TracePhase = !play ? 'free' : b.kind === 'call' ? 'focus' : b.kind === 'watch' ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
    // the voice: a held focus carries it across the hill
    if (f.hold < this.lastHold - 0.5) this.nextVoice = this.voiceHold;
    this.lastHold = f.hold;
    if (live && f.hold >= this.nextVoice && this.voiceBlock < R.voiceMax && this.stage === 'graze') {
      this.voiceBlock++;
      this.nextVoice = f.hold + R.voiceAgain;
      this.voice();
    }
    // the night's stars
    if (play && b.kind === 'watch' && this.blockT >= this.starLead && f.reliable) {
      this.starP = Math.min(R.starMax, this.starP + R.starGain * f.calm * dt);
      while (Math.floor(this.starP) > this.stars) {
        this.stars++;
        this.maxStars = Math.max(this.maxStars, this.stars);
        this.emit({ type: 'star', n: this.stars });
      }
    }
    // dusk before a night and in a blind block; the night itself
    const toNext = this.next && b ? b.dur - this.blockT : Infinity;
    const want = !play ? 0.15 : b.kind === 'watch' ? 1 : b.blind ? 0.5 : this.next?.kind === 'watch' && toNext < R.telegraph ? 0.35 : 0;
    this.night = approach(this.night, want, dt, R.nightTau);
  }

  /** "Głos": every grazing sheep in view walks to the shepherd; the lost lamb bleats. */
  private voice(): void {
    const sh = this.shepherd;
    let called = 0;
    for (const s of this.sheep) {
      if (s.state !== 'graze') continue;
      if (Math.abs(s.x - sh.x) > this.viewW || Math.abs(s.y - sh.y) > this.viewH) continue;
      s.state = 'called';
      s.calledT = 0;
      s.look = RULES.lookSec;
      called++;
    }
    if (this.lamb.state === 'hidden') {
      this.compassT = RULES.compassSec;
      this.lamb.bleat = 1.2;
    }
    this.voices++;
    this.emit({ type: 'voice', called, lamb: this.lamb.state === 'hidden' });
  }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'call' ? 'focus' : 'rest';
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
    if (b.kind === 'call') {
      this.callsBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.callsBase + this.callsBegun) % RULES.blindEvery === 0;
      this.voiceBlock = 0;
      this.nextVoice = this.voiceHold;
      this.fire = null;
    } else if (b.kind === 'watch') {
      this.starP = 0;
      this.stars = 0;
      const sh = this.shepherd;
      this.fire = this.hill.freeNear(sh.x + Math.cos(sh.dir) * 1.6, sh.y + Math.sin(sh.dir) * 1.6, 0.9);
    } else this.fire = null;
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup[0];
    if (b.kind === 'call') {
      if (b.blind) return TIPS.blind[(this.session + i) % TIPS.blind.length];
      if (first && this.callsBase === 0) return TIPS.firstCall;
      return TIPS.call[(this.session - 1 + i) % TIPS.call.length];
    }
    if (first && this.session === 1) return TIPS.firstWatch;
    return TIPS.watch[(this.session - 1 + i) % TIPS.watch.length];
  }

  /** The block's end: its verdict and what it pays — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block, R = RULES;
    let verdict: boolean | null = null, share = 0, need = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'call' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= R.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'watch') {
        this.maxStars = Math.max(this.maxStars, this.stars);
        if (verdict) {
          this.passedNights++;
          this.morning(morningFor(this.stars));
        }
      }
      if (b.blind) {
        this.trace.unveil(this.t);
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        this.flareT = R.flareSec;
        this.flareR = ringFor(s);
        this.emit({ type: 'flare', share: s, r: this.flareR });
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need, t0: this.t - this.blockT, t1: this.t, stars: b.kind === 'watch' ? this.stars : 0 });
  }

  /** A passed night: morning lambs trot up to the flock. */
  private morning(n: number): void {
    const c = this.fire ?? this.shepherd;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rng();
      const q = this.hill.freeNear(c.x + Math.cos(a) * 1.4, c.y + Math.sin(a) * 1.4, 0.35);
      const s = makeSheep(this.nextId++, q.x, q.y, this.rng, true);
      s.state = 'follow';
      s.look = 1;
      this.sheep.push(s);
      this.score++;
      this.morningLambs++;
      this.emit({ type: 'join', id: s.id, x: q.x, y: q.y, via: 'morning' });
    }
    this.emit({ type: 'morning', n });
  }

  // ── the bodies ──────────────────────────────────────────────────
  private walk(dt: number): void {
    const sh = this.shepherd;
    this.readKeys();
    const night = this.nightBlock && this.stage === 'graze' ? RULES.nightWalk : 1;
    const moved = sh.step(dt, this.hill, night);
    this.printAcc += moved;
    if (this.printAcc >= RULES.stride) {
      this.printAcc -= RULES.stride;
      this.printSide = this.printSide === 1 ? -1 : 1;
      const px = -Math.sin(sh.dir) * 0.13 * this.printSide, py = Math.cos(sh.dir) * 0.13 * this.printSide;
      this.prints.push({ x: sh.x + px, y: sh.y + py, dir: sh.dir, t: this.t, side: this.printSide });
      if (this.prints.length > RULES.prints) this.prints.shift();
    }
  }

  private flockTick(dt: number): void {
    const sh = this.shepherd, R = RULES;
    const atFire = this.nightBlock && this.fire !== null && this.stage === 'graze';
    const lagged = sh.past(R.lag);
    const n = this.flockSize;
    const f = this.fold;
    stepSheep(this.sheep, {
      hill: this.hill, shepherd: sh,
      tx: atFire ? this.fire!.x : lagged.x, ty: atFire ? this.fire!.y : lagged.y,
      keep: keepFor(n) + (atFire ? 0.6 : 0),
      gate: f && this.stage === 'count' ? { x: f.gateX, y: f.gateY, gx: f.gx, gy: f.gy, cx: f.x, cy: f.y } : null,
    }, dt, this.rng);
    // the night: the flock lies down by the fire; calm lulls the lambs to sleep
    const sleepy = this.nightBlock ? this.stars / R.starMax : 0;
    for (const s of this.sheep) {
      const still = Math.hypot(s.vx, s.vy) < 0.35;
      const lie = atFire && s.state === 'follow' && still && Math.hypot(s.x - this.fire!.x, s.y - this.fire!.y) < keepFor(n) + 2.5;
      s.lie = approach(s.lie, lie ? 1 : 0, dt, lie ? 0.8 : 0.25);
      s.asleep = lie && s.lie > 0.7 && ((s.id * 7) % 12) / 12 < sleepy;
    }
    // strays far behind and out of sight catch up from the edge of the view
    for (const s of this.sheep) {
      if (s.state !== 'follow' || atFire) { s.strayT = 0; continue; }
      const far = Math.hypot(s.x - sh.x, s.y - sh.y) > R.strayDist && (Math.abs(s.x - sh.x) > this.viewW || Math.abs(s.y - sh.y) > this.viewH);
      s.strayT = far ? s.strayT + dt : 0;
      if (s.strayT >= R.straySec) {
        const q = this.hill.freeNear(sh.x - Math.cos(sh.dir) * (this.viewH + 1), sh.y - Math.sin(sh.dir) * (this.viewH + 1), R.sheepR + 0.1);
        s.x = q.x;
        s.y = q.y;
        s.strayT = 0;
      }
    }
  }

  /** The ring gathers, the thorns snag and let go, the lost lamb is lifted onto the shoulders. */
  private gather(): void {
    const sh = this.shepherd, R = RULES, r = this.ring;
    const open = this.stage === 'graze' || this.stage === 'fold';
    for (const s of this.sheep) {
      const d = Math.hypot(s.x - sh.x, s.y - sh.y);
      if (open && (s.state === 'graze' || s.state === 'called')) {
        const via = s.state === 'called' ? 'voice' : this.flareT > 0 && d > this.ringR ? 'flare' : 'ring';
        if (d <= r + 0.15 || (s.state === 'called' && s.calledT >= R.calledMax)) this.join(s, via);
      } else if (s.state === 'follow' && this.stage === 'graze' && s.snagCool <= 0 && Math.hypot(s.vx, s.vy) > 0.8) {
        for (const c of this.hill.circles) {
          if (c.kind !== 'bush' || Math.hypot(s.x - c.x, s.y - c.y) > c.r + R.snagR) continue;
          if (this.rng() < R.snagChance) {
            s.state = 'snag';
            s.snagT = 0;
            this.emit({ type: 'snag', id: s.id, x: s.x, y: s.y });
          }
          s.snagCool = 2.5;
          break;
        }
      } else if (s.state === 'snag' && s.snagT >= R.snagMin && d <= Math.max(r, R.r0)) {
        s.state = 'follow';
        s.snagCool = R.snagCool;
        s.look = 0.8;
        this.freed++;
        this.emit({ type: 'free', id: s.id, x: s.x, y: s.y });
      }
    }
    if (this.lamb.state === 'hidden' && open && Math.hypot(this.lamb.x - sh.x, this.lamb.y - sh.y) <= R.lambPick) {
      this.lamb.state = 'carried';
      sh.carrying = true;
      this.score++;
      this.compassT = 0;
      this.emit({ type: 'lambFound', x: this.lamb.x, y: this.lamb.y });
    }
  }

  private join(s: Sheep, via: 'ring' | 'voice' | 'morning' | 'flare'): void {
    s.state = 'follow';
    s.look = 0.7;
    this.score++;
    this.gatheredHere++;
    this.emit({ type: 'join', id: s.id, x: s.x, y: s.y, via });
  }

  // ── the meta during play ────────────────────────────────────────
  missionValue(kind: MissionKind): number {
    switch (kind) {
      case 'gathered': return this.score;
      case 'lambs': return this.lambsNamed.length;
      case 'voices': return this.voices;
      case 'freed': return this.freed;
      case 'pastures': return this.pasturesDone;
      case 'stars': return this.maxStars;
      case 'morning': return this.morningLambs > 0 ? 1 : 0;
      case 'clean': return this.cleanPastures;
    }
  }

  private checkMissions(): void {
    if (this.settled) return;
    for (const id of this.p.missions) {
      if (this.done.includes(id)) continue;
      const m = missionById(id);
      if (m && this.missionValue(m.kind) >= m.target) {
        this.done.push(id);
        this.p.missionsDone++;
        this.emit({ type: 'mission', id });
      }
    }
  }

  // ── the finisher ────────────────────────────────────────────────
  /** The last block ended: the fold appears beside the shepherd and the flock files in. */
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.phaseT = 0;
    this.compassT = 0;
    if (this.stage === 'graze') this.endPasture('finale');
    if (this.stage === 'fold') this.beginCount(true);
    this.emit({ type: 'finale' });
  }

  /**
   * The session is settled once — at the end of the finisher, or when it ends early: the lamb on
   * the shoulders comes home with its name, the day's gift and the missions' sheep come, the flock
   * grows toward the hundred, the day's hill is recorded and the counters reach the progress.
   */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.checkMissions();
    this.settled = true;
    const p = this.p, day = this.init.day, R = RULES;
    if (this.lamb.state === 'carried') {
      this.lamb.state = 'home';
      this.shepherd.carrying = false;
      const named = nameLamb(p);
      this.lambsNamed.push(named);
      this.emit({ type: 'lambNamed', index: named.index, isNew: named.isNew });
    }
    if (p.giftDay !== day) {
      p.giftDay = day;
      this.giftNow = R.giftSheep;
      this.emit({ type: 'gift', n: R.giftSheep });
    }
    if (this.daily) {
      p.dailyDay = day;
      this.dailyCount = this.score;
      p.dailyGathered = this.score;
    }
    p.sessions = Math.max(p.sessions, this.session);
    p.calls = Math.max(p.calls, this.callsBase + this.callsBegun);
    p.total += this.score;
    const before = p.season;
    addToFlock(p, this.score + this.giftNow + this.done.length * R.missionSheep);
    this.seasonsNow = p.season - before;
    if (this.seasonsNow > 0) this.emit({ type: 'hundred', season: p.season });
    p.lastLen = this.plannedSec;
    turnPages(p, this.done);
  }

  /** The session ends before its own finisher: settle as the finisher would. */
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

  /** The pad follows the ring in a sighted Wołanie, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    const b = this.block;
    if (b.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp((this.ringR - RULES.r0) / RULES.rExtra);
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
      p.bestStars = Math.max(p.bestStars, this.maxStars);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.pastures'), String(this.pasturesDone)],
      [t('stat.lambs'), String(this.lambsNamed.length + (this.lamb.state === 'carried' ? 1 : 0))],
      [t('stat.voices'), String(this.voices)],
      [t('stat.stars'), String(this.maxStars)],
      [t('stat.freed'), String(this.freed)],
      [t('stat.hundred'), `${p.flock}/${RULES.hundred}`],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: the lost
   * lamb carried home, the voice across the hill, a calm night, a big flock; else Psalm 100:3.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.lambsNamed.length) fit.push('isa40.11', 'luk15.4-6');
    if (this.voices > 0) fit.push('jhn10.3', 'jhn10.27');
    if (this.passedNights > 0) fit.push('luk2.8');
    if (this.score >= 30) fit.push('ezk34.12');
    fit.push('psa100.3');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.seasonsNow > 0) add(0, t('hl.hundred', { n: this.p.season + 1 }));
    if (this.lambsNamed.length) {
      const names = this.lambsNamed.slice(0, 3).map(l => LAMBS[l.index].name);
      add(1, names.length === 1 ? t('hl.lamb', { name: names[0] }) : t('hl.lambs', { names: names.join(', '), n: names.length }));
    }
    if (this.bestBefore !== null && this.score > this.bestBefore) add(2, t('hl.record', { sheep: sheepText(this.score) }));
    if (this.cleanPastures) add(3, t('hl.clean'));
    if (this.done.length) add(4, t('hl.missions', { list: this.done.map(id => missionById(id)!.name).join(', ') }));
    if (this.morningLambs) add(5, t('hl.morning', { lambs: t('lambs', { n: this.morningLambs }) }));
    if (this.daily && this.dailyCount >= 0) add(6, t('hl.daily', { sheep: sheepText(this.dailyCount) }));
    if (this.blindShare >= 0) add(7, t('hl.blind', { n: this.blindShare }));
    if (this.giftNow) add(8, t('hl.gift', { sheep: sheepText(this.giftNow) }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
