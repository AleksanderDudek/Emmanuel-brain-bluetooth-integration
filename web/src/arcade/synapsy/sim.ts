/**
 * Synapsy's session, without the DOM: the network of neurons in two hemispheres and what happens in it.
 *
 *   wiring    two neurons fired one after the other (a tap and a tap, a drag through them) wire: a new link
 *             sprouts and brings its first synapse; firing a wired pair again grows it toward the next
 *             synapse (Hebb: fire together, wire together).  A pair fired on the song's beat grows more.
 *   thoughts  the lesson's input (an eye, an ear) fires on the beat; its pulse takes the fastest path the
 *             network offers to the output (a hand, the voice), through the hippocampus when the lesson asks.
 *             Each synapse passes it with a chance (more synapses, surer), and a passed synapse grows (use
 *             strengthens).  A lesson is learned after its thoughts arrived; a fast lesson counts only
 *             thoughts under its conduction limit — the path's real time from its length and myelin.
 *   myelin    Oli (an oligodendrocyte) wraps the axons she is sent to; a sheath speeds a link from 1 to
 *             100 m/s, and a pulse jumps from node to node.
 *   the band  growth: in a sighted push past its lead-in every growth is × (1 + 2 · level), active links grow
 *             by themselves with the level, and a held focus fills the BDNF bloom (every path link +1
 *             synapse).  Consolidation: in a rest block the session's paths replay quickly (calm → more
 *             often) and their links consolidate (saved for the next session), weak unused links are pruned
 *             kindly, and the glymphatic wash clears the waste the work left (a clean brain grows faster).
 *             A blind push hides it all and pays at its end.  Without a signal everything runs at its base.
 *   the bridge  the corpus callosum's two lanes; when the band's two prefrontal halves are even
 *             (`isEven`), the halves fall in step: the bridge passes every thought and crossing paths grow
 *             more.  Without a reading the bridge follows focus alone (never a made-up balance).
 *
 * The score is the session's connections: every synapse grown.  Events go out through `take()`.
 */
import { fmtNum } from '../../i18n';
import { isEven, type BodySignals } from '../kit/body';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { clamp, lerp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { lineAt, type Song } from '../kit/song';
import type { ArcadeOutcome } from '../kit/types';
import {
  canPair, dist, edgeMs, fastest, hopsTo, keyOf, makeBrain, reachable, type Brain, type Edge, type NodeKey, type RegionId,
} from './brain';
import { LINES, TIPS, cardTitle, connText, lessonAt, lessonTitle, msText, secText, type CardId, type Lesson } from './content';
import { t, unit } from './i18n';
import { bestFor, lenKey, lightRegion, unlockCard, type SynapsyProgress } from './meta';
import { buildSong } from './music';
import { RULES, passChance, speedOf } from './rules';
import { Talk } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

/** A link between two neurons (a lane of the bridge is one too, `lane` ≥ 0). */
export interface Link {
  key: string;
  a: number;
  b: number;
  /** the neuron it sprouted from (it grows toward the other one) */
  from: number;
  syn: number;
  /** growth toward the next synapse, 0..1 */
  grow: number;
  /** 0..1 a new link growing across; < 1 it carries nothing yet */
  sprout: number;
  myelin: number;
  /** consolidation 0..1; 1 = kept for the next session */
  cons: number;
  /** seconds since anything fired along it */
  idle: number;
  /** seconds since a thought crossed it (activity-dependent myelination) */
  active: number;
  /** recent activity 0..1 (glow) */
  heat: number;
  /** recent growth 0..1 (the gold of growing, sparks) */
  glow: number;
  /** pruning 0..1 (> 0: fading kindly) */
  prune: number;
  lane: number;
  /** came from the save (consolidated in an earlier session) */
  saved: boolean;
  born: number;
}

export type PulseKind = 'thought' | 'habit' | 'replay';

export interface Pulse {
  id: number;
  path: number[];
  seg: number;
  /** 0..1 along the current link */
  k: number;
  kind: PulseKind;
  /** conduction time so far (ms) */
  ms: number;
  /** the output it is meant to reach (−1: it goes as far as the network does and fades) */
  goal: number;
  via: number;
  crossed: boolean;
}

export type Coach = 'pair' | 'chain' | 'thought' | 'weak' | 'lens' | 'oli' | 'bridge' | 'rest' | 'blind' | 'speed' | 'far' | 'via';
/** where a coach mark points: a neuron, a link, a thing on the screen, or the middle */
export type CoachAt = { kind: 'neuron'; n: number } | { kind: 'link'; key: string } | { kind: 'oli' } | { kind: 'lens' } | { kind: 'bridge' } | { kind: 'none' };

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'fire'; n: number; by: 'tap' | 'pulse' | 'input' }
  | { type: 'pair'; a: number; b: number; beat: boolean; fresh: boolean }
  | { type: 'far'; a: number; b: number }
  | { type: 'full'; n: number }
  | { type: 'linked'; key: string }
  | { type: 'synapse'; key: string; syn: number }
  | { type: 'thought'; from: number; habit: boolean }
  | { type: 'arrive'; to: number; ms: number; lesson: boolean; counted: boolean }
  | { type: 'lost'; at: number; why: 'weak' | 'end' }
  | { type: 'slow'; ms: number; limit: number }
  | { type: 'oli'; key: string | null }
  | { type: 'wrapped'; key: string; mps: number }
  | { type: 'bloom'; links: number }
  | { type: 'step'; on: boolean }
  | { type: 'cross'; lane: number }
  | { type: 'replay'; path: number[] }
  | { type: 'consolidated'; key: string }
  | { type: 'prune'; key: string }
  | { type: 'pruned'; key: string }
  | { type: 'wash' }
  | { type: 'washed' }
  | { type: 'lesson'; lesson: Lesson }
  | { type: 'learned'; lesson: Lesson }
  | { type: 'card'; id: CardId }
  | { type: 'region'; id: RegionId }
  | { type: 'story' }
  | { type: 'coach'; what: Coach; at: CoachAt }
  | { type: 'blind'; share: number }
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

/** The last stretch without a block: 12 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/**
 * The session's blocks.  A first-ever session opens with the warm-up (30 s in 5 and 10 min, 20 s in 3, 6 s
 * in a 40 s test); then push / rest pairs (26 ± 4 s and 22 ± 3 s, scaled to end on time, jittered only when
 * there is room) ending with a rest, leaving the finale at the end.  No block under 12 s.
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

/** Distance from a point to a segment. */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const k = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2) : 0;
  return Math.hypot(px - (ax + dx * k), py - (ay + dy * k));
}

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: SynapsyProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /** a seed for a new player's brain (used once, at the first session) */
  seed: number;
}

