/**
 * Nehemiasz's session, without the DOM: the blocks (a day = a rest block, a night = a push block),
 * Nehemiah walking the city and building on the markers, the builders laying the wall course by course
 * (the headline: cubits raised), the stores, the people and their strength, the decrees, the raiders
 * coming down the three roads at night, the watch fires whose reach the band drives, the towers, the
 * guards and the ram's horn, the calendar of 52 days through ten gates, Tirza's and the villains'
 * lines, and the session's numbers.  The view (render.ts) reads its state and its events (`take()`);
 * the index wires both to the runner.
 *
 * Never a punishment: raiders pry stones and steal a little, a breach is mended by day, the session
 * never ends early; the band only adds reach, rhythm and the horn.
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  DECREE, DECREES, FIRE_IDS, GATES, GATE_SEG, LINES, MARKERS, MAX_LEVEL, POST_IDS, RAIDER_FROM, ROUTES, ROUTE_IDS, SEGS, TIPS,
  TOWER_IDS, TOWNS, gateDays, gateFirstDay, gateName, markerSpec, routeAt, routeLen, segAt, segMid, tierCubits, townName,
  type Band, type Cost, type DecreeId, type Kind, type MarkerSpec, type RaiderKind, type RouteId, type TownId,
} from './content';
import { cubits as cubitsText, t, unit } from './i18n';
import {
  bestFor, breadCap, canPay, costOf, decreeOn, freshStretch, heightOf, isOpen, jobs, lenKey, levelCap, maxHp, perkLevel, room,
  standing, starsOf, stoneCap, type Jobs, type NehProgress,
} from './meta';
import { RULES } from './rules';
import { Talk } from './talk';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';
export type Coach = 'move' | 'guide' | 'build' | 'front' | 'preview' | 'night' | 'light' | 'horn' | 'day' | 'decree' | 'breach' | 'bread' | 'choice' | 'ono';

export interface Nehemiah {
  x: number; y: number; face: 1 | -1; walking: number; still: number;
  /** a marker to build on arrival, and where he is walking by himself */
  order: string | null;
  goal: { x: number; y: number } | null;
  /** a build in progress: the marker, the time, the level it raises to, what was paid */
  build: { id: string; t: number; level: number; cost: Cost } | null;
  tried: boolean;
}
export interface Follower { x: number; y: number; face: 1 | -1; walking: number }
export type RState = 'walk' | 'sling' | 'stop' | 'foot' | 'pry' | 'climb' | 'inside' | 'grab' | 'out' | 'flee';
export interface Raider {
  id: number; kind: RaiderKind; route: RouteId; band: Band;
  /** distance along the road (walking), position (u), state and its timer */
  d: number; x: number; y: number; state: RState; t: number;
  courage: number; max: number;
  /** the wall segment it goes for and the point at its foot */
  seg: number; tx: number;
  loot: 'stone' | 'bread' | null; lootN: number; store: string | null;
  hit: number; seen: boolean; face: 1 | -1; seed: number; off: number;
}
export interface Pebble { id: number; x0: number; y0: number; target: number; tx: number; ty: number; t: number; dur: number; dmg: number; volley: boolean }
export interface Jab { x: number; y: number; tx: number; ty: number; t: number }
export interface Ring { x: number; y: number; r: number; t: number; dur: number; kind: 'horn' | 'build' | 'tier' | 'breach' | 'rout' }
export type Hero = 'hanani' | 'hananiah';
export interface Guard { id: number; post: string; hx: number; hy: number; x: number; y: number; cool: number; face: 1 | -1; hero: Hero | null; jab: number }
export interface Spawn { wave: number; sec: number; route: RouteId; kind: RaiderKind; done: boolean }
export interface Preview { route: RouteId; counts: Partial<Record<RaiderKind, number>>; total: number }
export interface Choice { kind: 'decree' | 'tower'; options: string[]; t: number; marker: string | null }
export type StoryKind = 'open' | 'gate' | 'done' | 'horn' | 'ono' | 'wall' | 'dedication' | 'year';
export interface Story { kind: StoryKind; t: number; dur: number; gate: number; next: number; stars: number; year: number }
export interface Messenger { x: number; y: number; t: number; held: number; state: 'come' | 'wait' | 'go'; answered: boolean }
export interface Fox { x: number; t: number }
export interface MarkerView {
  id: string; kind: Kind; x: number; y: number; level: number;
  /** the level a build gives next (null: at the top, capped, or a tier still being laid), its cost, whether it can be paid */
  next: number | null; cost: Cost | null; can: boolean; capped: boolean;
  /** a wall's or gate's tier being laid: the share laid (0..1) */
  working: number | null;
}

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'finale' }
  | { type: 'done' }
  | { type: 'coach'; what: Coach; x: number; y: number }
  | { type: 'dawn'; day: number; gate: number }
  | { type: 'night'; blind: boolean; captain: boolean }
  | { type: 'pay'; id: string; x: number; y: number; stone: number; timber: number }
  | { type: 'built'; id: string; kind: Kind; level: number; x: number; y: number }
  | { type: 'cancel'; id: string }
  | { type: 'missing'; id: string; x: number; y: number; stone: number; timber: number }
  | { type: 'tier'; seg: number; level: number; x: number }
  | { type: 'mend'; seg: number; x: number }
  | { type: 'dressed'; seg: number; n: number; x: number }
  | { type: 'timber'; n: number }
  | { type: 'newcomers'; n: number; town: TownId; first: boolean }
  | { type: 'hunger'; unfed: number }
  | { type: 'decree'; id: DecreeId }
  | { type: 'sabbath' }
  | { type: 'spawn'; id: number; kind: RaiderKind; route: RouteId }
  | { type: 'sling'; x: number; y: number; tx: number; ty: number }
  | { type: 'bonk'; id: number; x: number; y: number; volley: boolean }
  | { type: 'jab'; x: number; y: number }
  | { type: 'driven'; id: number; x: number; y: number; kind: RaiderKind }
  | { type: 'breach'; seg: number; x: number }
  | { type: 'climb'; x: number; y: number }
  | { type: 'grab'; x: number; y: number; what: 'stone' | 'bread'; n: number }
  | { type: 'plunder'; what: 'stone' | 'bread'; n: number }
  | { type: 'recovered'; what: 'stone' | 'bread'; n: number; x: number; y: number }
  | { type: 'dim'; fire: string; x: number; y: number }
  | { type: 'hornReady' }
  | { type: 'horn'; x: number; y: number; n: number }
  | { type: 'report'; standing: number; driven: number; lost: number; held: boolean; share: number | null }
  | { type: 'dayBonus'; n: number }
  | { type: 'nightHeld' }
  | { type: 'invite' }
  | { type: 'ono'; answered: boolean }
  | { type: 'fox' }
  | { type: 'gateDone'; gate: number; stars: number }
  | { type: 'captain' }
  | { type: 'hero'; hero: Hero };

const NO_EVENTS: readonly SimEvent[] = [];
const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

// ── pure rules ───────────────────────────────────────────────────
/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/** The last stretch without a block (the next dawn): 12 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/**
 * The session's blocks.  It opens with a day: the warm-up in a first-ever session (30 s in 5 and 10
 * min, 20 s in 3, 6 s in a 40 s test), a rest block (a working day) later; then nights and days
 * alternate (26 ± 4 s and 24 ± 3 s, scaled to end on time, jittered only when there is room) and end
 * on a night, leaving the last stretch for the next dawn.  No block under 12 s.
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
    const day = Math.max(R.minBlock, Math.min(14, left / 2));
    return [b('rest', day), b('push', Math.max(R.minBlock, left - day))];
  }
  const plan: Block[] = [];
  let left = plannedSec - fin;
  const P = R.push[0], D = R.rest[0];
  if (firstEver) {
    const warm = plannedSec >= 300 ? R.warm.long : R.warm.short;
    plan.push(b('warmup', warm));
    left -= warm;
  }
  // first-ever: k nights and k − 1 days after the warm-up; later: k days and k nights
  const nominal = (k: number) => (firstEver ? k * P + (k - 1) * D : k * (P + D));
  // as many blocks as fit without stretching them past their nominal length (more, shorter blocks rather than long ones)
  const raw = firstEver ? (left + D) / (P + D) : left / (P + D);
  let k = Math.max(1, Math.ceil(raw - 1e-9));
  if (k > 1 && left / nominal(k) < 0.8) k -= 1;
  const kinds: BlockKind[] = [];
  for (let i = 0; i < k; i++) {
    if (firstEver) {
      kinds.push('push');
      if (i < k - 1) kinds.push('rest');
    } else kinds.push('rest', 'push');
  }
  const jitter = kinds.length >= 4 && left / nominal(k) >= 0.85 && left / nominal(k) <= 1.06 ? 1 : 0;
  const durs = kinds.map(kind => (kind === 'push' ? R.push[0] + jitter * (rnd() * 2 - 1) * R.push[1] : R.rest[0] + jitter * (rnd() * 2 - 1) * R.rest[1]));
  const scale = left / durs.reduce((s, d) => s + d, 0);
  for (let i = 0; i < durs.length; i++) durs[i] *= scale;
  liftShort(durs, R.minBlock);
  kinds.forEach((kind, i) => plan.push(b(kind, durs[i])));
  return plan;
}

/** A fire's light (u) at a level of the band: the base, plus the extra the focus adds. */
export const fireReach = (fireLevel: number, light: number): number =>
  fireLevel <= 0 ? 0 : RULES.fireBase[fireLevel] + clamp(light) * RULES.fireExtra[fireLevel];

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: NehProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

export class NehSim {
  readonly p: NehProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  readonly talk: Talk;
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly holdNeed: number;
  private readonly restLead: number;
  readonly finaleSec: number;

  started = false;
  readonly session: number;
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  phase: Phase = 'play';
  t = 0;
  tip = '';
  story: Story | null = null;
  private readonly stories: Story[] = [];
  choice: Choice | null = null;
  private readonly choices: Choice[] = [];

  // the world
  readonly neh: Nehemiah = { x: 9, y: 8.1, face: 1, walking: 0, still: 0, order: null, goal: null, build: null, tried: false };
  readonly tirza: Follower = { x: 8.2, y: 8.4, face: 1, walking: 0 };
  readonly raiders: Raider[] = [];
  readonly pebbles: Pebble[] = [];
  readonly jabs: Jab[] = [];
  readonly rings: Ring[] = [];
  guards: Guard[] = [];
  /** the fires' light now (u) and how much slingers have dimmed them (share) */
  readonly fireR: Record<string, number> = {};
  readonly fireDim: Record<string, number> = {};
  /** each tower's slingers' cooldowns (s) */
  private readonly towerCool: Record<string, number[]> = {};
  /** slingers manning each tower now */
  readonly manned: Record<string, number> = {};
  private flare = 0;
  rally = 0;
  messenger: Messenger | null = null;
  fox: Fox | null = null;
  private foxDue = false;
  private foxMocked = false;
  private spawns: Spawn[] = [];
  private spawnsPlanned = false;
  preview: Preview[] = [];
  private nightT = 0;
  /** the villains on the hill (0..1, how far they have come out) */
  villains = 0;
  private sneerSaid = false;
  private nextId = 1;
  /** hit-stop (s left), and the world's time this frame / real time */
  stop = 0;
  timeScale = 1;
  private stick = { x: 0, y: 0 };
  private readonly held = new Set<string>();

  // the band
  reliable = false;
  level = 0;
  calm = 0;
  calmShown = 0;
  /** the fires' share of their extra reach (0..1): the band's gauge in a night */
  light = 0;
  /** the builders' rhythm (×1 … ×2.2): the band's gauge in a day */
  rhythm = 1;
  horn = 0;
  hornReady = false;
  private hornT = 0;
  maxHold = 0;
  private goodT = 0;
  private goodSaid = false;
  private relSec = 0;

  // the day
  dayNow = 0;
  sabbathToday = false;
  jobsNow: Jobs = { quarry: 0, bakers: 0, water: 0, guards: 0, builders: 0 };
  /** the segment the builders lay now (−1: none) and the one they mend */
  front = -1;
  mendSeg = -1;
  guideId: string | null = null;
  private guideT = 0;
  captainNight = false;

  // the session's numbers
  cubits = 0;
  driven = 0;
  horns = 0;
  daysBegun = 0;
  nightsHeld = 0;
  nightsAll = 0;
  breaches = 0;
  passedRests = 0;
  mended = 0;
  blindShare = -1;
  onoNow = 0;
  firstDay = 0;
  readonly gatesDone: { gate: number; stars: number }[] = [];
  readonly newTowns: TownId[] = [];
  lootLost = 0;
  lootRecovered = 0;
  wallDone = false;
  private nightDriven = 0;
  /** raiders that reached the wall's foot (tonight, this session) */
  nightReached = 0;
  reached = 0;
  private nightLost = 0;
  private lootBudget = { stone: 0, bread: 0 };
  private settled = false;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  private readonly bestBefore: number | null;
  private readonly bankBefore: number;
  private pryTick = 0;
  /** segments whose breach was announced (until mended) */
  private readonly breachSaid = new Set<number>();