export class SynapsySim {
  readonly p: SynapsyProgress;
  readonly brain: Brain;
  readonly plannedSec: number;
  readonly session: number;
  readonly eeg: boolean;
  readonly lead: number;
  readonly finaleSec: number;
  readonly bestBefore: number | null;
  readonly plan: Block[];
  readonly contrast = new BlockContrast(4);
  readonly talk: Talk;
  /** the song (its words give the sing-along line at the sim's beat) */
  readonly song: Song = buildSong();
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  private readonly seen: Set<string>;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  private events: SimEvent[] = [];

  started = false;
  settled = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  private relSec = 0;
  tip = '';

  // the band, this frame
  level = 0;
  calm = 0;
  reliable = false;
  threshold = 0;
  activity: number | null = null;
  /** the halves' balance as the band reports it (null: no reading) */
  balance: number | null = null;
  inStep = false;
  private stepT = 0;
  /** the current stretch in step on a real reading, and the session's longest */
  stepRun = 0;
  stepBest = 0;

  // the network
  readonly links = new Map<string, Link>();
  pulses: Pulse[] = [];
  private pulseSeq = 0;
  /** the neuron fired last by the hands, waiting for its partner */
  pending: { n: number; t: number } | null = null;
  /** neurons' flash (0..1) for the view */
  readonly flash: number[];
  private edgesCache: Edge[] | null = null;

  // the lesson
  lesson: Lesson;
  done = 0;
  /** a learned lesson's celebration before the next one (s) */
  lessonGap = 0;
  readonly learnedNow: Lesson[] = [];
  /** the session's paths that carried a lesson's thoughts (replayed in rest) */
  private readonly dayPaths = new Map<string, { path: number[]; n: number }>();

  // Oli
  oli: { state: 'home' | 'go' | 'wrap' | 'back'; k: number; target: string | null; chosen: boolean } = { state: 'home', k: 0, target: null, chosen: false };

  // the band's gifts
  charge = 0;
  blooms = 0;
  waste = 0;
  private replayT = 1.2;
  private pruneT = 2.5;
  /** the breath in rest (0..1 through in + out), for the wash */
  breath = 0;

  // the session's tallies
  score = 0;
  thoughts = 0;
  fastestMs = 0;
  consolidatedNow = 0;
  prunedNow = 0;
  crossings = 0;
  passedRests = 0;
  blindShare = -1;
  readonly cardsNow: CardId[] = [];
  readonly regionsNow: RegionId[] = [];
  private beatAt = -1;
  /** the opening story card (first session) */
  story: { t: number } | null = null;

  constructor(init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    if (!this.p.seed) this.p.seed = (Math.floor(init.seed) >>> 0) || 7;
    this.brain = makeBrain(this.p.seed);
    this.flash = this.brain.neurons.map(() => 0);
    this.plannedSec = init.plannedSec;
    this.session = this.p.sessions + 1;
    this.eeg = init.eeg;
    this.lead = init.eeg ? RULES.leadEeg : RULES.leadFnirs;
    this.finaleSec = finaleFor(init.plannedSec);
    this.bestBefore = bestFor(this.p, init.plannedSec);
    this.judge = RoundJudge.from(init.tuning);
    this.seen = new Set(this.p.seen);
    this.pushesBase = this.p.pushes;
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng);
    this.talk = new Talk(LINES, init.rng);
    this.lesson = lessonAt(this.p.lesson);
    this.restore();
  }

  // ── the saved brain ─────────────────────────────────────────────
  private restore(): void {
    const B = this.brain;
    B.bridges.forEach(([l, r], lane) => {
      const L = this.newLink(l, r, l);
      L.lane = lane;
      L.syn = RULES.bridgeSyn;
      L.sprout = 1;
      L.cons = 1;
      L.saved = true;
      L.myelin = clamp((this.p.bridge[lane] ?? 55) / 100);
    });
    for (const [a, b, syn, my] of this.p.links) {
      if (!canPair(B, a, b) || this.links.has(keyOf(a, b))) continue;
      const L = this.newLink(a, b, a);
      L.syn = syn;
      L.sprout = 1;
      L.myelin = clamp(my / 100);
      L.cons = 1;
      L.saved = true;
    }
    this.edgesCache = null;
  }

  private newLink(a: number, b: number, from: number): Link {
    const L: Link = {
      key: keyOf(a, b), a: Math.min(a, b), b: Math.max(a, b), from, syn: 0, grow: 0, sprout: 0, myelin: 0, cons: 0,
      idle: 0, active: 99, heat: 0, glow: 0, prune: 0, lane: -1, saved: false, born: this.t,
    };
    this.links.set(L.key, L);
    this.edgesCache = null;
    return L;
  }

  // ── state the view and the runner read ──────────────────────────
  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get pushBlock(): boolean { return this.phase === 'play' && this.block?.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block?.kind === 'rest'; }
  get warmBlock(): boolean { return this.phase === 'play' && this.block?.kind === 'warmup'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a push block the player sees, past its lead-in: the brain grows the network now */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  /** the growth the band drives right now (0..1, 0.5 at the threshold) — the lens and the gauge */
  get growth(): number { return this.sighted && this.reliable ? this.level : 0; }

  /** Growth's multiplier now: focus in a sighted push, a clean brain's clarity. */
  mult(): number {
    let m = 1 + RULES.clarityK * (1 - this.waste);
    if (this.sighted && this.reliable) m *= 1 + RULES.growK * this.level;
    return m;
  }

  /** IO node id of a key. */
  io(k: NodeKey | undefined): number {
    if (!k) return -1;
    return this.brain.io[k] ?? -1;
  }

  /** The links a thought may take now (grown, not being pruned), with their conduction times. */
  edges(withSprouts = false): Edge[] {
    if (!withSprouts && this.edgesCache) return this.edgesCache;
    const out: Edge[] = [];
    for (const L of this.links.values()) {
      if (L.prune > 0 || (!withSprouts && L.sprout < 1)) continue;
      out.push({ a: L.a, b: L.b, ms: edgeMs(dist(this.brain, L.a, L.b), L.myelin) });
    }
    if (!withSprouts) this.edgesCache = out;
    return out;
  }

  link(a: number, b: number): Link | undefined { return this.links.get(keyOf(a, b)); }

  /** Links a neuron keeps (not the bridge, not fading). */
  degree(n: number): number {
    let d = 0;
    for (const L of this.links.values()) if (L.lane < 0 && L.prune === 0 && (L.a === n || L.b === n)) d++;
    return d;
  }

  /** The fastest whole path of a thought from `from` to `to` through `via` (if any) over grown links, or null. */
  routeFor(from: number, to: number, via = -1): number[] | null {
    const n = this.brain.neurons.length, e = this.edges();
    if (from < 0 || to < 0) return null;
    if (via >= 0) {
      const a = fastest(n, e, from, via), b = fastest(n, e, via, to);
      return a && b ? [...a, ...b.slice(1)] : null;
    }
    return fastest(n, e, from, to);
  }

  /** The current lesson's whole path (null while there is none). */
  lessonRoute(): number[] | null {
    const L = this.lesson;
    return this.routeFor(this.io(L.from), this.io(L.to), this.io(L.via));
  }

  /** A path's conduction time (ms). */
  pathMs(path: readonly number[]): number {
    let ms = 0;
    for (let i = 0; i + 1 < path.length; i++) {
      const L = this.link(path[i], path[i + 1]);
      ms += edgeMs(dist(this.brain, path[i], path[i + 1]), L?.myelin ?? 0);
    }
    return ms;
  }

  /**
   * The pair that helps the lesson most: with a whole path, its weakest link (fewest synapses); else the
   * step that brings the network reachable from the input closest to the goal (the waypoint first), counted
   * in links still needed.  Null when there is nothing left to do.
   */
  suggest(): [number, number] | null {
    const L = this.lesson, B = this.brain, n = B.neurons.length;
    const from = this.io(L.from), to = this.io(L.to), via = this.io(L.via);
    if (from < 0 || to < 0) return null;
    const route = this.lessonRoute();
    if (route) {
      let best: Link | null = null;
      for (let i = 0; i + 1 < route.length; i++) {
        const k = this.link(route[i], route[i + 1]);
        if (!k || k.lane >= 0 || k.syn >= RULES.synMax) continue;
        if (!best || k.syn + k.grow < best.syn + best.grow) best = k;
      }
      return best ? [best.from, best.from === best.a ? best.b : best.a] : null;
    }
    const all = this.edges(true);
    const R = reachable(n, all, from);
    const goal = via >= 0 && !R.has(via) ? via : to;
    const hops = hopsTo(B, goal);
    let pick: [number, number] | null = null, score = Infinity;
    for (const a of R) {
      for (const b of B.near[a]) {
        if (R.has(b) || !this.canWire(a, b)) continue;
        const s = hops[b] * 10 + dist(B, a, b);
        if (s < score) { score = s; pick = [a, b]; }
      }
    }
    return pick;
  }

  /** May a new link grow between these two now (within reach, unwired, room on both)? */
  canWire(a: number, b: number): boolean {
    if (!canPair(this.brain, a, b)) return false;
    const L = this.link(a, b);
    if (L && L.prune === 0) return false;
    return this.degree(a) < RULES.perNeuron && this.degree(b) < RULES.perNeuron;
  }

  /** The neuron nearest (x, y) within `r` units, or −1. */
  neuronAt(x: number, y: number, r: number): number {
    let best = -1, bd = r;
    for (const N of this.brain.neurons) {
      const d = Math.hypot(N.x - x, N.y - y);
      if (d <= bd) { bd = d; best = N.id; }
    }
    return best;
  }

  /** The grown link nearest (x, y) within `r` units, or null. */
  linkAt(x: number, y: number, r: number): Link | null {
    let best: Link | null = null, bd = r;
    const ns = this.brain.neurons;
    for (const L of this.links.values()) {
      if (L.prune > 0 || L.sprout < 1) continue;
      const d = segDist(x, y, ns[L.a].x, ns[L.a].y, ns[L.b].x, ns[L.b].y);
      if (d <= bd) { bd = d; best = L; }
    }
    return best;
  }

  // ── the session's start ─────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.session === 1 && !this.seen.has('story')) {
      this.story = { t: 0 };
      this.seen.add('story');
      this.emit({ type: 'story' });
    }
    this.startBlock(0);
    this.emit({ type: 'lesson', lesson: this.lesson });
    this.card('neuron');
    if (this.session >= 2) this.card('energy');
    if (this.session >= 3) this.card('white');
    this.talk.ask(this.session === 1 ? 'open' : 'back', 3, 14);
    if (!this.story) this.coach('pair', this.pairAt());
  }

  private pairAt(): CoachAt {
    const s = this.suggest();
    return s ? { kind: 'neuron', n: s[0] } : { kind: 'none' };
  }

  // ── the hands ───────────────────────────────────────────────────
  /** Whether the beat is near now (a pair fired now is "in rhythm"). */
  onBeat(): boolean {
    const b = (this.t * RULES.bpm) / 60;
    return Math.abs(b - Math.round(b)) <= RULES.beatWindow;
  }

  /** A tap on a neuron (or a drag over it): it fires; with a partner fired a moment ago, the two wire. */
  touchNeuron(n: number): void {
    if (!this.started || this.phase === 'done' || n < 0) return;
    if (this.story) { this.closeStory(); return; }
    this.fire(n, 'tap');
    const pend = this.pending;
    if (pend && this.t - pend.t <= RULES.hebbSec) {
      if (pend.n !== n) this.pair(pend.n, n);
      else {
        // the same neuron again: it wires with its best partner (the hand that taps one neuron is not stuck)
        const b = this.partnerOf(n);
        if (b >= 0) this.pair(n, b);
      }
    }
    this.pending = { n, t: this.t };
  }

  /** The partner a neuron wires with best: the lesson's suggestion when it starts there, else its most useful neighbour. */
  partnerOf(n: number): number {
    const s = this.suggest();
    if (s && s[0] === n) return s[1];
    if (s && s[1] === n) return s[0];
    const B = this.brain, L = this.lesson;
    const goal = this.io(L.to);
    const hops = goal >= 0 ? hopsTo(B, goal) : null;
    let best = -1, bs = Infinity;
    for (const m of B.near[n]) {
      const k = this.link(n, m);
      if (k && k.syn >= RULES.synMax) continue;
      if (!k && !this.canWire(n, m)) continue;
      const s2 = (hops ? hops[m] : 0) * 10 + (k ? -2 : 0) + dist(B, n, m);
      if (s2 < bs) { bs = s2; best = m; }
    }
    return best;
  }

  /**
   * A tap on the free field fires the pair it lands between: the link under the tap thickens, else the pair
   * of neurons whose line passes nearest the tap wires (the lesson's next pair first when it is that near).
   * Nothing near: the next pair the lesson needs glows as a hint (`hinted`).  This is the smoke test's centre tap.
   */
  fieldTap(x: number, y: number, r = 0.12): void {
    if (!this.started || this.phase === 'done') return;
    if (this.story) { this.closeStory(); return; }
    const N = this.brain.neurons;
    const near = this.linkAt(x, y, r);
    if (near && near.lane < 0 && near.syn < RULES.synMax) {
      this.pair(near.from, near.from === near.a ? near.b : near.a);
      return;
    }
    const reach = r * 1.35;
    const s = this.suggest();
    if (s && segDist(x, y, N[s[0]].x, N[s[0]].y, N[s[1]].x, N[s[1]].y) <= reach) {
      this.pair(s[0], s[1]);
      return;
    }
    let best: [number, number] | null = null, bd = reach;
    for (const [a, b] of this.brain.pairs) {
      const L = this.link(a, b);
      if (L ? L.syn >= RULES.synMax || L.prune > 0 : !this.canWire(a, b)) continue;
      const d = segDist(x, y, N[a].x, N[a].y, N[b].x, N[b].y);
      if (d < bd) { bd = d; best = [a, b]; }
    }
    if (best) {
      this.pair(best[0], best[1]);
      return;
    }
    // a second tap on the empty field while the hint still glows: the hand that keeps tapping gets the
    // lesson's pair, as Space does on a desktop — so a phone never taps into nothing
    if (this.t - this.hinted <= RULES.hintHelpSec && this.helpPair()) {
      this.hinted = -99;
      return;
    }
    this.hinted = this.t;
  }

  /** When the player last tapped where nothing could wire (the view shows the lesson's next pair for a moment). */
  hinted = -99;

  /** Space (a desktop's shortcut): the pair the lesson needs next, or a thought when the path is whole and strong. */
  helpPair(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) { this.closeStory(); return true; }
    const s = this.suggest();
    if (s) {
      this.fire(s[0], 'tap');
      this.pair(s[0], s[1]);
      this.pending = { n: s[1], t: this.t };
      return true;
    }
    if (this.lessonGap <= 0 && this.lessonRoute() && !this.pulses.some(p => p.kind === 'thought')) {
      this.launch(this.lesson, false);
      return true;
    }
    return false;
  }

  /** Space and Enter: the story card, else the next pair; O sends Oli. */
  key(key: string, down: boolean): boolean {
    if (!down) return key === ' ' || key === 'Spacebar' || key === 'Enter' || key === 'o' || key === 'O' || key === 'm' || key === 'M';
    if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
      this.helpPair();
      return true;
    }
    if (key === 'o' || key === 'O' || key === 'm' || key === 'M') {
      this.sendOli();
      return true;
    }
    return false;
  }

  closeStory(): void {
    if (!this.story) return;
    this.story = null;
    this.coach('pair', this.pairAt());
  }

  /** Fire a wired pair (it grows), or wire a new one (it sprouts from `a` toward `b`). */
  pair(a: number, b: number): boolean {
    if (a === b || a < 0 || b < 0) return false;
    const beat = this.onBeat();
    this.flash[a] = 1;
    this.flash[b] = 1;
    const L = this.link(a, b);
    if (L) {
      if (L.prune > 0) {
        // a link being pruned and fired again stays: it is used after all
        L.prune = 0;
        this.edgesCache = null;
      }
      L.idle = 0;
      L.heat = 1;
      if (L.sprout < 1) L.sprout = Math.min(1, L.sprout + 0.2);
      else if (L.lane < 0) this.grow(L, RULES.tapGrow * (beat ? RULES.beatBonus : 1));
      this.emit({ type: 'pair', a, b, beat, fresh: false });
      if (beat) this.card('timing');
      return true;
    }
    if (!canPair(this.brain, a, b)) {
      // a near miss is "too far" (try through a neighbour); a tap across the brain just starts a new chain
      const N = this.brain.neurons;
      if (N[a].side === N[b].side && dist(this.brain, a, b) < RULES.reach * 2.2) {
        this.emit({ type: 'far', a, b });
        this.coach('far', { kind: 'neuron', n: b });
        this.talk.ask('far', 2, 3, 12);
      }
      return false;
    }
    if (this.degree(a) >= RULES.perNeuron || this.degree(b) >= RULES.perNeuron) {
      this.emit({ type: 'full', n: this.degree(a) >= RULES.perNeuron ? a : b });
      this.talk.ask('full', 2, 3, 20);
      return false;
    }
    const N = this.newLink(a, b, a);
    N.sprout = 0.001;
    N.heat = 1;
    if (beat) N.grow = 0.25;
    this.emit({ type: 'pair', a, b, beat, fresh: true });
    if (beat) this.card('timing');
    return true;
  }

  /** Growth toward the next synapse, × the multiplier now. */
  private grow(L: Link, amount: number, extra = 1): void {
    if (L.lane >= 0 || L.syn >= RULES.synMax || L.sprout < 1) return;
    const g = amount * this.mult() * extra;
    L.grow += g;
    L.glow = Math.min(1, L.glow + g * 1.4);
  }

  private fire(n: number, by: 'tap' | 'pulse' | 'input'): void {
    if (n < 0) return;
    this.flash[n] = 1;
    this.emit({ type: 'fire', n, by });
  }

  // ── Oli ─────────────────────────────────────────────────────────
  /** Send Oli to wrap an axon: the one given, else the slowest of the lesson's path (or the busiest bare one). */
  sendOli(key?: string | null): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) { this.closeStory(); return true; }
    let target: string | null = null, chosen = false;
    if (key) {
      const L = this.links.get(key);
      if (L && L.sprout >= 1 && L.prune === 0 && L.myelin < 1) { target = key; chosen = true; }
    }
    if (!target) target = this.oliTarget();
    if (!target) {
      this.talk.ask('nothing', 2, 3, 6);
      this.emit({ type: 'oli', key: null });
      return false;
    }
    this.oli = { state: 'go', k: this.oli.state === 'home' ? 0 : 0.35, target, chosen };
    this.emit({ type: 'oli', key: target });
    this.card('oligo');
    this.talk.ask('myelin', 2, 3, 8);
    return true;
  }

  /** The axon Oli would wrap next: the barest of the lesson's path, else the busiest bare link. */
  oliTarget(): string | null {
    const route = this.lessonRoute();
    let best: Link | null = null;
    if (route) {
      for (let i = 0; i + 1 < route.length; i++) {
        const L = this.link(route[i], route[i + 1]);
        if (L && L.myelin < 0.98 && (!best || L.myelin < best.myelin)) best = L;
      }
      if (best) return best.key;
    }
    for (const L of this.links.values()) {
      if (L.lane >= 0 || L.sprout < 1 || L.prune > 0 || L.myelin >= 0.98) continue;
      if (!best || L.heat + L.syn * 0.1 > best.heat + best.syn * 0.1) best = L;
    }
    return best?.key ?? null;
  }

  private updateOli(dt: number): void {
    const o = this.oli;
    if (o.state === 'home') return;
    const L = o.target ? this.links.get(o.target) : undefined;
    if (o.state === 'back') {
      o.k -= dt / 0.8;
      if (o.k <= 0) { o.k = 0; o.state = 'home'; o.target = null; }
      return;
    }
    if (!L || L.prune > 0) { o.state = 'back'; return; }
    if (o.state === 'go') {
      o.k += dt / 0.8;
      if (o.k >= 1) { o.k = 1; o.state = 'wrap'; }
      return;
    }
    // wrapping: a sheath grows faster with focus, and faster on an axon in use
    let rate = RULES.wrap * (1 + RULES.clarityK * (1 - this.waste));
    if (this.sighted && this.reliable) rate *= 1 + RULES.growK * this.level;
    if (L.active < RULES.activeSec) rate *= RULES.wrapActive;
    L.myelin = Math.min(1, L.myelin + rate * dt);
    L.glow = Math.max(L.glow, 0.35);
    this.edgesCache = null;
    if (L.myelin >= 1) {
      this.emit({ type: 'wrapped', key: L.key, mps: speedOf(1) });
      this.card('myelin');
      if (this.wrappedCount() >= 3) this.card('white');
      this.talk.ask('wrapped', 2, 3, 6);
      const next = o.chosen ? null : this.oliTarget();
      if (next && next !== L.key && this.lessonRoute()?.some((n, i, r) => i + 1 < r.length && keyOf(n, r[i + 1]) === next)) {
        o.target = next;
        o.state = 'go';
        o.k = 0.35;
      } else o.state = 'back';
    }
  }

  private wrappedCount(): number {
    let n = 0;
    for (const L of this.links.values()) if (L.lane < 0 && L.myelin >= 0.95) n++;
    return n;
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number, body?: BodySignals | null): void {
    if (!this.started || this.phase === 'done') return;
    this.t = t;
    this.reliable = f.reliable;
    this.level = f.reliable ? f.level : 0;
    this.calm = f.reliable ? f.calm : 0;
    this.threshold = f.threshold;
    this.activity = f.activity;
    if (f.reliable) this.relSec += dt;
    for (let i = 0; i < this.flash.length; i++) this.flash[i] = Math.max(0, this.flash[i] - dt * 2.4);
    if (this.pending && t - this.pending.t > RULES.hebbSec) this.pending = null;

    if (this.story) {
      this.story.t += dt;
      if (this.story.t >= RULES.storyMax) this.closeStory();
    }
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.endFinale();
    if (this.settled) return;

    this.updateStep(dt, body?.balance ?? null);
    this.beats();
    this.updateLinks(dt);
    this.updatePulses(dt);
    this.updateOli(dt);
    this.updateBand(dt);
    if (this.lessonGap > 0) {
      this.lessonGap -= dt;
      if (this.lessonGap <= 0) this.nextLesson();
    }
    this.talk.update(dt, t, this.talkBlocked);
  }

  /** Oli keeps quiet over a telegraph, the runner's block banner, the story card and a coach mark. */
  get talkBlocked(): boolean {
    const b = this.block;
    const tele = this.phase === 'play' && b && this.blockT >= b.dur - RULES.telegraph;
    const banner = this.phase === 'play' && this.blockT < RULES.bannerSec && this.blockIndex > 0;
    return !!(tele || banner || this.story || this.t < this.quietUntil);
  }

  /** The runner's block banner is over the play now (the first seconds of every block after the first). */
  get bannerUp(): boolean {
    return this.phase === 'play' && this.blockT < RULES.bannerSec && this.blockIndex > 0;
  }

  /** A coach mark is on screen until then: Oli waits (her bubble and the runner's would cover each other). */
  private quietUntil = 0;
  holdTalk(sec: number): void { this.quietUntil = Math.max(this.quietUntil, this.t + sec); }

  /** The halves in step: the band's balance inside the even band; without a reading, focus alone in a sighted push. */
  private updateStep(dt: number, bal: number | null): void {
    this.balance = bal;
    const real = bal !== null;
    const want = real ? isEven(bal) : this.sighted && this.reliable && this.level >= 0.5;
    this.stepT = want ? this.stepT + dt : 0;
    const on = this.stepT >= RULES.stepOn;
    if (on !== this.inStep) {
      this.inStep = on;
      this.emit({ type: 'step', on });
      if (on && !real) this.talk.ask('bridge', 1, 3, 25);
    }
    if (on && real) {
      if (this.stepRun === 0) this.talk.ask('inStep', 2, 3, 25);
      this.card('sync');
      this.stepRun += dt;
      this.stepBest = Math.max(this.stepBest, this.stepRun);
    } else this.stepRun = 0;
    // once a session, say plainly that there is no reading of the halves (never a made-up balance)
    if (!real && this.sighted && this.blockT > this.lead + 3) this.talk.ask('noReading', 1, 4, 600);
  }

  /** The beat: the lesson's input fires every other beat, a learned path's every fourth; slower in rest. */
  private beats(): void {
    const beat = Math.floor((this.t * RULES.bpm) / 60);
    if (beat === this.beatAt) return;
    this.beatAt = beat;
    if (this.story || this.phase !== 'play') return;
    const rest = this.restBlock ? 2 : 1;
    if (this.lessonGap <= 0 && beat % (RULES.inputEvery * rest) === 0) this.launch(this.lesson, false);
    const every = RULES.habitEvery * rest;
    if (beat % every === 1) {
      const habits = this.habits();
      if (habits.length) this.launch(habits[Math.floor(beat / every) % habits.length], true);
    }
  }

  /** Learned lessons (other than the current one) whose whole path is there: they keep their thoughts going. */
  habits(): Lesson[] {
    const out: Lesson[] = [];
    const ids = new Set<string>([...this.p.learned, ...this.learnedNow.map(l => l.id)]);
    for (let i = 0; i < 8; i++) {
      const L = lessonAt(i);
      if (!ids.has(L.id) || L.id === this.lesson.id) continue;
      if (this.routeFor(this.io(L.from), this.io(L.to), this.io(L.via))) out.push(L);
    }
    return out;
  }

  /** A thought leaves an input: along the whole path when there is one, else as far as the network goes. */
  private launch(L: Lesson, habit: boolean): void {
    const from = this.io(L.from), to = this.io(L.to), via = this.io(L.via);
    if (from < 0 || to < 0 || this.pulses.length >= RULES.maxPulses) return;
    const route = this.routeFor(from, to, via);
    if (habit && !route) return;
    this.fire(from, 'input');
    let path = route, goal = to;
    if (!path) {
      path = this.frontier(from, to, via);
      goal = -1;
    }
    this.emit({ type: 'thought', from, habit });
    if (!path || path.length < 2) return;
    this.pulses.push({ id: this.pulseSeq++, path, seg: 0, k: 0, kind: habit ? 'habit' : 'thought', ms: 0, goal, via, crossed: false });
    if (!habit && route && !this.seen.has('c:thought')) this.coach('thought', { kind: 'neuron', n: from });
  }

  /** As far toward the goal as the grown network reaches from `from`. */
  private frontier(from: number, to: number, via: number): number[] | null {
    const n = this.brain.neurons.length, e = this.edges();
    const R = reachable(n, e, from);
    if (R.size < 2) return null;
    const goal = via >= 0 && !R.has(via) ? via : to;
    const hops = hopsTo(this.brain, goal);
    let end = from, best = hops[from] * 10;
    for (const v of R) {
      const s = hops[v] * 10 + dist(this.brain, v, goal) * 0.1;
      if (s < best) { best = s; end = v; }
    }
    if (end === from) return null;
    return fastest(n, e, from, end);
  }

  private updateLinks(dt: number): void {
    const remove: string[] = [];
    for (const L of this.links.values()) {
      L.idle += dt;
      L.active += dt;
      L.heat = Math.max(0, L.heat - dt * 0.5);
      L.glow = Math.max(0, L.glow - dt * 0.8);
      if (L.sprout > 0 && L.sprout < 1) {
        L.sprout = Math.min(1, L.sprout + (dt / RULES.sproutSec) * this.mult());
        if (L.sprout >= 1) {
          L.syn = Math.max(1, L.syn);
          this.edgesCache = null;
          this.addScore(1);
          this.emit({ type: 'linked', key: L.key });
          this.card('synapse');
          if (!this.seen.has('c:chain')) this.coach('chain', this.pairAt());
          this.talk.ask(this.links.size <= 3 ? 'firstLink' : 'link', 1, 3, 10);
        }
      }
      if (L.prune > 0) {
        L.prune += dt / RULES.pruneSec;
        if (L.prune >= 1) remove.push(L.key);
        continue;
      }
      if (L.lane < 0 && L.sprout >= 1 && L.grow >= 1) {
        if (L.syn < RULES.synMax) {
          L.syn++;
          L.grow -= 1;
          this.addScore(1);
          this.emit({ type: 'synapse', key: L.key, syn: L.syn });
          this.card('hebb');
          if (L.syn === 4) this.talk.ask('strong', 1, 3, 15);
        }
        if (L.syn >= RULES.synMax) L.grow = 0;
      }
    }
    for (const k of remove) {
      this.links.delete(k);
      this.edgesCache = null;
      this.prunedNow++;
      this.charge = Math.min(1, this.charge + RULES.pruneGift);
      this.emit({ type: 'pruned', key: k });
    }
  }

  private updatePulses(dt: number): void {
    const B = this.brain;
    for (let i = 0; i < this.pulses.length; i++) {
      const P = this.pulses[i];
      const a = P.path[P.seg], b = P.path[P.seg + 1];
      const L = this.link(a, b);
      if (!L || L.prune > 0 || L.sprout < 1) {
        this.lose(i--, a, 'weak');
        continue;
      }
      const len = Math.max(0.05, dist(B, a, b));
      let v = RULES.pulseSpeed * (1 + RULES.pulseMyelin * L.myelin);
      if (P.kind === 'replay') v *= RULES.replaySpeed;
      if (L.lane >= 0 && this.inStep) v *= 1.4;
      P.k += (dt * v) / len;
      if (P.k < 1) continue;
      P.ms += edgeMs(len, L.myelin);
      if (P.kind === 'replay') {
        const before = L.cons;
        L.cons = Math.min(1, L.cons + RULES.replayGain * (0.6 + 0.8 * this.restCalm()));
        this.grow(L, RULES.replayGrow);
        L.heat = Math.max(L.heat, 0.6);
        if (before < 1 && L.cons >= 1 && L.lane < 0) {
          this.consolidatedNow++;
          this.emit({ type: 'consolidated', key: L.key });
          this.card('sleep');
        }
      } else {
        const sure = L.lane >= 0 && this.inStep;
        const chance = L.lane >= 0 ? passChance(RULES.bridgeSyn) : passChance(L.syn);
        if (!sure && this.rng() >= chance) {
          this.lose(i--, b, 'weak');
          continue;
        }
        L.idle = 0;
        L.active = 0;
        L.heat = 1;
        this.grow(L, RULES.thoughtGrow, P.crossed && this.inStep ? RULES.stepGrow : 1);
        if (L.lane >= 0) {
          P.crossed = true;
          this.crossings++;
          this.emit({ type: 'cross', lane: L.lane });
          this.card('callosum');
          this.talk.ask('bridge', 1, 3, 30);
          if (!this.seen.has('c:bridge')) this.coach('bridge', { kind: 'bridge' });
        }
      }
      this.fire(b, 'pulse');
      P.seg++;
      P.k = 0;
      if (P.seg >= P.path.length - 1) {
        this.pulses.splice(i--, 1);
        this.arrive(P);
      }
    }
  }

  /** A thought lost: at a synapse that did not pass it, or at the end of the network. */
  private lose(i: number, at: number, why: 'weak' | 'end'): void {
    const P = this.pulses[i];
    this.pulses.splice(i, 1);
    if (P.kind === 'replay') return;
    this.emit({ type: 'lost', at, why });
    if (P.kind === 'thought') {
      this.talk.ask('lost', 1, 2.5, 18);
      if (why === 'weak') this.coach('weak', { kind: 'neuron', n: at });
    }
  }

  private arrive(P: Pulse): void {
    const to = P.path[P.path.length - 1];
    if (P.kind === 'replay') return;
    if (P.goal < 0 || to !== P.goal) {
      this.emit({ type: 'lost', at: to, why: 'end' });
      if (P.kind === 'thought') this.talk.ask('lost', 1, 2.5, 18);
      return;
    }
    if (P.kind === 'habit') {
      this.emit({ type: 'arrive', to, ms: P.ms, lesson: false, counted: false });
      return;
    }
    const L = this.lesson;
    const key = P.path.join('.');
    const day = this.dayPaths.get(key);
    if (day) day.n++; else this.dayPaths.set(key, { path: P.path.slice(), n: 1 });
    this.fastestMs = this.fastestMs > 0 ? Math.min(this.fastestMs, P.ms) : P.ms;
    if (this.lessonGap > 0) {
      this.emit({ type: 'arrive', to, ms: P.ms, lesson: true, counted: false });
      return;
    }
    if (L.limitMs !== null && P.ms > L.limitMs) {
      this.emit({ type: 'slow', ms: P.ms, limit: L.limitMs });
      this.emit({ type: 'arrive', to, ms: P.ms, lesson: true, counted: false });
      this.talk.ask('slow', 2, 3, 14);
      this.coach('speed', { kind: 'oli' });
      return;
    }
    this.done++;
    this.thoughts++;
    this.emit({ type: 'arrive', to, ms: P.ms, lesson: true, counted: true });
    if (this.thoughts === 1) this.card('nmda');
    if (L.limitMs !== null) this.talk.ask('fast', 2, 3, 12);
    else if (this.done === 1) this.talk.ask('path', 2, 4);
    else this.talk.ask('thought', 1, 2.5, 16);
    if (this.done >= L.goal) this.learn();
  }

  private learn(): void {
    const L = this.lesson;
    this.learnedNow.push(L);
    if (!this.p.learned.includes(L.id)) this.p.learned.push(L.id);
    for (const r of L.regions) {
      if (lightRegion(this.p, r)) {
        this.regionsNow.push(r);
        this.emit({ type: 'region', id: r });
      }
    }
    if (L.id === 'name' || L.id === 'tell') this.card('language');
    if (L.id === 'catch') this.card('skill');
    this.p.lesson = L.index + 1;
    this.lessonGap = 3.2;
    this.emit({ type: 'learned', lesson: L });
    this.talk.ask('learned', 3, 4);
  }

  private nextLesson(): void {
    this.lesson = lessonAt(this.p.lesson);
    this.done = 0;
    this.lessonGap = 0;
    this.emit({ type: 'lesson', lesson: this.lesson });
    this.talk.ask('lesson', 2, 5);
    if (this.lesson.limitMs !== null) this.coach('speed', { kind: 'oli' });
    if (this.lesson.via) this.coach('via', { kind: 'neuron', n: this.io(this.lesson.via) });
  }

  /** The band's work this frame: growth and the bloom in a sighted push, consolidation in rest, waste. */
  private updateBand(dt: number): void {
    if (this.sighted && this.reliable) {
      // focus = growth: active links grow by themselves with the level (and grow() adds the focus multiplier)
      const g = RULES.pathGrow * this.level * dt;
      for (const L of this.links.values()) if (L.heat > 0.05 && L.sprout >= 1 && L.lane < 0) this.grow(L, g * L.heat);
      const fill = clamp((this.level - RULES.bloomFloor) / (1 - RULES.bloomFloor));
      this.charge = Math.min(1, this.charge + dt * RULES.bloomRate * fill);
      if (this.charge >= 1) this.bloom();
      if (!this.seen.has('c:lens') && this.blockT >= this.lead + 0.5) this.coach('lens', { kind: 'lens' });
    }
    if (this.restBlock) {
      this.breath = ((this.blockT % (RULES.breathIn + RULES.breathOut)) / (RULES.breathIn + RULES.breathOut));
      const calm = this.restCalm();
      const was = this.waste;
      this.waste = Math.max(0, this.waste - dt * (RULES.washBase + RULES.washCalm * calm));
      if (was > 0.02 && this.waste <= 0.02) {
        this.card('aqp4');
        this.emit({ type: 'washed' });
        this.talk.ask('clean', 1, 3, 60);
      }
      this.replayT -= dt;
      if (this.replayT <= 0) {
        this.replayT = lerp(RULES.replayGap[0], RULES.replayGap[1], calm);
        this.replay();
      }
      this.pruneT -= dt;
      if (this.pruneT <= 0) {
        this.pruneT = RULES.pruneGap;
        this.startPrune();
      }
    } else if (this.phase === 'play') {
      this.waste = Math.min(1, this.waste + dt * (RULES.wasteBase + RULES.wastePulse * this.pulses.length));
    }
  }

  /** Calm in a rest block past its lead-in (the brain's part of consolidation), 0 before and without a signal. */
  restCalm(): number {
    return this.restBlock && this.reliable && this.blockT >= this.lead ? this.calm : 0;
  }

  /** The BDNF bloom: every active link of the network and the lesson's path grows a synapse at once. */
  private bloom(): void {
    this.charge = 0;
    const route = this.lessonRoute();
    const onRoute = new Set<string>();
    if (route) for (let i = 0; i + 1 < route.length; i++) onRoute.add(keyOf(route[i], route[i + 1]));
    let n = 0;
    for (const L of this.links.values()) {
      if (L.lane >= 0 || L.prune > 0) continue;
      if (!onRoute.has(L.key) && L.heat < 0.3 && L.sprout >= 1) continue;
      if (L.sprout < 1) { L.sprout = 0.999; n++; continue; }
      if (L.syn < RULES.synMax) {
        L.syn++;
        L.glow = 1;
        this.addScore(1);
        this.emit({ type: 'synapse', key: L.key, syn: L.syn });
        n++;
      }
    }
    this.blooms++;
    this.emit({ type: 'bloom', links: n });
    this.card('bdnf');
    this.talk.ask('bloom', 3, 3);
  }

  /** A replay: one of the session's paths races through again (sleep's replay, compressed); else a learned one. */
  private replay(): void {
    let pick: number[] | null = null;
    const paths = [...this.dayPaths.values()];
    if (paths.length) {
      const total = paths.reduce((s, x) => s + x.n, 0);
      let r = this.rng() * total;
      for (const x of paths) {
        r -= x.n;
        if (r <= 0) { pick = x.path; break; }
      }
      pick = pick ?? paths[0].path;
    } else {
      const route = this.lessonRoute() ?? this.habits().map(L => this.routeFor(this.io(L.from), this.io(L.to), this.io(L.via))).find(Boolean) ?? null;
      pick = route;
    }
    if (!pick || pick.length < 2 || this.pulses.length >= RULES.maxPulses) return;
    // a path may have lost a link since: replay only what is still whole
    for (let i = 0; i + 1 < pick.length; i++) {
      const L = this.link(pick[i], pick[i + 1]);
      if (!L || L.prune > 0 || L.sprout < 1) return;
    }
    this.pulses.push({ id: this.pulseSeq++, path: pick.slice(), seg: 0, k: 0, kind: 'replay', ms: 0, goal: pick[pick.length - 1], via: -1, crossed: false });
    this.emit({ type: 'replay', path: pick.slice() });
    this.card('replay');
    this.talk.ask('replay', 1, 3, 20);
  }

  /** Pruning in rest: the weakest link nobody used for a while fades (never one the lesson needs). */
  private startPrune(): void {
    const route = this.lessonRoute() ?? this.suggestRoute();
    const keep = new Set<string>();
    if (route) for (let i = 0; i + 1 < route.length; i++) keep.add(keyOf(route[i], route[i + 1]));
    for (const d of this.dayPaths.values()) for (let i = 0; i + 1 < d.path.length; i++) keep.add(keyOf(d.path[i], d.path[i + 1]));
    let pick: Link | null = null;
    for (const L of this.links.values()) {
      if (L.lane >= 0 || L.prune > 0 || L.sprout < 1 || L.syn > 1 || L.cons >= 0.5 || L.idle < RULES.pruneIdle || keep.has(L.key)) continue;
      if (!pick || L.idle > pick.idle) pick = L;
    }
    if (!pick) return;
    pick.prune = 0.001;
    this.edgesCache = null;
    this.emit({ type: 'prune', key: pick.key });
    this.card('prune');
    this.talk.ask('prune', 1, 3, 25);
  }

  /** The links the frontier of the lesson already uses (kept from pruning while the path is unfinished). */
  private suggestRoute(): number[] | null {
    const L = this.lesson;
    return this.frontier(this.io(L.from), this.io(L.to), this.io(L.via));
  }

  private addScore(n: number): void { this.score += n; }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('rest', { kind: 'none' });
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
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
      if (b.blind) this.coach('blind', { kind: 'lens' });
      if (first) this.card('glia');
    } else if (b.kind === 'rest') {
      this.replayT = 1.2;
      this.pruneT = 3;
      this.emit({ type: 'wash' });
      this.card('glymph');
      this.talk.ask('rest', 2, 12);
    } else {
      this.talk.ask('warm', 1, 10);
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

  /** The block's end: its verdict, and a blind push's hidden growth paid at once. */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0, need = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push' && b.blind) {
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        // the growth that happened unseen: the lesson's links and the bloom's charge
        const route = this.lessonRoute() ?? this.suggestRoute();
        if (route) for (let k = 0; k + 1 < route.length; k++) { const L = this.link(route[k], route[k + 1]); if (L) this.grow(L, 1.2 * s); }
        this.charge = Math.min(1, this.charge + s * RULES.blindBloom);
        this.emit({ type: 'blind', share: s });
      }
      if (b.kind === 'rest' && verdict) {
        this.passedRests++;
        this.talk.ask('good', 1, 4, 30);
      }
      if (b.kind === 'push' && verdict) this.talk.ask('good', 1, 4, 30);
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
    if (this.charge >= 1 && !b.blind) this.charge = 0.98;
  }

  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.talk.ask('end', 3, 8);
    this.emit({ type: 'finale' });
    // the session's paths shine once more, one after another
    let k = 0;
    for (const d of this.dayPaths.values()) {
      if (k++ >= 4 || this.pulses.length >= RULES.maxPulses) break;
      this.pulses.push({ id: this.pulseSeq++, path: d.path.slice(), seg: 0, k: -0.35 * k, kind: 'replay', ms: 0, goal: d.path[d.path.length - 1], via: -1, crossed: false });
    }
  }

  private endFinale(): void {
    this.phase = 'done';
    this.settle();
  }

  /** The session is settled once — at its end or when it ends early: the brain and the counters reach the progress. */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p;
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushesBase + this.pushesBegun);
    // what was consolidated stays; the rest is forgotten by the next session
    const keep = [...this.links.values()]
      .filter(L => L.lane < 0 && L.prune === 0 && L.sprout >= 1 && L.cons >= 1)
      .sort((x, y) => y.syn - x.syn || y.myelin - x.myelin)
      .slice(0, RULES.keepLinks);
    p.links = keep.map(L => [L.a, L.b, L.syn, Math.round(L.myelin * 100)]);
    p.bridge = [0, 1].map(i => {
      const [l, r] = this.brain.bridges[i];
      return Math.round((this.link(l, r)?.myelin ?? RULES.bridgeMyelin) * 100);
    }) as [number, number];
    if (keep.some(L => this.brain.neurons[L.a].region === 'touch' || this.brain.neurons[L.b].region === 'touch')) {
      if (lightRegion(p, 'touch')) this.regionsNow.push('touch');
    }
    p.total += this.score;
    p.thoughts += this.thoughts;
    p.blooms += this.blooms;
    p.inStep = Math.max(p.inStep, Math.round(this.stepBest));
    if (this.fastestMs > 0) p.fastest = p.fastest > 0 ? Math.min(p.fastest, this.fastestMs) : this.fastestMs;
    p.lastLen = this.plannedSec;
    p.seen = [...this.seen];
  }

  /** The session ends before its own end: settle as the end would. */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') this.endBlock();
    this.story = null;
    this.settle();
    this.phase = 'done';
  }

  // ── the first-time explanations and the cards ───────────────────
  private coach(what: Coach, at: CoachAt): void {
    const id = `c:${what}`;
    if (this.seen.has(id)) return;
    this.seen.add(id);
    this.emit({ type: 'coach', what, at });
  }

  private card(id: CardId): void {
    if (!unlockCard(this.p, id)) return;
    this.cardsNow.push(id);
    this.emit({ type: 'card', id });
  }

  // ── output ──────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The panel's gauge: growth in a sighted push, calm in rest; null blind, without signal, in a lead-in, elsewhere. */
  meter(): number | null {
    if (!this.started || !this.reliable || this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.level);
    if (this.restBlock) return clamp(this.calm);
    return null;
  }

  /** The song's fullness: the level in a sighted push, a gentle fixed level in rest and the warm-up, held in a blind push. */
  songLevel(): number | null {
    if (!this.started) return 0.35;
    if (this.blind) return null;
    if (this.sighted) return this.reliable ? clamp(this.level) : null;
    if (this.restBlock) return 0.32;
    if (this.phase === 'finale') return 0.7;
    return 0.4;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The sing-along line at the song's beat now (the song starts with play, on the sim's own clock). */
  songLine(): { text: string; next: string | null; p: number } | null {
    if (!this.started) return null;
    return lineAt(this.song, (this.t * RULES.bpm) / 60);
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.lessons'), fmtNum(this.learnedNow.length)],
      [t('stat.thoughts'), fmtNum(this.thoughts)],
      [t('stat.fastest'), this.fastestMs > 0 ? msText(this.fastestMs) : '—'],
      [t('stat.inStep'), this.stepBest >= 1 ? secText(this.stepBest) : '—'],
      [t('stat.kept'), fmtNum(this.consolidatedNow)],
      [t('stat.pruned'), fmtNum(this.prunedNow)],
      [t('stat.blooms'), fmtNum(this.blooms)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, in turn from session to session among those the session fits: the halves in
   * step (Colossians 2:2, "knit together"), a lesson learned (Psalm 86:11, "teach me Your way"), a calm rest
   * that consolidated paths (Psalm 16:7, "even at night"), the map growing (1 Corinthians 2:16), the network
   * grown (Ephesians 4:16); else Romans 12:2.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('rom12.2');
    if (this.stepBest >= 5) fit.push('col2.2');
    if (this.learnedNow.length) fit.push('psa86.11');
    if (this.consolidatedNow > 0 || this.passedRests > 0) fit.push('psa16.7');
    if (this.regionsNow.length) fit.push('1co2.16');
    if (this.score >= 12) fit.push('eph4.16');
    fit.push('rom12.2');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.learnedNow.length) add(0, t('hl.close.learned', { lesson: lessonTitle(this.learnedNow[this.learnedNow.length - 1].id) }));
    else if (this.consolidatedNow > 0) add(0, t('hl.close.kept'));
    else if (this.started) add(0, t('hl.close.grew'));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(1, t('hl.record', { conn: connText(this.score) }));
    else if (this.bestBefore !== null && this.score > 0 && this.bestBefore - this.score <= Math.max(6, this.bestBefore * 0.3)) {
      add(1, t('hl.toBest', { conn: connText(this.bestBefore - this.score) }));
    }
    // the lessons learned before the last one (the last is the closing line)
    const before = this.learnedNow.slice(0, -1);
    if (before.length) add(2, t('hl.lesson', { lesson: before.map(L => lessonTitle(L.id)).join(', ') }));
    if (this.fastestMs > 0 && (this.p.fastest === 0 || this.fastestMs <= this.p.fastest)) add(3, t('hl.fastest', { ms: msText(this.fastestMs) }));
    if (this.stepBest >= 5) add(3, t('hl.inStep', { s: secText(this.stepBest) }));
    if (this.consolidatedNow > 0) add(4, t('hl.kept', { n: this.consolidatedNow }));
    if (this.cardsNow.length) add(5, t('hl.cards', { names: this.cardsNow.slice(0, 3).map(cardTitle).join(', ') }));
    if (this.blooms > 0) add(6, t('hl.blooms', { n: this.blooms }));
    if (this.blindShare >= 0) add(7, t('hl.blind', { n: this.blindShare }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