  constructor(init: SimInit) {
    const p = (this.p = init.progress);
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.holdNeed = RULES.holdNeed[band];
    this.restLead = RULES.restLead[band];
    this.finaleSec = finaleFor(init.plannedSec);
    this.bestBefore = bestFor(p, init.plannedSec);
    this.bankBefore = p.starBank;
    this.session = p.sessions + 1;
    this.pushesBase = p.pushes;
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng);
    this.talk = new Talk(LINES, init.rng);
    for (const id of FIRE_IDS) { this.fireR[id] = fireReach(p.stretch[id] ?? 0, 0); this.fireDim[id] = 0; }
  }

  // ── views of the state ──────────────────────────────────────────
  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.phase === 'play'; }
  get pushBlock(): boolean { return this.block?.kind === 'push' && this.phase === 'play'; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.phase === 'play'; }
  get warmBlock(): boolean { return this.block?.kind === 'warmup' && this.phase === 'play'; }
  /** a sighted night past its lead-in: the fires answer the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get leadIn(): number { return this.lead; }
  /** the world is held (a card or a choice) */
  get frozen(): boolean { return !!(this.story || this.choice); }
  /** day work goes on: the warm-up, a day, the next dawn (the finale) */
  get dayTime(): boolean { return this.phase === 'finale' || (this.phase === 'play' && this.block.kind !== 'push'); }
  get nightTime(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  /** the night's raiders are shown at the roads' heads: the last seconds of a day, and its telegraph */
  get showPreview(): boolean {
    if (this.phase !== 'play' || this.block.kind === 'push' || !this.preview.length) return false;
    const nb = this.next;
    return !!nb && nb.kind === 'push' && this.blockT >= this.block.dur - RULES.previewSec;
  }
  /** the gate now being built, its day, the day of the campaign */
  get gate(): number { return this.p.gate; }
  get headlineValue(): number { return Math.floor(this.cubits + 1e-6); }
  get strongLight(): boolean { return this.sighted && this.light >= 0.5; }

  // ── input ───────────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.session === 1 && this.p.gate === 0 && this.p.year === 0 && this.p.gateDay === 0) this.queueStory('open', RULES.openSec);
    this.startBlock(0);
    this.talk.ask('open', 3, 10);
  }

  /** The joystick: a direction with a strength (each −1..1, length ≤ 1). */
  steer(x: number, y: number): void {
    const l = Math.hypot(x, y);
    this.stick = l > 1 ? { x: x / l, y: y / l } : { x, y };
    if (l > 0.05) { this.neh.order = null; this.neh.goal = null; }
  }

  /**
   * A tap (or Space): closes a card that has been read, picks a choice (`card`, or the first); by day
   * builds the marker near `at` (world u), else what the guide suggests; at night blows a ready horn,
   * else sends Nehemiah to where it is hottest.  A tap never hurts.
   */
  tap(at: { x: number; y: number } | null = null, card = -1): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= RULES.minCard) this.closeStory();
      return true;
    }
    if (this.choice) {
      if (this.choice.t >= 0.25) this.pick(card >= 0 ? card : 0);
      return true;
    }
    if (this.nightTime) {
      if (this.hornReady) {
        this.blowHorn();
        return true;
      }
      this.neh.order = null;
      this.neh.goal = this.hotSpot();
      return true;
    }
    // a build in progress finishes first (a tap never cancels it)
    if (this.neh.build) return true;
    // a marker under the tap: build it, or say what it still needs; one that takes no build now (at
    // its top, its tier still being laid) leaves the tap to the guide
    const m = at ? this.markerNear(at.x, at.y, RULES.tapMarker) : null;
    const nl = m ? this.nextLevel(m.id) : null;
    if (m && nl !== null) return this.orderOrSay(m, nl);
    if (!this.guideId) return false;
    this.orderBuild(this.guideId);
    return true;
  }

  /**
   * A tap on a marker's build badge (phones: the badge is the finger-sized target): by day walk there
   * and build it, or say what it still needs; a marker that takes no build now leaves the tap to the
   * guide.  A build in progress finishes first.
   */
  build(id: string): boolean {
    if (!this.started || this.phase === 'done' || this.frozen || !this.dayTime) return false;
    if (this.neh.build) return true;
    const m = markerSpec(id);
    const nl = m ? this.nextLevel(m.id) : null;
    if (!m || nl === null) return this.tap(null);
    return this.orderOrSay(m, nl);
  }

  private orderOrSay(m: MarkerSpec, nl: number): boolean {
    const cost = costOf(m.kind, nl)!;
    if (canPay(this.p, cost)) this.orderBuild(m.id);
    else this.emit({ type: 'missing', id: m.id, x: m.x, y: m.y, stone: Math.max(0, Math.ceil(cost.stone - this.p.stone)), timber: Math.max(0, Math.ceil(cost.timber - this.p.timber)) });
    return true;
  }

  /** The night's button ("To the wall!"): Nehemiah runs to where it is hottest — never the horn, which has its own button. */
  rush(): boolean {
    if (!this.started || this.phase === 'done' || this.frozen || !this.nightTime) return false;
    this.neh.order = null;
    this.neh.goal = this.hotSpot();
    return true;
  }

  /** Arrows and WASD walk, Space and Enter tap, 1–2 pick a choice. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const dirs = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'];
    const kk = k.toLowerCase();
    if (dirs.includes(kk)) {
      if (down) {
        this.held.add(kk);
        this.neh.order = null;
        this.neh.goal = null;
      } else this.held.delete(kk);
      return true;
    }
    if (!down) return k === ' ' || k === 'Enter';
    if (k === ' ' || k === 'Enter' || k === 'Spacebar') {
      this.tap(null);
      return true;
    }
    if (this.choice && (k === '1' || k === '2' || k === '3')) {
      this.tap(null, Number(k) - 1);
      return true;
    }
    return false;
  }

  /** Let go of everything (pause). */
  release(): void {
    this.held.clear();
    this.stick = { x: 0, y: 0 };
  }

  private keyStick(): { x: number; y: number } {
    const h = this.held;
    const x = (h.has('arrowright') || h.has('d') ? 1 : 0) - (h.has('arrowleft') || h.has('a') ? 1 : 0);
    const y = (h.has('arrowdown') || h.has('s') ? 1 : 0) - (h.has('arrowup') || h.has('w') ? 1 : 0);
    return { x, y };
  }

  // ── the cards ───────────────────────────────────────────────────
  private queueStory(kind: StoryKind, dur: number = RULES.storySec, o: Partial<Story> = {}): void {
    const s: Story = { kind, t: 0, dur, gate: this.p.gate, next: this.p.gate, stars: 0, year: this.p.year, ...o };
    // the opening card shows at once; the rest wait until the runner's block banner has gone
    if (!this.story && kind === 'open') this.story = s;
    else this.stories.push(s);
  }

  /** The runner shows its banner over the first seconds of every block but the first. */
  get bannerUp(): boolean { return this.phase === 'play' && this.blockIndex > 0 && this.blockT < RULES.bannerSec; }

  /** A waiting card comes up when the way is clear (no card, no banner); a choice after the stories. */
  private nextCard(): void {
    if (this.story || this.bannerUp) return;
    const s = this.stories.shift();
    if (s) {
      this.story = s;
      this.talk.clear();
      return;
    }
    if (!this.choice) {
      const c = this.choices.shift();
      if (c) this.choice = c;
    }
  }

  private closeStory(): void {
    this.story = null;
    this.nextCard();
  }

  private queueChoice(c: Choice): void {
    this.choices.push(c);
    this.nextCard();
  }

  /** Pick a choice's option (a decree, a tower's way). */
  pick(i: number): boolean {
    const c = this.choice;
    if (!c) return false;
    const opt = c.options[clamp(Math.floor(i), 0, c.options.length - 1)];
    if (c.kind === 'decree') this.applyDecree(opt as DecreeId);
    else if (c.marker) {
      this.p.towerKind[c.marker] = opt === 'quick' ? 'quick' : 'far';
      this.emit({ type: 'built', id: c.marker, kind: 'tower', level: this.p.stretch[c.marker] ?? 2, x: markerSpec(c.marker)!.x, y: markerSpec(c.marker)!.y });
    }
    this.choice = null;
    this.nextCard();
    return true;
  }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.stop = Math.max(0, this.stop - dt);
    this.timeScale = this.frozen || this.stop > 0 ? 0 : 1;
    const w = dt * this.timeScale;
    if (!this.story && !this.choice) this.nextCard();
    if (this.story) {
      this.story.t += dt;
      if (this.story.t >= this.story.dur) this.closeStory();
    } else if (this.choice) {
      this.choice.t += dt;
      if (this.choice.t >= RULES.choiceSec) this.pick(0);
    }
    this.brain(dt, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.endFinale();
    if (w > 0 && this.phase !== 'done') {
      this.jobsNow = jobs(this.p, this.guardSlots());
      this.moveNeh(w);
      this.moveTirza(w);
      if (this.dayTime) this.work(w);
      if (this.nightTime) this.nightFrame(w);
      this.hill(w);
      this.guideT -= w;
      if (this.guideT <= 0) {
        this.guideT = 0.25;
        this.guideId = this.dayTime ? this.guide() : null;
      }
    }
    this.fx(dt);
    this.talk.update(dt, t, this.talkBlocked);
  }

  get talkBlocked(): boolean {
    const b = this.block;
    const tele = this.phase === 'play' && b && this.blockT >= b.dur - RULES.telegraph;
    const banner = this.phase === 'play' && this.blockT < RULES.bannerSec && this.blockIndex > 0;
    return !!(tele || banner || this.story || this.choice);
  }

  /** The band's slow quantities: the fires' light, the horn from a held focus, the builders' rhythm. */
  private brain(dt: number, f: FocusFrame): void {
    const R = RULES, b = this.block;
    const play = this.phase === 'play';
    this.reliable = f.reliable;
    this.level = f.reliable ? f.level : 0;
    this.calm = f.reliable ? f.calm : 0;
    this.calmShown = approach(this.calmShown, this.calm, dt, 0.6);
    if (play && f.reliable) this.relSec += dt;
    const live = this.sighted && f.reliable;
    this.light = approach(this.light, live ? clamp(f.level) : 0, dt, R.fireTau);
    this.flare = Math.max(0, this.flare - dt);
    for (const id of FIRE_IDS) {
      const lv = this.p.stretch[id] ?? 0;
      this.fireDim[id] = Math.max(0, (this.fireDim[id] ?? 0) - R.dimFade * dt);
      const want = lv > 0 ? fireReach(lv, this.light) * (1 - this.fireDim[id]) + (this.flare > 0 ? 0.6 : 0) : 0;
      this.fireR[id] = approach(this.fireR[id] ?? want, want, dt, 0.25);
    }
    if (live) this.maxHold = Math.max(this.maxHold, f.hold);
    if (live && f.hold >= this.holdNeed && this.timeScale > 0) this.addHorn(R.hornRate * (1 + 0.2 * perkLevel(this.p, 'trebacz')) * dt);
    if (live && f.level >= 0.5) this.goodT += dt;
    else this.goodT = 0;
    if (this.goodT >= R.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 4);
    }
    if (live && this.blockT >= this.lead + 0.5) this.coach('light', 9, R.wallY - 1.4);
    const restLive = play && b.kind === 'rest' && this.blockT >= this.restLead && f.reliable && !this.sabbathToday;
    this.rhythm = restLive ? 1 + R.rhythmExtra * clamp(f.calm) : 1;
    // the invitation to Ono: a held focus answers it
    const m = this.messenger;
    if (m && m.state === 'wait' && !m.answered && live && f.level >= 0.5) {
      m.held += dt;
      if (m.held >= R.onoHold) this.answerOno();
    }
  }

  private addHorn(v: number): void {
    if (this.hornReady || !(v > 0)) return;
    this.horn = Math.min(1, this.horn + v);
    if (this.horn >= 1 - 1e-9) {
      this.horn = 1;
      this.hornReady = true;
      this.hornT = 0;
      this.emit({ type: 'hornReady' });
      this.talk.ask('hornReady', 3, 4);
      this.coach('horn', this.neh.x, this.neh.y - 1);
    }
  }

  /** The ram's horn where Nehemiah stands: every raider near him loses heart, the towers loose a volley, the guards rally to him. */
  blowHorn(): boolean {
    if (!this.hornReady) return false;
    this.hornReady = false;
    this.horn = 0;
    this.hornT = 0;
    this.horns++;
    const n = this.neh, R = RULES;
    let k = 0;
    for (const r of this.raiders) {
      if (r.state === 'flee') continue;
      if (dist(r.x, r.y, n.x, n.y) <= R.hornR) {
        this.rout(r, true);
        k++;
      }
    }
    // the great volley: every tower's slingers at once, at everything they can see
    for (const id of TOWER_IDS) {
      const lv = this.p.stretch[id] ?? 0;
      if (!lv) continue;
      const m = markerSpec(id)!;
      const range = this.towerRange(id);
      const targets = this.raiders.filter(r => r.state !== 'flee' && r.seen && dist(r.x, r.y, m.x, R.wallY) <= range * 1.2).slice(0, R.volley);
      for (const r of targets) this.launch(m.x, R.wallY - 0.5, r, 2, true);
    }
    this.rally = R.rallySec;
    this.flare = 3;
    this.rings.push({ x: n.x, y: n.y, r: R.hornR, t: 0, dur: 1.1, kind: 'horn' });
    this.stop = Math.max(this.stop, 0.12);
    this.emit({ type: 'horn', x: n.x, y: n.y, n: k });
    this.talk.ask('horn', 3, 4);
    if (!this.p.cards.includes('horn')) {
      this.p.cards.push('horn');
      this.hornStory = true;
    }
    return true;
  }
  private hornStory = false;

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('day', this.frontX(), R.wallY);
    if (b.kind === 'push' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('night', 9, R.wallY - 2);
    if (this.showPreview && this.preview.length) {
      const top = [...this.preview].sort((a, c) => c.total - a.total)[0];
      const pt = routeAt(top.route, 1.2);
      this.coach('preview', pt.x, pt.y);
    }
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
    // what was still waiting to be said belonged to the block before
    this.talk.clear();
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.startNight(b);
    } else this.startDay(b);
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

  /** The block's end: its verdict and what it pays — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0, need = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
    }
    if (b.kind === 'push') this.endNight(b, verdict, share);
    else this.endDay(b, verdict);
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  // ── the calendar: dawn and dusk ─────────────────────────────────
  /** Dawn: the day's number, a gate finished and the next begun, deliveries, newcomers, decrees, tonight's plan. */
  private startDay(b: Block): void {
    const p = this.p, R = RULES;
    this.daysBegun++;
    if (p.gateDay >= gateDays(p.gate)) this.finishGate();
    p.gateDay += 1;
    p.day = gateFirstDay(p.gate) + p.gateDay - 1;
    this.dayNow = p.day;
    if (!this.firstDay) this.firstDay = p.day;
    const opening = this.story?.kind === 'open';
    if (p.gateDay === 1 && !opening) {
      if (p.year > 0 && p.gate === 0) this.queueStory('year', R.storySec, { year: p.year });
      this.queueStory('gate', R.storySec);
    }
    if (this.hornStory) {
      this.hornStory = false;
      this.queueStory('horn', R.storySec);
    }
    // the decrees age; a sabbath ordered yesterday is today
    for (const [k, v] of Object.entries(p.decrees)) {
      if (v <= 1) delete p.decrees[k];
      else p.decrees[k] = v - 1;
    }
    this.sabbathToday = p.sabbath;
    p.sabbath = false;
    if (this.sabbathToday) {
      p.strength = 1;
      this.emit({ type: 'sabbath' });
    }
    // deliveries at dawn: timber from the king's forest, stones from the rubble heaps
    const timber = Math.max(0, R.dawnTimber + perkLevel(p, 'drewno') - (decreeOn(p, 'upal') ? DECREE.upal.nums.timber : 0));
    p.timber += timber;
    p.stone = Math.min(stoneCap(p), p.stone + R.dawnStone);
    if (timber > 0) this.emit({ type: 'timber', n: timber });
    let extra = 0;
    if (decreeOn(p, 'stol')) {
      p.bread = Math.max(0, p.bread - DECREE.stol.nums.bread);
      p.strength = Math.min(1, p.strength + DECREE.stol.nums.pct / 100);
      extra += DECREE.stol.nums.n;
    }
    if (this.dlugiNext) {
      extra += DECREE.dlugi.nums.n;
      this.dlugiNext = false;
    }
    this.newcomers(extra);
    // a decree to choose at the dawn of every third day (never the very first morning)
    if (p.day % R.decreeEvery === 0 && !(this.session === 1 && this.daysBegun === 1)) this.offerDecrees();
    // the fox comes for the joke once a stretch stands at full height somewhere
    if (this.foxDue) {
      this.foxDue = false;
      this.fox = { x: -0.6, t: -R.sneerAt * b.dur - 2 };
      this.foxMocked = false;
    }
    // tonight's raiders, shown at the roads' heads before dusk
    const nb = this.plan[this.blockIndex + 1];
    this.planNight(nb && nb.kind === 'push' ? nb.dur : R.push[0]);
    this.sneerSaid = false;
    this.talk.ask(b.kind === 'warmup' ? 'warm' : 'day', 2, 12);
    if (b.kind === 'warmup') this.coach('move', this.neh.x, this.neh.y);
    this.coach('guide', 9, 7);
    if (p.gate === 4 && p.gateDay === 1) this.talk.ask('dung', 2, 14);
    else if (p.gateDay === 1 && this.daysBegun > 1) this.talk.ask('gate', 2, 12);
    this.emit({ type: 'dawn', day: p.day, gate: p.gate });
  }
  private dlugiNext = false;

  private newcomers(extra: number): void {
    const p = this.p, R = RULES;
    const left = room(p) - p.people;
    if (left <= 0) return;
    if (p.bread < p.people * 0.5 && extra === 0) return;
    const n = Math.min(left, R.newBase + Math.floor(Math.max(0, p.day - 1) / R.newPerDays) + extra);
    if (n <= 0) return;
    const town = TOWNS[p.arrivals % TOWNS.length];
    p.arrivals++;
    p.people += n;
    const key = `town:${town}`;
    const first = !p.chronicle.includes(key);
    if (first) {
      p.chronicle.push(key);
      this.newTowns.push(town);
    }
    this.emit({ type: 'newcomers', n, town, first });
    this.talk.ask('newcomers', 1, 6);
  }

  private offerDecrees(): void {
    const free = DECREES.filter(id => !decreeOn(this.p, id) && !(id === 'szabat' && this.p.sabbath));
    const a = free[Math.floor(this.rng() * free.length)];
    const rest = free.filter(id => id !== a);
    const b = rest[Math.floor(this.rng() * rest.length)];
    if (!a || !b) return;
    this.queueChoice({ kind: 'decree', options: [a, b], t: 0, marker: null });
    this.coach('decree', 9, 7);
    this.talk.ask('decree', 2, 8);
  }

  private applyDecree(id: DecreeId): void {
    const p = this.p, d = DECREE[id];
    switch (id) {
      case 'dlugi':
        p.bread = Math.max(0, p.bread - d.nums.bread);
        p.strength = Math.min(1, p.strength + d.nums.pct / 100);
        this.dlugiNext = true;
        break;
      case 'asaf':
        p.timber += d.nums.timber;
        p.bread = Math.max(0, p.bread - d.nums.bread);
        break;
      case 'szabat':
        p.sabbath = true;
        break;
      default:
        p.decrees[id] = d.days;
    }
    this.emit({ type: 'decree', id });
  }

  private endDay(b: Block, verdict: boolean | null): void {
    if (b.kind === 'rest' && verdict) {
      this.passedRests++;
      const p = this.p, n = RULES.dayBonus;
      p.stone = Math.min(stoneCap(p), p.stone + n);
      p.bread = Math.min(breadCap(p), p.bread + n);
      this.emit({ type: 'dayBonus', n });
    }
    this.sabbathToday = false;
  }

  /** Dusk: everyone eats, the night's raiders are set, the horn starts from what was kept. */
  private startNight(b: Block): void {
    const p = this.p, R = RULES;
    this.nightsAll++;
    this.nightT = 0;
    if (this.neh.build) this.finishBuild();
    this.neh.order = null;
    const eat = Math.max(0, Math.floor(p.people));
    if (p.bread >= eat) {
      p.bread -= eat;
      p.strength = Math.min(1, p.strength + R.fed);
    } else {
      const unfed = eat - Math.floor(p.bread);
      p.bread = 0;
      p.strength = Math.max(R.strengthMin, p.strength - R.hunger * (unfed / Math.max(1, eat)));
      this.emit({ type: 'hunger', unfed });
      this.talk.ask('hunger', 2, 8);
      this.coach('bread', MARKERS.find(m => m.id === 'bakery')!.x, MARKERS.find(m => m.id === 'bakery')!.y);
    }
    if (decreeOn(p, 'nocleg')) p.strength = Math.max(R.strengthMin, p.strength - DECREE.nocleg.nums.pct / 100);
    if (!this.spawnsPlanned) this.planNight(b.dur);
    else this.fitNight(b.dur);
    this.spawnsPlanned = false;
    this.horn = clamp(p.hornCarry + (this.sabbathToday ? DECREE.szabat.nums.horn / 100 : 0));
    p.hornCarry = 0;
    this.hornReady = false;
    if (this.horn >= 1) { this.horn = 0.999; this.addHorn(0.01); }
    this.lootBudget = { stone: p.stone * R.lootCap, bread: p.bread * R.lootCap };
    this.nightDriven = 0;
    this.nightReached = 0;
    this.nightLost = 0;
    this.goodT = 0;
    this.goodSaid = false;
    this.captainNight = p.gateDay >= gateDays(p.gate);
    this.rebuildGuards();
    this.messenger = null;
    this.talk.ask(b.blind ? 'blind' : 'night', 2, 12);
    this.emit({ type: 'night', blind: b.blind, captain: this.captainNight });
  }

  /** Dawn after a night: the rest of the raiders run, the wall is counted, the horn keeps what was earned. */
  private endNight(b: Block, verdict: boolean | null, share: number): void {
    const p = this.p, R = RULES;
    for (const r of this.raiders) if (r.state !== 'flee') this.rout(r, false);
    if (this.messenger && this.messenger.state !== 'go') this.messenger.state = 'go';
    const breached = p.wall.some((s, i) => s.hp <= 0 && heightOf(i, s) >= R.openBelow);
    if (breached) p.breached = true;
    const held = !breached;
    if (held) {
      this.nightsHeld++;
      p.strength = Math.min(1, p.strength + R.heldBonus);
    } else p.strength = Math.min(1, p.strength + R.word);
    let carry = this.hornReady ? 1 : this.horn * 0.5;
    if (verdict) carry = Math.max(carry, R.hornKeep);
    let s: number | null = null;
    if (b.blind) {
      s = this.judge.measured > 0 ? share : 0;
      this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
      carry = Math.min(1, carry + s);
    }
    p.hornCarry = clamp(carry);
    this.horn = 0;
    this.hornReady = false;
    this.rally = 0;
    this.emit({ type: 'report', standing: standing(p), driven: this.nightDriven, lost: this.nightLost, held, share: s });
    if (verdict) this.emit({ type: 'nightHeld' });
    if (held) {
      this.talk.ask('held', 2, 10);
      if (this.nightDriven >= 3) this.talk.ask('lost', 1, 12);
    } else this.talk.ask('breach', 1, 8);
  }

  /** The gate's last day is behind: its stars, the chronicle, the next gate's stretch (or the wall finished). */
  private finishGate(): void {
    const p = this.p, g = p.gate;
    const stars = starsOf(p);
    const gain = Math.max(0, stars - (p.stars[g] ?? 0));
    p.stars[g] = Math.max(p.stars[g] ?? 0, stars);
    p.starBank += gain;
    const key = `gate:${GATES[g]}`;
    if (!p.chronicle.includes(key)) p.chronicle.push(key);
    this.gatesDone.push({ gate: g, stars });
    this.emit({ type: 'gateDone', gate: g, stars });
    if (g >= GATES.length - 1) {
      this.queueStory('wall', RULES.storySec + 1, { gate: g, stars });
      this.queueStory('dedication', RULES.storySec + 2, { gate: g, stars });
      this.wallDone = true;
      p.year += 1;
      p.gate = 0;
    } else {
      this.queueStory('done', RULES.storySec, { gate: g, next: g + 1, stars });
      p.gate = g + 1;
    }
    p.gateDay = 0;
    freshStretch(p);
    for (const id of FIRE_IDS) this.fireR[id] = fireReach(p.stretch[id] ?? 0, 0);
  }

  // ── the night's raiders ─────────────────────────────────────────
  /** Tonight's raiders: how many, of which kinds, by which road and when (three waves). */
  private planNight(dur: number): void {
    const p = this.p, R = RULES;
    const durK = clamp(dur / 24, 0.5, 1.3);
    const level = p.gate + p.year * GATES.length;
    const gentle = this.session === 1 && this.nightsAll === 0 && p.gate === 0 && p.year === 0;
    let n = gentle ? R.firstNight
      : Math.round((R.nightBase + R.nightPerDay * Math.max(0, p.gateDay - 1) + R.nightPerGate * p.gate) * (1 + R.yearUp * p.year) * durK);
    n = Math.max(2, n);
    const kinds: RaiderKind[] = [];
    const tall = p.wall.some(s => s.done >= 2);
    for (let i = 0; i < n; i++) {
      const r = this.rng();
      let k: RaiderKind = 'rabus';
      if (level >= RAIDER_FROM.procarz && r < 0.2) k = 'procarz';
      else if (level >= RAIDER_FROM.drabina && tall && r < 0.36) k = 'drabina';
      kinds.push(k);
    }
    const lastDay = p.gateDay >= gateDays(p.gate);
    if (level >= RAIDER_FROM.taran && p.gateDay >= 2) kinds.splice(Math.floor(kinds.length / 2), 0, 'taran');
    if (lastDay && !gentle) kinds.splice(Math.floor(kinds.length / 2), 0, 'kapitan');
    const main = ROUTE_IDS[Math.floor(this.rng() * ROUTE_IDS.length)];
    this.spawns = kinds.map((kind, i) => {
      const wave = kind === 'taran' || kind === 'kapitan' ? 1 : i / kinds.length < 0.4 ? 0 : i / kinds.length < 0.75 ? 1 : 2;
      const route: RouteId = kind === 'taran' || kind === 'kapitan' ? 'centre' : this.rng() < 0.5 ? main : ROUTE_IDS[Math.floor(this.rng() * ROUTE_IDS.length)];
      return { wave, sec: 0, route, kind, done: false };
    });
    this.fitNight(dur);
    const pv: Preview[] = ROUTE_IDS.map(route => ({ route, counts: {}, total: 0 }));
    for (const s of this.spawns) {
      const v = pv.find(x => x.route === s.route)!;
      v.counts[s.kind] = (v.counts[s.kind] ?? 0) + 1;
      v.total++;
    }
    this.preview = pv.filter(v => v.total > 0);
    this.spawnsPlanned = true;
  }

  /** The waves' seconds for a night of `dur` s (the last wave still reaches the wall before dawn). */
  private fitNight(dur: number): void {
    const R = RULES;
    const k = clamp(dur / 24, 0.45, 1.3);
    const latest = Math.max(R.waves[0], dur - 7);
    const n = [0, 0, 0];
    for (const s of this.spawns) {
      const base = Math.min(latest, R.waves[s.wave] * k);
      s.sec = base + (n[s.wave]++) * R.waveGap;
    }
  }

  private nightFrame(w: number): void {
    const R = RULES;
    this.nightT += w;
    // the raiders come
    for (const s of this.spawns) {
      if (s.done || this.nightT < s.sec) continue;
      s.done = true;
      this.spawn(s.kind, s.route);
    }
    // the invitation to Ono, mid-night
    const key = this.p.year * 10 + this.p.gate;
    if (!this.messenger && this.sighted && this.p.gate + this.p.year * 10 >= R.onoFrom && this.p.ono + this.onoNow < R.onoMax
      && this.p.onoGate !== key && this.nightT >= R.onoAt && this.nightT < R.onoAt + w + 1e-9) {
      this.p.onoGate = key;
      this.messenger = { x: 9.7, y: -0.6, t: 0, held: 0, state: 'come', answered: false };
      this.emit({ type: 'invite' });
      this.talk.ask('invite', 4, 6);
      this.coach('ono', 9.7, 3);
    }
    this.moveMessenger(w);
    // the horn waits for a tap; after a while it goes by itself when there is someone to hear it
    if (this.hornReady) {
      this.hornT += w;
      if (this.hornT >= R.hornAuto && this.raiders.some(r => r.state !== 'flee')) this.blowHorn();
    }
    this.rally = Math.max(0, this.rally - w);
    this.moveRaiders(w);
    this.towers(w);
    this.guardsFrame(w);
    this.nearHeart(w);
    this.flyPebbles(w);
  }

  private spawn(kind: RaiderKind, route: RouteId): void {
    const p = this.p, R = RULES;
    const k = 1 + R.perGate * p.gate + R.perYear * p.year;
    const courage = R.courage[kind] * k;
    const start = routeAt(route, 0);
    const r: Raider = {
      id: this.nextId++, kind, route, band: ROUTES[route].band, d: 0, x: start.x, y: start.y, state: 'walk', t: 0,
      courage, max: courage, seg: ROUTES[route].seg, tx: segMid(ROUTES[route].seg), loot: null, lootN: 0, store: null,
      hit: 0, seen: false, face: 1, seed: this.rng(), off: (this.rng() - 0.5) * 0.5,
    };
    this.raiders.push(r);
    this.emit({ type: 'spawn', id: r.id, kind, route });
    if (kind === 'kapitan') {
      this.emit({ type: 'captain' });
      this.talk.ask('captain', 3, 6);
    }
  }

  /** Seen by the watch: at the foot of the wall or inside, by Tirza's lamp, or in a fire's light. */
  seenAt(x: number, y: number): boolean {
    const R = RULES;
    if (y >= R.wallOut - R.footBand) return true;
    if (dist(x, y, this.tirza.x, this.tirza.y) <= R.lamp) return true;
    for (const id of FIRE_IDS) {
      const r = this.fireR[id] ?? 0;
      if (r > 0 && dist(x, y, markerSpec(id)!.x, R.wallY) <= r) return true;
    }
    return false;
  }

  private inLight(x: number, y: number): boolean {
    for (const id of FIRE_IDS) {
      const r = this.fireR[id] ?? 0;
      if (r > 0 && dist(x, y, markerSpec(id)!.x, RULES.wallY) <= r) return true;
    }
    return false;
  }

  private moveRaiders(w: number): void {
    const R = RULES, p = this.p;
    const footY = R.wallOut - 0.25;
    for (let i = this.raiders.length - 1; i >= 0; i--) {
      const r = this.raiders[i];
      r.hit = Math.max(0, r.hit - w);
      r.seen = this.seenAt(r.x, r.y);
      const sp = R.speed[r.kind] * (this.strongLight && r.state === 'walk' && this.inLight(r.x, r.y) ? R.hesitate : 1);
      switch (r.state) {
        case 'walk': {
          r.d += sp * w;
          const at = routeAt(r.route, r.d);
          r.x = at.x + r.off * Math.min(1, r.d / 2);
          r.y = at.y;
          if (Math.abs(at.dx) > 0.2) r.face = at.dx > 0 ? 1 : -1;
          if (r.kind === 'procarz' && r.y >= R.wallOut - R.slingAt) {
            r.state = 'sling';
            r.t = this.rng() * R.slingEvery;
          } else if (r.kind === 'kapitan' && r.y >= R.captainStop) r.state = 'stop';
          else if (r.d >= routeLen(r.route)) this.toWall(r);
          break;
        }
        case 'sling': {
          r.t -= w;
          if (r.t <= 0) {
            r.t = R.slingEvery;
            let best: string | null = null, bd = 6;
            for (const id of FIRE_IDS) {
              if (!(p.stretch[id] ?? 0)) continue;
              const d = dist(r.x, r.y, markerSpec(id)!.x, R.wallY);
              if (d < bd) { bd = d; best = id; }
            }
            if (best) {
              this.fireDim[best] = Math.min(0.6, (this.fireDim[best] ?? 0) + R.dimHit);
              const m = markerSpec(best)!;
              this.emit({ type: 'sling', x: r.x, y: r.y, tx: m.x, ty: R.wallY });
              this.emit({ type: 'dim', fire: best, x: m.x, y: R.wallY });
            }
          }
          break;
        }
        case 'stop':
          break;
        case 'foot': {
          const dx = r.tx - r.x;
          if (Math.abs(dx) > 0.06) {
            r.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * w);
            r.face = dx > 0 ? 1 : -1;
            r.y = approach(r.y, footY, w, 0.2);
          } else this.atWall(r);
          break;
        }
        case 'pry': {
          const s = p.wall[r.seg];
          if (isOpen(r.seg, s)) {
            this.enter(r);
            break;
          }
          const k = (decreeOn(p, 'upal') ? 1 - DECREE.upal.nums.pct / 100 : 1);
          s.hp = Math.max(0, s.hp - R.pry[r.kind] * k * w);
          this.pryTick += w;
          if (s.hp <= 0) this.breachAt(r.seg);
          break;
        }
        case 'climb': {
          r.t -= w;
          if (r.t <= 0) this.enter(r);
          break;
        }
        case 'inside': {
          const st = this.storeFor(r);
          const tx = st.x, ty = st.y + 0.5;
          const d = dist(r.x, r.y, tx, ty);
          if (d < 0.15) {
            r.state = 'grab';
            r.t = R.grab;
          } else {
            r.x += ((tx - r.x) / d) * Math.min(d, sp * 1.1 * w);
            r.y += ((ty - r.y) / d) * Math.min(d, sp * 1.1 * w);
            r.face = tx > r.x ? 1 : -1;
          }
          break;
        }
        case 'grab': {
          r.t -= w;
          if (r.t <= 0) {
            const what: 'stone' | 'bread' = r.store === 'yard' ? 'stone' : 'bread';
            const n = Math.min(R.loot, Math.floor(this.lootBudget[what]), Math.floor(what === 'stone' ? p.stone : p.bread));
            if (n > 0) {
              this.lootBudget[what] -= n;
              if (what === 'stone') p.stone -= n;
              else p.bread -= n;
              r.loot = what;
              r.lootN = n;
              this.emit({ type: 'grab', x: r.x, y: r.y, what, n });
            }
            r.state = 'out';
          }
          break;
        }
        case 'out': {
          const tx = r.tx, ty = R.wallIn + 0.2;
          const d = dist(r.x, r.y, tx, ty);
          if (d < 0.15) {
            r.state = 'flee';
            r.y = R.wallOut - 0.3;
          } else {
            r.x += ((tx - r.x) / d) * Math.min(d, sp * 1.2 * w);
            r.y += ((ty - r.y) / d) * Math.min(d, sp * 1.2 * w);
            r.face = tx > r.x ? 1 : -1;
          }
          break;
        }
        case 'flee': {
          r.y -= R.flee * w;
          r.face = r.x < 9 ? -1 : 1;
          r.x += (r.x < 9 ? -0.4 : 0.4) * w;
          if (r.y < -1.2) {
            if (r.loot) {
              p.breached = true;
              this.nightLost += r.lootN;
              this.lootLost += r.lootN;
              this.emit({ type: 'plunder', what: r.loot, n: r.lootN });
              this.talk.ask('plunder', 1, 5);
              p.strength = Math.max(R.strengthMin, p.strength - R.lootFear);
            }
            this.raiders.splice(i, 1);
          }
          break;
        }
      }
    }
  }

  /** At the wall's foot: the weakest segment near the road (Neh 4:13, the lowest points); rams go for the gate. */
  private toWall(r: Raider): void {
    const p = this.p, R = RULES, home = ROUTES[r.route].seg;
    let seg = home;
    if (r.kind !== 'taran') {
      let best = Infinity;
      for (const i of [home - 1, home, home + 1]) {
        if (i < 0 || i >= SEGS.length) continue;
        const s = p.wall[i];
        const mh = maxHp(i, s);
        const score = (isOpen(i, s) ? 0 : heightOf(i, s) + (mh > 0 ? s.hp / mh : 0)) + Math.abs(i - home) * 0.35 + this.rng() * 0.3;
        if (score < best) { best = score; seg = i; }
      }
    }
    r.seg = seg;
    const sp = SEGS[seg];
    r.tx = clamp(segMid(seg) + (this.rng() - 0.5) * (sp.x1 - sp.x0) * 0.6, sp.x0 + 0.25, sp.x1 - 0.25);
    r.state = 'foot';
    r.y = Math.min(r.y, R.wallOut - 0.25);
    this.nightReached++;
    this.reached++;
  }

  /** At the wall: through an opening, over a low wall or with a ladder, else prying stones. */
  private atWall(r: Raider): void {
    const p = this.p, R = RULES, s = p.wall[r.seg];
    if (isOpen(r.seg, s)) { this.enter(r); return; }
    const h = heightOf(r.seg, s);
    if (r.kind === 'taran' || r.kind === 'kapitan') { r.state = 'pry'; return; }
    if (h < R.lowBelow && r.seg !== GATE_SEG) {
      r.state = 'climb';
      r.t = R.climbLow;
      this.emit({ type: 'climb', x: r.x, y: r.y });
      return;
    }
    if (r.kind === 'drabina' && (h < R.parapetFrom || !this.guardNear(r.x, 1.6))) {
      r.state = 'climb';
      r.t = R.climbLadder;
      this.emit({ type: 'climb', x: r.x, y: r.y });
      return;
    }
    r.state = 'pry';
  }

  private enter(r: Raider): void {
    r.state = 'inside';
    r.y = RULES.wallIn + 0.3;
    r.store = this.storeFor(r).id;
  }

  /** The store a raider inside goes for: the stone yard or the bread (the granary, the bakery, else the governor's house). */
  private storeFor(r: Raider): { id: string; x: number; y: number } {
    const pickId = (ids: string[]) => ids.find(id => id === 'yard' || (this.p.city[id] ?? 0) > 0) ?? 'gov';
    const bread = pickId(['granary', 'bakery']);
    const yard = MARKERS.find(m => m.id === 'yard')!, bm = MARKERS.find(m => m.id === bread)!;
    if (r.store) {
      const m = MARKERS.find(x => x.id === r.store)!;
      return { id: m.id, x: m.x, y: m.y };
    }
    const m = dist(r.x, r.y, yard.x, yard.y) <= dist(r.x, r.y, bm.x, bm.y) ? yard : bm;
    return { id: m.id, x: m.x, y: m.y };
  }

  private breachAt(seg: number): void {
    if (this.breachSaid.has(seg)) return;
    this.breachSaid.add(seg);
    this.breaches++;
    this.emit({ type: 'breach', seg, x: segMid(seg) });
    this.rings.push({ x: segMid(seg), y: RULES.wallY, r: 1.2, t: 0, dur: 0.6, kind: 'breach' });
    this.talk.ask('breach', 2, 4);
    this.coach('breach', segMid(seg), RULES.wallY);
  }

  /** A blow to a raider's courage (×0.6 near a standing captain); at none, it loses heart and runs. */
  private blow(r: Raider, dmg: number): void {
    if (r.state === 'flee') return;
    const brave = this.raiders.some(c => c.kind === 'kapitan' && c !== r && c.state === 'stop' && dist(c.x, c.y, r.x, r.y) <= RULES.captainR);
    r.courage -= dmg * (brave ? RULES.captainGuard : 1);
    r.hit = 0.25;
    if (r.courage <= 0) this.rout(r, true);
  }

  /** It loses heart and runs (Neh 4:15): what it carried is dropped and gathered back. */
  private rout(r: Raider, counted: boolean): void {
    if (r.state === 'flee') return;
    const p = this.p;
    if (r.loot && r.lootN > 0) {
      if (r.loot === 'stone') p.stone = Math.min(stoneCap(p), p.stone + r.lootN);
      else p.bread = Math.min(breadCap(p), p.bread + r.lootN);
      this.lootRecovered += r.lootN;
      this.emit({ type: 'recovered', what: r.loot, n: r.lootN, x: r.x, y: r.y });
      r.loot = null;
      r.lootN = 0;
    }
    const inside = r.y > RULES.wallY;
    r.state = 'flee';
    r.courage = 0;
    if (inside) r.y = RULES.wallOut - 0.3;
    if (counted) {
      this.driven++;
      this.nightDriven++;
      this.emit({ type: 'driven', id: r.id, x: r.x, y: r.y, kind: r.kind });
      if (this.sighted && r.seen) this.addHorn(RULES.hornDriven);
      this.rings.push({ x: r.x, y: r.y, r: 0.6, t: 0, dur: 0.35, kind: 'rout' });
    }
    if (r.kind === 'kapitan') {
      for (const o of this.raiders) if (o !== r && o.state !== 'flee' && dist(o.x, o.y, r.x, r.y) <= 3) this.rout(o, counted);
      this.talk.ask('lost', 3, 6);
    }
  }

  // ── the watch ───────────────────────────────────────────────────
  /** Slots for guards: the towers' slingers and the posts' guards (and the decrees' and letters' extra). */
  private guardSlots(): number {
    let n = 0;
    for (const id of TOWER_IDS) n += RULES.towerSlingers[this.p.stretch[id] ?? 0];
    for (const id of POST_IDS) n += this.postGuards(id);
    return n;
  }

  private postGuards(id: string): number {
    const lv = this.p.stretch[id] ?? 0;
    if (!lv) return 0;
    return RULES.postGuards[lv] + perkLevel(this.p, 'straz') + (decreeOn(this.p, 'nocleg') ? DECREE.nocleg.nums.guards : 0);
  }

  private towerRange(id: string): number {
    const lv = this.p.stretch[id] ?? 0;
    return RULES.towerRange[lv] * (this.p.towerKind[id] === 'far' ? RULES.towerFar : 1);
  }

  /** Guards take their posts (people allowing: the towers' slingers first, then the posts), and Nehemiah's officers join. */
  private rebuildGuards(): void {
    const R = RULES, p = this.p;
    let left = jobs(p, this.guardSlots()).guards;
    for (const id of TOWER_IDS) {
      const want = R.towerSlingers[p.stretch[id] ?? 0];
      const k = Math.min(want, left);
      this.manned[id] = k;
      left -= k;
      if (!this.towerCool[id] || this.towerCool[id].length !== want) this.towerCool[id] = Array.from({ length: want }, (_, i) => 0.3 + i * 0.4);
    }
    const out: Guard[] = [];
    for (const id of POST_IDS) {
      const n = Math.min(this.postGuards(id), left);
      left -= n;
      const m = markerSpec(id)!;
      for (let k = 0; k < n; k++) {
        const hx = m.x + (k - (n - 1) / 2) * 0.4;
        const old = this.guards.find(g => g.post === id && Math.abs(g.hx - hx) < 0.01);
        out.push(old ?? { id: this.nextId++, post: id, hx, hy: R.wallIn + 0.15, x: hx, y: R.wallIn + 0.15, cool: 0.2 * k, face: 1, hero: null, jab: (p.stretch[id] ?? 0) >= 2 ? R.jabShield : R.jab });
      }
    }
    const level = p.gate + p.year * GATES.length;
    const heroes: [Hero, number, number][] = [['hanani', 2, 7.6], ['hananiah', 4, 9]];
    for (const [hero, from, hx] of heroes) {
      if (level < from) continue;
      const old = this.guards.find(g => g.hero === hero);
      out.push(old ?? { id: this.nextId++, post: 'gate', hx, hy: R.wallIn + 0.15, x: hx, y: R.wallIn + 0.15, cool: 0.5, face: 1, hero, jab: R.jab * 2 });
      if (!old) this.emit({ type: 'hero', hero });
    }
    this.guards = out;
  }

  private guardNear(x: number, r: number): boolean {
    return this.guards.some(g => Math.abs(g.x - x) <= r) || TOWER_IDS.some(id => (this.manned[id] ?? 0) > 0 && Math.abs(markerSpec(id)!.x - x) <= r);
  }

  private cheerAt(x: number, y: number): number {
    return dist(x, y, this.neh.x, this.neh.y) <= RULES.cheerR ? RULES.cheer : 1;
  }

  private towers(w: number): void {
    const R = RULES, p = this.p;
    for (const id of TOWER_IDS) {
      const lv = p.stretch[id] ?? 0;
      if (!lv) continue;
      const cool = this.towerCool[id] ?? [];
      const men = this.manned[id] ?? 0;
      const m = markerSpec(id)!;
      const every = R.towerEvery[lv] * (p.towerKind[id] === 'quick' ? R.towerQuick : 1) / this.cheerAt(m.x, R.wallY)
        / (decreeOn(p, 'polowa') ? 1 + 0.3 : 1);
      const range = this.towerRange(id);
      const dmg = R.stone * (p.towerKind[id] === 'far' ? R.farStone : 1);
      for (let k = 0; k < Math.min(men, cool.length); k++) {
        cool[k] -= w;
        if (cool[k] > 0) continue;
        let best: Raider | null = null, bs = Infinity;
        for (const r of this.raiders) {
          if (r.state === 'flee' || !r.seen) continue;
          const d = dist(r.x, r.y, m.x, R.wallY);
          if (d > range) continue;
          const score = d - (r.loot ? 2 : 0) - (r.state === 'pry' || r.state === 'climb' ? 1 : 0);
          if (score < bs) { bs = score; best = r; }
        }
        if (!best) { cool[k] = 0.15; continue; }
        cool[k] = every * (0.9 + 0.2 * this.rng());
        this.launch(m.x + (k - 0.5) * 0.25, R.wallY - 0.6, best, dmg, false);
      }
    }
  }

  private launch(x: number, y: number, r: Raider, dmg: number, volley: boolean): void {
    const d = dist(x, y, r.x, r.y);
    this.pebbles.push({ id: this.nextId++, x0: x, y0: y, target: r.id, tx: r.x, ty: r.y, t: 0, dur: RULES.flight * (0.6 + d / 6), dmg, volley });
  }

  private flyPebbles(w: number): void {
    for (let i = this.pebbles.length - 1; i >= 0; i--) {
      const pb = this.pebbles[i];
      pb.t += w;
      const r = this.raiders.find(x => x.id === pb.target);
      if (r) { pb.tx = r.x; pb.ty = r.y; }
      if (pb.t >= pb.dur) {
        this.pebbles.splice(i, 1);
        if (r && r.state !== 'flee') {
          this.emit({ type: 'bonk', id: r.id, x: r.x, y: r.y, volley: pb.volley });
          this.blow(r, pb.dmg);
        }
      }
    }
  }

  private guardsFrame(w: number): void {
    const R = RULES, p = this.p;
    const polowa = decreeOn(p, 'polowa') ? 1 + DECREE.polowa.nums.guard / 100 : 1;
    const hot = this.guards.some(g => g.hero === 'hanani') ? this.hottestSeg() : -1;
    for (const g of this.guards) {
      g.cool -= w;
      // home: their post, Nehemiah when the horn rallied them, Hanani where the wall is pressed hardest
      let hx = g.hx;
      if (this.rally > 0) hx = clamp(this.neh.x + (g.hx - this.neh.x) * 0.15, 0.4, 17.6);
      else if (g.hero === 'hanani' && hot >= 0) hx = segMid(hot);
      let target: Raider | null = null, bd = Infinity;
      for (const r of this.raiders) {
        if (r.state === 'flee' || !r.seen) continue;
        const inside = r.y > R.wallY;
        const reach = inside ? R.chase : R.guardReach;
        const d = dist(r.x, r.y, hx, g.hy);
        if (d <= reach && d < bd) { bd = d; target = r; }
      }
      // where to stand: behind the wall facing the raider, or after it inside the city
      let gx = hx, gy = g.hy;
      if (target) {
        if (target.y > R.wallY) { gx = target.x; gy = target.y; } else gx = clamp(target.x, hx - 0.7, hx + 0.7);
      }
      const dx = gx - g.x, dy = gy - g.y, d = Math.hypot(dx, dy);
      const sp = (g.hero === 'hanani' ? 3.2 : 2.2) * (this.rally > 0 ? 1.4 : 1);
      if (d > 0.05) {
        g.x += (dx / d) * Math.min(d, sp * w);
        g.y += (dy / d) * Math.min(d, sp * w);
        if (Math.abs(dx) > 0.02) g.face = dx > 0 ? 1 : -1;
      }
      if (target && g.cool <= 0 && dist(g.x, g.y, target.x, target.y) <= (target.y > R.wallY ? 0.7 : R.guardReach * 0.75)) {
        const every = R.jabEvery / this.cheerAt(g.x, g.y) / (this.rally > 0 ? R.rallyK : 1);
        g.cool = every * (0.85 + 0.3 * this.rng());
        this.jabs.push({ x: g.x, y: g.y, tx: target.x, ty: target.y, t: 0 });
        this.emit({ type: 'jab', x: target.x, y: target.y });
        this.blow(target, g.jab * polowa);
      }
    }
  }

  /** Nehemiah's presence: raiders near him lose heart (if they can be seen), Hananiah's at the gate too. */
  private nearHeart(w: number): void {
    const R = RULES, n = this.neh;
    const hananiah = this.guards.find(g => g.hero === 'hananiah');
    for (const r of this.raiders) {
      if (r.state === 'flee' || !r.seen) continue;
      if (dist(r.x, r.y, n.x, n.y) <= R.nearR) this.blow(r, R.nearHeart * w);
      else if (hananiah && dist(r.x, r.y, hananiah.x, hananiah.y) <= 1.8) this.blow(r, 0.5 * w);
    }
  }

  /** Where it is hottest: the segment with the most raiders at it or through it (its x), else the busiest road's. */
  hottest(): number {
    const s = this.hottestSeg();
    return s >= 0 ? segMid(s) : this.neh.x;
  }

  /** Where Nehemiah is most needed: among raiders inside the city, else on the wall walk above the hottest stretch. */
  hotSpot(): { x: number; y: number } {
    const inside = this.raiders.filter(r => r.state !== 'flee' && r.y > RULES.wallIn);
    if (inside.length) {
      // the one nearest to Nehemiah, so he chases rather than dithers
      const n = this.neh;
      const r = inside.reduce((a, b) => (dist(a.x, a.y, n.x, n.y) <= dist(b.x, b.y, n.x, n.y) ? a : b));
      return { x: r.x, y: Math.max(RULES.walkTop, r.y) };
    }
    const x = this.hottest();
    const r = this.raiders.find(q => q.state !== 'flee' && (q.state === 'pry' || q.state === 'climb' || q.state === 'foot') && Math.abs(q.x - x) < 1.6);
    return { x: r ? r.x : x, y: 4.75 };
  }

  private hottestSeg(): number {
    const acc = new Array(SEGS.length).fill(0);
    for (const r of this.raiders) {
      if (r.state === 'flee') continue;
      if (r.state === 'walk' || r.state === 'sling' || r.state === 'stop') acc[ROUTES[r.route].seg] += 0.5 + Math.min(1, r.d / Math.max(1, routeLen(r.route)));
      else if (r.y > RULES.wallY) acc[segAt(r.x)] += 4;
      else acc[r.seg] += 3;
    }
    let best = -1, bv = 0;
    acc.forEach((v, i) => { if (v > bv) { bv = v; best = i; } });
    return best;
  }

  private moveMessenger(w: number): void {
    const m = this.messenger;
    if (!m) return;
    m.t += w;
    if (m.state === 'come') {
      m.y += 1.1 * w;
      if (m.y >= 3.3) { m.y = 3.3; m.state = 'wait'; m.t = 0; }
    } else if (m.state === 'wait') {
      if (m.t >= 9) m.state = 'go';
    } else {
      m.y -= 1.4 * w;
      if (m.y < -1) {
        if (!m.answered) this.emit({ type: 'ono', answered: false });
        this.messenger = null;
      }
    }
  }

  private answerOno(): void {
    const m = this.messenger;
    if (!m || m.answered) return;
    m.answered = true;
    m.state = 'go';
    this.onoNow++;
    this.addHorn(RULES.onoBonus);
    this.emit({ type: 'ono', answered: true });
    this.talk.ask('ono', 3, 6);
    if (!this.p.cards.includes('ono')) {
      this.p.cards.push('ono');
      this.onoStory = true;
    }
  }
  private onoStory = false;

  // ── Nehemiah and the build ──────────────────────────────────────
  private moveNeh(w: number): void {
    const n = this.neh, R = RULES;
    const ks = this.keyStick();
    const sx = this.stick.x + ks.x, sy = this.stick.y + ks.y;
    const sl = Math.hypot(sx, sy);
    let vx = 0, vy = 0;
    if (sl > 0.05) {
      const k = Math.min(1, sl);
      vx = (sx / sl) * R.walk * k;
      vy = (sy / sl) * R.walk * k;
    } else if (n.goal) {
      const dx = n.goal.x - n.x, dy = n.goal.y - n.y, d = Math.hypot(dx, dy);
      if (d < 0.05) {
        n.goal = null;
        if (n.order) {
          const id = n.order;
          n.order = null;
          this.tryBuild(id);
        }
      } else {
        const sp = Math.min(R.autoWalk, d / w);
        vx = (dx / d) * sp;
        vy = (dy / d) * sp;
      }
    }
    n.x = clamp(n.x + vx * w, 0.3, R.worldW - 0.3);
    n.y = clamp(n.y + vy * w, R.walkTop, R.worldH - 0.4);
    const moving = Math.hypot(vx, vy) > 0.1;
    n.walking = moving ? 1 : 0;
    if (Math.abs(vx) > 0.05) n.face = vx > 0 ? 1 : -1;
    if (moving) { n.still = 0; n.tried = false; } else n.still += w;
    // standing still on a marker builds it (by day), once per stop
    if (!n.build && !n.goal && !n.tried && n.still >= 0.35 && this.dayTime) {
      n.tried = true;
      const m = this.markerNear(n.x, n.y, R.standR);
      if (m && this.nextLevel(m.id) !== null) this.tryBuild(m.id, true);
    }
    if (n.build) {
      const m = markerSpec(n.build.id)!;
      if (dist(n.x, n.y, m.x, m.y) > R.standR * 1.8) this.cancelBuild();
      else {
        n.build.t += w;
        if (n.build.t >= R.buildSec) this.finishBuild();
      }
    }
  }

  private moveTirza(w: number): void {
    const z = this.tirza, n = this.neh;
    const tx = n.x - n.face * 0.75, ty = Math.max(RULES.walkTop + 0.1, n.y + 0.28);
    const dx = tx - z.x, dy = ty - z.y, d = Math.hypot(dx, dy);
    if (d > 0.08) {
      const sp = Math.min(d * 3.2, 4.2);
      z.x += (dx / d) * sp * w;
      z.y += (dy / d) * sp * w;
      z.walking = 1;
      if (Math.abs(dx) > 0.05) z.face = dx > 0 ? 1 : -1;
    } else {
      z.walking = 0;
      z.face = n.x > z.x ? 1 : -1;
    }
  }

  /** The marker within `r` (u) of a point (the nearest), by day only. */
  markerNear(x: number, y: number, r: number): MarkerSpec | null {
    if (!this.dayTime) return null;
    let best: MarkerSpec | null = null, bd = r;
    for (const m of MARKERS) {
      const d = dist(x, y, m.x, m.y);
      if (d <= bd) { bd = d; best = m; }
    }
    return best;
  }

  levelOf(id: string): number {
    const m = markerSpec(id)!;
    if (m.kind === 'wall' || m.kind === 'gate') return this.p.wall[m.seg!].tier;
    return (m.id in this.p.stretch ? this.p.stretch[m.id] : this.p.city[m.id]) ?? 0;
  }

  /** The level a build here gives next, or null (at the top, capped, a tier still being laid). */
  nextLevel(id: string): number | null {
    const m = markerSpec(id);
    if (!m) return null;
    if (m.kind === 'wall' || m.kind === 'gate') {
      const s = this.p.wall[m.seg!];
      if (s.tier > s.done) return null;
      const nl = s.tier + 1;
      return nl <= MAX_LEVEL && nl <= levelCap(this.p, m.kind) ? nl : null;
    }
    const nl = this.levelOf(id) + 1;
    return nl <= MAX_LEVEL && nl <= levelCap(this.p, m.kind) ? nl : null;
  }

  /** What the view shows at each marker. */
  markerView(id: string): MarkerView {
    const m = markerSpec(id)!;
    const level = this.levelOf(id);
    const next = this.nextLevel(id);
    const cost = next !== null ? costOf(m.kind, next) : null;
    let working: number | null = null;
    if (m.kind === 'wall' || m.kind === 'gate') {
      const s = this.p.wall[m.seg!];
      if (s.tier > s.done) working = s.prog / tierCubits(m.seg!, s.done + 1);
    }
    const capped = next === null && working === null && level < MAX_LEVEL;
    return { id, kind: m.kind, x: m.x, y: m.y, level, next, cost, can: !!cost && canPay(this.p, cost), capped, working };
  }

  /** Walk to a marker and build it on arrival. */
  orderBuild(id: string): void {
    const m = markerSpec(id);
    if (!m) return;
    const n = this.neh;
    if (dist(n.x, n.y, m.x, m.y) <= RULES.standR) {
      n.order = null;
      n.goal = null;
      this.tryBuild(id);
      return;
    }
    n.order = id;
    n.goal = { x: m.x, y: Math.max(RULES.walkTop, m.y) };
    this.coach('build', m.x, m.y);
  }

  /** Start a build here: pay (the stones fly in), or say what is missing. */
  private tryBuild(id: string, quiet = false): boolean {
    const n = this.neh;
    if (!this.dayTime || n.build) return false;
    n.tried = true;
    const m = markerSpec(id)!;
    const nl = this.nextLevel(id);
    if (nl === null) return false;
    const cost = costOf(m.kind, nl)!;
    if (!canPay(this.p, cost)) {
      if (!quiet) this.emit({ type: 'missing', id, x: m.x, y: m.y, stone: Math.max(0, Math.ceil(cost.stone - this.p.stone)), timber: Math.max(0, Math.ceil(cost.timber - this.p.timber)) });
      return false;
    }
    this.p.stone -= cost.stone;
    this.p.timber -= cost.timber;
    n.build = { id, t: 0, level: nl, cost };
    this.emit({ type: 'pay', id, x: m.x, y: m.y, stone: cost.stone, timber: cost.timber });
    return true;
  }

  private cancelBuild(): void {
    const b = this.neh.build;
    if (!b) return;
    this.p.stone += b.cost.stone;
    this.p.timber += b.cost.timber;
    this.neh.build = null;
    this.emit({ type: 'cancel', id: b.id });
  }

  private finishBuild(): void {
    const b = this.neh.build;
    if (!b) return;
    this.neh.build = null;
    const p = this.p, m = markerSpec(b.id)!;
    if (m.kind === 'wall' || m.kind === 'gate') {
      const s = p.wall[m.seg!];
      s.tier = b.level;
      this.lay(m.seg!, RULES.foundation);
      // the dressed stones go up at once
      if (p.dressed > 0.5) {
        const v = this.lay(m.seg!, p.dressed);
        p.dressed -= v;
        if (v >= 1) this.emit({ type: 'dressed', seg: m.seg!, n: Math.round(v), x: m.x });
      }
      this.coach('front', m.x, RULES.wallY);
    } else if (m.id in p.stretch) {
      p.stretch[m.id] = b.level;
      if (m.kind === 'tower' && b.level === 2 && !p.towerKind[m.id]) {
        this.queueChoice({ kind: 'tower', options: ['far', 'quick'], t: 0, marker: m.id });
        this.coach('choice', m.x, m.y);
      }
      if (m.kind === 'fire') this.fireR[m.id] = fireReach(b.level, 0);
      if (this.nightTime) this.rebuildGuards();
    } else p.city[m.id] = b.level;
    this.rings.push({ x: m.x, y: m.y, r: 1.1, t: 0, dur: 0.5, kind: 'build' });
    this.emit({ type: 'built', id: m.id, kind: m.kind, level: b.level, x: m.x, y: m.y });
    if (m.kind !== 'wall') this.talk.ask('build', 1, 4);
  }

  // ── the day's work ──────────────────────────────────────────────
  /** Lay `v` cubits on segment `i` (its tier being built): the headline grows, the new stones are whole. */
  private lay(i: number, v: number): number {
    const s = this.p.wall[i];
    if (s.tier <= s.done || !(v > 0)) return 0;
    const all = tierCubits(i, s.done + 1);
    const k = Math.min(v, all - s.prog);
    s.prog += k;
    s.hp += (k / all) * (SEGS[i].gate ? RULES.gateHpTier : RULES.hpTier);
    this.cubits += k;
    if (s.prog >= all - 1e-6) {
      s.done += 1;
      s.prog = 0;
      s.hp = Math.min(s.hp, maxHp(i, s));
      this.breachSaid.delete(i);
      this.rings.push({ x: segMid(i), y: RULES.wallY, r: 1.6, t: 0, dur: 0.7, kind: 'tier' });
      this.emit({ type: 'tier', seg: i, level: s.done, x: segMid(i) });
      this.talk.ask('tier', 2, 5);
      if (s.done >= 2 && !SEGS[i].gate) {
        const key = `fox:${this.p.year * 10 + this.p.gate}`;
        if (!this.p.cards.includes(key)) {
          this.p.cards.push(key);
          this.foxDue = true;
        }
      }
    }
    return k;
  }

  private work(w: number): void {
    const p = this.p, R = RULES, j = this.jobsNow;
    this.front = -1;
    this.mendSeg = -1;
    if (this.sabbathToday) return;
    const sF = R.sBase + (1 - R.sBase) * p.strength;
    const rh = this.rhythm;
    const gruz = decreeOn(p, 'gruz');
    let power = j.builders * R.lay * rh * sF * (1 + R.mortar * (p.city.well ?? 0)) * (1 + 0.1 * perkLevel(p, 'kielnie'))
      * (decreeOn(p, 'polowa') ? 1 - DECREE.polowa.nums.work / 100 : 1) * (gruz ? 1 - DECREE.gruz.nums.work / 100 : 1) * w;
    // mending first: the most broken segment
    for (let guard = 0; guard < 8 && power > 1e-9; guard++) {
      let worst = -1, wr = 1;
      p.wall.forEach((s, i) => {
        const mh = maxHp(i, s);
        if (mh <= 0) return;
        const r = s.hp / mh;
        if (r < wr - 1e-6) { wr = r; worst = i; }
      });
      if (worst < 0) break;
      const s = p.wall[worst];
      const need = (maxHp(worst, s) - s.hp) / R.mendK;
      const use = Math.min(power, need);
      const was = s.hp;
      s.hp = Math.min(maxHp(worst, s), s.hp + use * R.mendK);
      this.mended += s.hp - was;
      power -= use;
      this.mendSeg = worst;
      if (was <= 0 && s.hp > 0) {
        this.breachSaid.delete(worst);
        this.emit({ type: 'mend', seg: worst, x: segMid(worst) });
      }
    }
    // laying: the lowest unfinished tier first
    for (let guard = 0; guard < 4 && power > 1e-9; guard++) {
      let low = -1, lh = Infinity;
      p.wall.forEach((s, i) => {
        if (s.tier <= s.done) return;
        const h = heightOf(i, s);
        if (h < lh - 1e-9) { lh = h; low = i; }
      });
      if (low < 0) break;
      this.front = low;
      power -= this.lay(low, power);
    }
    // builders with nothing to lay dress stones for the next tier (and carry a little rubble)
    if (this.front < 0 && this.mendSeg < 0 && power > 0) {
      p.dressed = Math.min(R.dressedCap, p.dressed + power);
      p.stone = Math.min(stoneCap(p), p.stone + j.builders * R.rubble * 0.5 * rh * w);
    }
    p.stone = Math.min(stoneCap(p), p.stone + j.quarry * R.quarry * rh * sF * (gruz ? 1 + DECREE.gruz.nums.stone / 100 : 1) * w);
    p.bread = Math.min(breadCap(p), p.bread + j.bakers * R.bake * rh * sF * (1 + 0.25 * perkLevel(p, 'piece')) * w);
    p.strength = Math.min(1, p.strength + j.water * R.water * rh * w);
  }

  /** x of the work front (the coach mark points there). */
  frontX(): number {
    let low = -1, lh = Infinity;
    this.p.wall.forEach((s, i) => {
      if (s.tier <= s.done) return;
      const h = heightOf(i, s);
      if (h < lh) { lh = h; low = i; }
    });
    return low >= 0 ? segMid(low) : 9;
  }

  /**
   * The guide ("Następne"): the most useful build the stores can pay now — keep the builders busy on
   * the lowest stretch, bread before hunger, the gate's doors, a tower and a fire by each road, a post
   * behind the gate, room for newcomers, then the cheapest useful upgrade.
   */
  guide(): string | null {
    const p = this.p;
    let best: string | null = null, bv = -Infinity;
    const fronts = p.wall.filter(s => s.tier > s.done).length;
    const lit = FIRE_IDS.filter(id => (p.stretch[id] ?? 0) > 0).length;
    // tonight's busiest road: its tower, fire and post come first (the preview is the plan)
    const busy = [...this.preview].sort((a, b) => b.total - a.total)[0]?.route ?? 'centre';
    const near = (x: number) => Math.abs(x - segMid(ROUTES[busy].seg)) <= 1.4;
    for (const m of MARKERS) {
      const nl = this.nextLevel(m.id);
      if (nl === null) continue;
      const cost = costOf(m.kind, nl)!;
      if (!canPay(p, cost)) continue;
      let v = 0;
      switch (m.kind) {
        case 'wall': {
          const s = p.wall[m.seg!];
          v = (fronts === 0 ? 100 : fronts === 1 ? 62 : 18) - heightOf(m.seg!, s) * 14 - Math.abs(m.x - 9) * 0.6;
          break;
        }
        case 'gate': v = p.wall[GATE_SEG].done === 0 ? (p.gateDay >= 2 ? 88 : 66) : 30 - p.wall[GATE_SEG].done * 6; break;
        case 'bakery': v = nl === 1 ? (p.bread < p.people * 2.2 ? 92 : 48) : (p.people > 6 * nl ? 40 : 12); break;
        case 'fire': v = (nl === 1 ? (lit < 3 ? 56 : 26) : 10) + (near(m.x) ? 20 : 0); break;
        case 'tower': v = (nl === 1 ? 50 : 12) + (near(m.x) ? 22 : 0); break;
        case 'post': v = (nl === 1 ? 42 : 10) + (near(m.x) ? 14 : 0); break;
        case 'house': v = room(p) - p.people <= 2 ? 64 - (nl - 1) * 10 : 14; break;
        case 'well': v = nl === 1 ? 42 : 20; break;
        case 'granary': v = p.bread >= breadCap(p) - 4 || breadCap(p) < p.people + 4 ? 58 : 16; break;
        case 'yard': v = p.stone >= stoneCap(p) - 4 ? 46 : 18; break;
        case 'governor': {
          // the walls stand as high as the house allows: raise the house so they can go higher
          const capped = p.wall.every((s, i) => i === GATE_SEG || s.tier >= levelCap(p, 'wall'));
          v = capped ? 96 : 26;
          break;
        }
      }
      v -= (cost.stone + cost.timber * 1.5) * 0.4;
      if (v > bv) { bv = v; best = m.id; }
    }
    return best;
  }

  // ── the hill: the villains and the fox ──────────────────────────
  private hill(w: number): void {
    const R = RULES, b = this.block;
    const day = this.phase === 'play' && b.kind !== 'push';
    const out = this.phase === 'play' && (b.kind === 'push' || (day && this.blockT >= R.sneerAt * b.dur));
    this.villains = approach(this.villains, out ? 1 : 0, w, 0.5);
    if (day && b.kind !== 'warmup' && !this.sneerSaid && this.blockT >= R.sneerAt * b.dur + 1) {
      this.sneerSaid = true;
      this.talk.ask('sneer', 2, 6);
      if (this.rng() < 0.6) this.talk.ask('mock', 1, 9);
    }
    if (this.fox) {
      this.fox.t += w;
      if (this.fox.t > 0) {
        if (!this.foxMocked) {
          this.foxMocked = true;
          this.talk.ask('mock', 3, 4);
        }
        const before = this.fox.x;
        this.fox.x += 2.8 * w;
        if (before < 9 && this.fox.x >= 9) {
          this.p.foxes++;
          this.emit({ type: 'fox' });
          this.talk.ask('fox', 3, 5);
        }
        if (this.fox.x > R.worldW + 0.8) this.fox = null;
      }
    }
    if (this.onoStory && this.dayTime) {
      this.onoStory = false;
      this.queueStory('ono', RULES.storySec + 1);
    }
  }

  private fx(dt: number): void {
    for (let i = this.jabs.length - 1; i >= 0; i--) if ((this.jabs[i].t += dt) > 0.22) this.jabs.splice(i, 1);
    for (let i = this.rings.length - 1; i >= 0; i--) if ((this.rings[i].t += dt) > this.rings[i].dur) this.rings.splice(i, 1);
  }

  // ── coach marks ─────────────────────────────────────────────────
  /** A first-time explanation (once ever): the index turns it into the runner's coach mark. */
  private coach(what: Coach, x: number, y: number): void {
    if (this.p.seen.includes(what)) return;
    this.p.seen.push(what);
    this.emit({ type: 'coach', what, x, y });
  }

  // ── the end ─────────────────────────────────────────────────────
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.emit({ type: 'finale' });
  }

  private endFinale(): void {
    if (this.phase === 'done') return;
    this.choice = null;
    this.choices.length = 0;
    this.phase = 'done';
    this.talk.clear();
    this.talk.ask('end', 5, 8);
    this.emit({ type: 'done' });
    this.settle();
  }

  /** The session is settled once — at its end, or when it ends early: the counters reach the progress. */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p;
    if (this.neh.build) this.finishBuild();
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushesBase + this.pushesBegun);
    p.total += this.headlineValue;
    p.driven += this.driven;
    p.horns += this.horns;
    p.ono += this.onoNow;
    p.lastLen = this.plannedSec;
    p.bestDay = Math.max(p.bestDay, p.year * 52 + p.day);
  }

  /** The session ends before its own end: settle as the end would. */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') this.endBlock();
    this.choice = null;
    this.choices.length = 0;
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

  /** The panel's gauge: the fires' reach in a sighted night, the rhythm (calm) in a day; null blind, without signal, in the lead-in or outside the blocks. */
  meter(): number | null {
    if (!this.started || !this.reliable) return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.light);
    if (this.restBlock) return this.blockT < this.restLead ? null : clamp(this.calmShown);
    return null;
  }

  /** The pad follows the fires in a sighted night, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(this.light);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    const score = this.headlineValue;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const from = this.firstDay || p.day, to = Math.max(from, p.day);
    const stats: [string, string][] = [
      [t('stat.days'), t('stat.daysV', { from, to })],
      [t('stat.gate'), gateName(p.gate)],
      [t('stat.wall'), t('pct', { n: Math.round(standing(p) * 100) })],
      [t('stat.driven'), fmtNum(this.driven)],
      [t('stat.horns'), String(this.horns)],
      [t('stat.people'), t('people', { n: p.people })],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score, unit: unit(score), record: this.bestBefore !== null && score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: the wall
   * finished (Neh 6:15) and dedicated (Neh 8:10), a gate built (Neh 2:20), Ono turned down or a long
   * held focus (Neh 6:3), breaches mended (Isa 58:12), a calm working day (Neh 3:12, Tirza's family);
   * else Neh 2:20.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.wallDone) fit.push('neh6.15', 'neh8.10');
    if (this.gatesDone.length) fit.push('neh2.20');
    if (this.onoNow > 0 || this.maxHold >= RULES.longHold) fit.push('neh6.3');
    if (this.mended >= RULES.hpTier) fit.push('isa58.12');
    if (this.passedRests > 0) fit.push('neh3.12');
    fit.push('neh2.20');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    const p = this.p;
    for (const g of this.gatesDone) add(0, t('hl.gateDone', { gate: gateName(g.gate), stars: '★'.repeat(g.stars) + '☆'.repeat(3 - g.stars) }));
    const score = this.headlineValue;
    if (this.bestBefore !== null && score > this.bestBefore) add(1, t('hl.record', { cubits: cubitsText(score) }));
    else if (this.bestBefore !== null && score > 0 && this.bestBefore - score <= Math.max(20, this.bestBefore * 0.4)) add(1, t('hl.toBest', { cubits: cubitsText(this.bestBefore - score) }));
    if (this.onoNow > 0) add(2, t('hl.ono'));
    if (this.horns > 0) add(3, t('hl.horns', { n: this.horns }));
    if (this.nightsAll > 0 && this.nightsHeld === this.nightsAll) add(4, t('hl.held'));
    if (this.driven >= RULES.manyDriven) add(5, t('hl.driven', { n: this.driven }));
    if (this.blindShare >= 0) add(6, t('hl.blind', { n: this.blindShare }));
    for (const town of this.newTowns) add(7, t('hl.town', { town: townName(town) }));
    if (this.settled && p.starBank > this.bankBefore) add(8, t('hl.letters', { stars: t('stars', { n: p.starBank }) }));
    const top = notes.sort((a, b) => a.rank - b.rank).slice(0, 4).map(n => n.text);
    top.push(this.wallDone ? t('hl.closeDone') : t('hl.close', { day: Math.max(1, p.day), gate: gateName(p.gate) }));
    return top;
  }

  /** For the view: the gate's day now ("dzień 3 z 5"). */
  get gateProgress(): { day: number; days: number } { return { day: Math.max(1, this.p.gateDay), days: gateDays(this.p.gate) }; }
}

