/**
 * Dolina's run, without the DOM or the canvas (so every rule is unit-tested): the pilgrim climbing
 * out of the valley of the shadow (Psalm 23:4) floor by floor, after Hell Escape's loop — run, smash,
 * build, climb, escape the tide — with the band at its core.  All numbers are in rules.ts.
 *
 * The hands.  He runs by himself.  A tap (Space, ↑, W) jumps; a second tap in the air is the double
 * jump (Ćma grabs his hood and flaps); holding the press jumps higher, letting go early cuts the jump
 * short; coyote time and a jump buffer forgive a late or early tap; ↓ (S, a swipe down) in the air
 * stomps.  His staff strikes by itself whatever stands in front of him: stone blocks with numbers on
 * them (each break throws its stones into his pack), shadows, a pen with a lost lamb in it, a
 * guardian's weak point.  Landing on a shadow stomps it and gives the double jump back.
 *
 * The level.  Three floors, each a stretch of road (blocks, pits narrow and wide, shadows, gates that
 * merge the weapon up — the high one only with both jumps — and pens) that ends at a ledge: the stones
 * in the pack fly out and become a stair; what the stair lacks is jumped (one jump or two) or, after a
 * moment, climbed by hand.  The third floor ends at the way out; every third level the third floor is
 * a guardian's arena instead (telegraphed throws to jump, double-jump or stay under, then an opening).
 * Behind him the tide of the dark follows; if it catches him he stumbles (some oil, some stones) and
 * runs on — nothing ever ends the run.
 *
 * The band.
 *   push (light)   after a lead-in the lamp's reach is lampMin + level × lampExtra: inside its light
 *                  the fog lifts (numbers and pits show further ahead), shadows slow and — above the
 *                  threshold — burn, the guardian's throws slow and it burns, and the tide cannot come
 *                  in: above the threshold the light pushes it back.  A held focus (5 s Mendi / 3 s
 *                  HALO) lights the Świt: every shadow dissolves, every block in sight bursts into
 *                  stones, the tide is thrown far back, a guardian takes a blow and opens.
 *   rest (meadow)  the road gives way to a meadow by still water; no shadows, no tide; calm gathers
 *                  smooth stones from the brook (the next stair) and refills the oil.
 *   blind (fog)    every 4th push from the 3rd session: the lamp stays a small flame and the trace is
 *                  veiled; at the block's end its last 15 s become one flash of that strength.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the lamp rests at its base; never a loss.  The headline is the metres run, live.
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome } from '../kit/types';
import { Companion, type Moment } from './companion';
import {
  ANSWER, ERAS, ERA_SHADOWS, GUARDS, SEQ, SHADOWS, TIPS, eraName, eraOfLevel, guardLevel, guardName, lapOfLevel, lookName, powerOf,
  type Answer, type EraId, type GuardId, type HarmKind, type MoveKind, type ShadowKind,
} from './content';
import { sparks as sparksText, t, type Key } from './i18n';
import { bestFor, lenKey, lookOf, setStars, starsOf, upLevel, type DolinaProgress } from './meta';
import { RULES, span } from './rules';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';
/** How the lamp looks: the steady small flame, live, waiting out the band's delay, grey without signal, the blind fog. */
export type LampLook = 'flame' | 'live' | 'wait' | 'grey' | 'blind';
/** How a shadow left the road. */
export type Via = 'strike' | 'stomp' | 'light' | 'dawn' | 'flash' | 'fade';

/** A stretch of ground: its top (u). The kind is only for the painter. */
export interface Seg { x0: number; x1: number; y: number; kind: 'road' | 'ledge' | 'meadow' | 'arena' | 'dawn' }
/** A stone block (or a pen with a lamb in it): its left edge, base and size, its light (hit points) and what it gives. */
export interface Stone {
  id: number; x: number; y: number; w: number; h: number; hp: number; max: number;
  stones: number; tall: boolean; pen: boolean; alive: boolean; level: number;
  /** a hit's flash (s left), inside the light now */
  hitT: number; lit: boolean;
}
/** A step of a built stair. */
export interface Step { x0: number; x1: number; y0: number; top: number; age: number; wall: number }
/** A ledge: the wall at its front, the floor below and above, the stair built at its foot. */
export interface Wall {
  id: number; x: number; y0: number; top: number; level: number; stage: number;
  /** steps wanted to walk up, steps built (and planned), the jump left at the top */
  need: number; built: number; plan: number; buildT: number; started: boolean; passed: boolean;
}
/** A gate of light hung over the road: passing through merges the weapon up. */
export interface Gate { id: number; x: number; y: number; high: boolean; plus: number; taken: boolean }
export interface Shadow {
  id: number; kind: ShadowKind; x: number; y: number; r: number; h: number; hp: number; max: number;
  state: 'walk' | 'gone'; age: number; hitT: number; stun: number; inLight: boolean; burn: number; throwT: number; bob: number;
}
/** Something thrown along the road: a brick that rolls, a guardian's wall or high beam. */
export type ShotKind = 'roll' | 'wall' | 'high';
export interface Shot { id: number; kind: ShotKind; x: number; y0: number; y1: number; w: number; vx: number; alive: boolean; passed: boolean; guard: boolean; t: number }
export interface Lamb { id: number; x: number; y: number; vy: number; hop: number }
export interface Post { x: number; y: number; lit: 'gold' | 'warm' | 'none' }

export interface Guard {
  id: GuardId; era: EraId; hp: number; max: number;
  state: 'enter' | 'fight' | 'leave' | 'beaten';
  /** seconds in its state; its front's distance ahead of him (u) */
  st: number; rel: number;
  seq: readonly MoveKind[]; i: number; moveT: number; acted: boolean; acted2: boolean; begun: boolean;
  /** the weak point opened by a Świt (s left), a hit's flash */
  dawnOpen: number; hitT: number; angry: boolean;
}
export interface Arena { x: number; y: number; level: number; guard: Guard | null; done: boolean }

/** What the coach mark teaches (the first session) or explains the first time (later sessions). */
export type Teach =
  | 'jump' | 'double' | 'strike' | 'tall' | 'gate' | 'stomp' | 'lamb' | 'stairsJump' | 'stairsDouble' | 'stairsClimb'
  | 'tide' | 'meadow' | 'guard' | 'open' | 'fog' | 'dawn';

export type SimEvent =
  | { type: 'jump'; air: boolean; x: number; y: number }
  | { type: 'land'; x: number; y: number; v: number }
  | { type: 'stomp'; x: number; y: number; what: 'shadow' | 'stone' | 'guard' }
  | { type: 'strike'; x: number; y: number; what: 'stone' | 'shadow' | 'guard'; dmg: number }
  | { type: 'break'; id: number; x: number; y: number; stones: number; tall: boolean; pen: boolean; combo: number; via: 'strike' | 'stomp' | 'dawn' }
  | { type: 'kill'; id: number; kind: ShadowKind; x: number; y: number; via: Via; sparks: number; combo: number }
  | { type: 'gate'; id: number; plus: number; tier: number; high: boolean; x: number; y: number }
  | { type: 'lamb'; n: number; x: number; y: number }
  | { type: 'stairs'; wall: number; n: number; need: number; answer: 'walk' | 'jump' | 'double' | 'climb' }
  | { type: 'step'; wall: number; i: number; x: number; y: number }
  | { type: 'climb'; x: number; y: number }
  | { type: 'pit'; x: number; y: number }
  | { type: 'lift'; x: number; y: number }
  | { type: 'harm'; kind: HarmKind; oil: number; x: number; y: number }
  | { type: 'caught'; spilled: number; x: number; y: number }
  | { type: 'pull'; x: number }
  | { type: 'dodge'; near: boolean; x: number; y: number }
  | { type: 'throw'; id: number; x: number; y: number }
  | { type: 'shotBreak'; id: number; x: number; y: number; via: 'wall' | 'pit' | 'dawn' | 'past' }
  | { type: 'combo'; n: number; mult: number }
  | { type: 'dawn'; n: number; stones: number; guard: boolean }
  | { type: 'flash'; share: number; r: number; n: number }
  | { type: 'fall' }
  | { type: 'rise'; x: number; y: number }
  | { type: 'brook'; n: number }
  | { type: 'restPass'; sparks: number; stones: number }
  | { type: 'pushPass'; sparks: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  /** the judged window's share on the asked side and the share it needed; the block's span of play time */
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; t0: number; t1: number; brook: number }
  | { type: 'guard'; what: 'come' | 'fight' | 'angry' | 'leave' | 'beaten' | 'open'; id: GuardId; era: EraId }
  | { type: 'guardHit'; id: GuardId; left: number; via: 'strike' | 'stomp' | 'light' | 'dawn' }
  | { type: 'move'; kind: MoveKind; act: boolean; id: GuardId }
  | { type: 'stage'; level: number; stage: number }
  | { type: 'level'; level: number; stars: number; lambs: number; pens: number; caught: boolean; sparks: number }
  | { type: 'era'; era: EraId; lap: number; level: number }
  | { type: 'post'; x: number; y: number; lit: 'gold' | 'warm' }
  | { type: 'teach'; what: Teach; x: number; y: number }
  | { type: 'finale' }
  | { type: 'done' }
  | { type: 'dayGift'; n: number }
  | { type: 'look'; look: number };

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

/** The run toward the dawn at the session's end: longer in sessions of 2 min and more. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/**
 * The run's blocks.  A first-ever session opens with the warm-up (34 s in 5 and 10 min, 24 s in 3,
 * 8 s in a 40 s test); then push / rest pairs (26 ± 4 s and 20 ± 3 s, scaled to end on time,
 * jittered only when there is room) ending with a meadow, leaving the finale's seconds to the run
 * toward the dawn.  No block under 12 s.
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

/** The lamp's reach for a level (u), with its upgrades: the band can only add. */
export const lampFor = (level: number, ups = 0): number => RULES.lampMin + ups * RULES.lampStep + clamp(level) * RULES.lampExtra;
/** The reach at the threshold (level 0.5): the ring drawn on the light. */
export const LAMP_MARK = lampFor(0.5);
/** How far the level stands above the threshold (0 at or below it, 1 at the top). */
export const above = (level: number): number => clamp((level - 0.5) / 0.5);
/** The combo's multiplier of sparks: ×2 from 10, ×3 from 25. */
export const comboMult = (combo: number): number => 1 + RULES.comboAt.filter(n => combo >= n).length;
/** Oil lost to a harm, with the Oliwa upgrades. */
export const harmFor = (kind: HarmKind, oilUps = 0): number => RULES.harm[kind] * (1 - RULES.oilStep * oilUps);
/** The tier a level starts with (the Kuźnia upgrade). */
export const startTier = (forge: number): number => 1 + Math.max(0, forge);
/** The weapon a stage expects (the start plus the gates before it): blocks are cut to it. */
export const expectedTier = (stage: number, forge = 0): number => startTier(forge) + Math.round(1.4 * (Math.max(1, stage) - 1)) + 1;
/** A block's light at a level and stage: its strikes at the expected weapon, a little tougher every level. */
export const stoneHp = (level: number, stage: number, tall: boolean, k = 1): number =>
  Math.max(1, Math.round(RULES.strikes[tall ? 1 : 0] * powerOf(expectedTier(stage)) * RULES.levelHp ** (Math.max(1, level) - 1) * k));
/** Stones a block gives, with the Kamieniarz upgrade. */
export const stonesFor = (tall: boolean, stoneUps = 0): number => Math.round(RULES.stones[tall ? 1 : 0] * (1 + RULES.stoneStep * stoneUps));
/** A ledge's height at a level (u), before its jitter share j (0..1). */
export const ledgeFor = (level: number, j = 0.5): number => {
  const [base, per, cap, jit] = RULES.ledge;
  return base + Math.min(cap, per * (Math.max(1, level) - 1)) + (j - 0.5) * jit;
};
/** Steps a stair needs to be walked up without a jump. */
export const stepsFor = (height: number): number => Math.max(0, Math.ceil((height - RULES.stepUp) / RULES.stepH - 1e-9));
/** What the top of a stair of n steps asks of the hands at a ledge of this height. */
export function answerFor(height: number, n: number): 'walk' | 'jump' | 'double' | 'climb' {
  const left = height - n * RULES.stepH;
  if (left <= RULES.stepUp + 1e-9) return 'walk';
  if (left <= RULES.reach1) return 'jump';
  if (left <= RULES.reach2) return 'double';
  return 'climb';
}
/** A guardian's light: strikes of the sword he brings to it (so a fight is as long whatever the gates gave), the session's length, the lap. */
export const guardHpFor = (level: number, plannedSec: number, tier: number): number =>
  Math.max(10, Math.round(RULES.guardStrikes * powerOf(tier) * (plannedSec < 70 ? RULES.guardShort : 1) * (1 + RULES.guardLap * lapOfLevel(level))));
/** The stars of a level: the top reached, every lamb freed (or none to free), never caught. */
export const starsFor = (lambs: number, pens: number, caught: boolean): number => 1 + (lambs >= pens ? 1 : 0) + (caught ? 0 : 1);

/** What a stretch of a floor holds, in order: the generator lays them with gaps between. */
export type Beat = 'pitN' | 'pitW' | 'block' | 'tall' | 'pair' | 'walker' | 'special' | 'gate' | 'gate2' | 'pen';

/**
 * A floor's beats for a level and stage (pure, from the rng): gates in its first and second half
 * (the second one high from level 2 or the second stage), a pen on the second floor and two on the
 * third (the original's cages), then blocks, pits (wide ones more often each level), shadows and the
 * era's special (from level 2), shuffled between them.
 */
export function stagePlan(level: number, stage: number, rnd: () => number): Beat[] {
  const L = Math.max(1, level);
  const len = RULES.stageLen[0] + Math.min(RULES.stageLen[2], RULES.stageLen[1] * (L - 1));
  const n = Math.max(5, Math.round(len / 7.5));
  const wide = Math.min(0.6, 0.25 + 0.05 * L);
  const pool: Beat[] = [];
  for (let i = 0; i < n; i++) {
    const r = rnd();
    if (r < 0.34) pool.push(rnd() < 0.3 + 0.03 * L ? (rnd() < 0.5 ? 'tall' : 'pair') : 'block');
    else if (r < 0.58) pool.push(rnd() < wide ? 'pitW' : 'pitN');
    else if (r < 0.8 || L < 2) pool.push('walker');
    else pool.push('special');
  }
  const pens = stage === 3 ? 2 : stage === 2 ? 1 : 0;
  for (let i = 0; i < pens; i++) pool.splice(Math.floor(rnd() * (pool.length + 1)), 0, 'pen');
  // the gates: one early, one past the middle (high from level 2 or the second floor)
  pool.splice(Math.min(pool.length, 1 + Math.floor(rnd() * 2)), 0, 'gate');
  pool.splice(Math.max(0, pool.length - 1 - Math.floor(rnd() * 2)), 0, L >= 2 || stage >= 2 ? 'gate2' : 'gate');
  return pool;
}

/** The first-ever floor: one thing at a time, each taught when it comes. */
export const WARM_PLAN: readonly Beat[] = ['pitN', 'block', 'pitW', 'gate2', 'walker', 'tall', 'pen', 'pitN', 'block'];

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: DolinaProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

interface Box { x0: number; x1: number; y0: number; top: number; stone: Stone | null }
interface GenSnap { level: number; stage: number; i: number; y: number; beats: Beat[] }
interface Laid { x: number; snap: GenSnap }

export class DolinaSim {
  readonly p: DolinaProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  /** the band's last 40 s, drawn as the lantern posts along the road */
  readonly trace = new SignalTrace(40, 0.1);
  readonly talk: Companion;
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly restLead: number;
  readonly dawnNeed: number;
  readonly finaleSec: number;

  started = false;
  readonly session: number;
  readonly first: boolean;
  readonly look: number;
  readonly ups: { stone: number; forge: number; income: number; lamp: number; oil: number };
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  t = 0;
  tip = '';
  /** the opening story card is up (first-ever session): the road stays quiet */
  story = 0;

  // the pilgrim
  px = 0;
  py = 0;
  vy = 0;
  speed = 0;
  grounded = true;
  private coyoteT = 0;
  private bufT = 0;
  /** air jumps used since the last landing (the double jump) */
  airUsed = 0;
  /** the press is held (variable height) */
  held = false;
  stomping = false;
  /** 'run', lifted out of a pit by Ćma, climbing a wall by hand, fallen with no oil */
  state: 'run' | 'pit' | 'climb' | 'fallen' = 'run';
  stateT = 0;
  private liftTo = { x: 0, y: 0 };
  private climbTop = 0;
  private stuckT = 0;
  /** what stops him now: a block, a wall, nothing */
  blocked: 'stone' | 'wall' | null = null;
  safe = 0;
  stumble = 0;
  /** the staff: the next strike, the last strike's age (s) */
  private strikeCd = 0;
  strikeAge = 9;
  /** the last double jump's age (Ćma's flap, s) */
  flapAge = 9;
  stop = 0;
  timeScale = 1;
  combo = 0;
  private comboT = 0;

  // the level
  level: number;
  stage = 1;
  tier: number;
  stones = 0;
  oil = 1;
  readonly lambs: Lamb[] = [];
  private levelLambs = 0;
  private levelCaught = false;
  private levelSparks = 0;
  /** the way out of the level (world x), once laid */
  exitX = Infinity;
  exitY = 0;

  // the road
  readonly segs: Seg[] = [];
  readonly stonesOnRoad: Stone[] = [];
  readonly steps: Step[] = [];
  readonly walls: Wall[] = [];
  readonly gates: Gate[] = [];
  readonly shadows: Shadow[] = [];
  readonly shots: Shot[] = [];
  readonly posts: Post[] = [];
  arena: Arena | null = null;
  private nextId = 1;
  private roadX = 0;
  private genY = 0;
  private gen: GenSnap;
  private genOn = true;
  private readonly laid: Laid[] = [];
  private nextPost: number = RULES.postEvery;
  /** the meadow's stretch and the dawn's (for the painter) */
  meadowFrom = Infinity;
  meadowTo = -Infinity;
  /** the tide of the dark behind (world x of its front), on now */
  tideX = -Infinity;
  tideOn = false;

  // the band
  reliable = false;
  level01 = 0;
  calm = 0;
  lampR: number = RULES.flame;
  lampLook: LampLook = 'flame';
  dawnCharge = 0;
  private dawnBlock = 0;
  private nextDawn = 0;
  private lastHold = 0;
  private dawnArmed = false;
  maxHold = 0;
  private relSec = 0;
  flashT = 0;
  flashR = 0;
  brook = 0;
  private brookP = 0;

  // the coach and the companion's watchers
  private readonly did = new Set<string>();
  private readonly taught = new Map<string, Teach>();
  private teachAt = -99;
  private goodT = 0;
  private smallT = 0;
  private calmT = 0;
  private saidGood = false;
  private saidSmall = false;
  private saidCalm = false;
  private oilWarned = false;
  private tideWarned = false;

  // the session's numbers
  score = 0;
  sparks = 0;
  bestCombo = 0;
  kills = 0;
  breaks = 0;
  dawns = 0;
  falls = 0;
  caught = 0;
  doubles = 0;
  stomps = 0;
  stairs = 0;
  freed = 0;
  levels = 0;
  stars = 0;
  passedRests = 0;
  passedPushes = 0;
  guardsBeaten: GuardId[] = [];
  blindShare = -1;
  private dayGiftNow = 0;
  private lookUp = -1;
  private settled = false;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  readonly bestBefore: number | null;
  readonly levelStart: number;

  constructor(private readonly init: SimInit) {
    const p = (this.p = init.progress);
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.restLead = RULES.restLead[band];
    this.dawnNeed = RULES.dawnHold[band];
    this.finaleSec = finaleFor(init.plannedSec);
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.first = this.session === 1;
    this.look = lookOf(p.sparksAll);
    this.ups = { stone: upLevel(p, 'stone'), forge: upLevel(p, 'forge'), income: upLevel(p, 'income'), lamp: upLevel(p, 'lamp'), oil: upLevel(p, 'oil') };
    this.level = this.levelStart = Math.max(1, Math.round(p.level || 1));
    this.tier = startTier(this.ups.forge);
    this.pushesBase = p.pushes;
    this.plan = planBlocks(init.plannedSec, this.first, init.rng);
    this.talk = new Companion(init.rng);
    this.gen = { level: this.level, stage: 1, i: 0, y: 0, beats: this.first ? WARM_PLAN.slice() : stagePlan(this.level, 1, this.rng) };
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get era(): EraId { return ERAS[eraOfLevel(this.level)]; }
  get lap(): number { return lapOfLevel(this.level); }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.phase === 'play'; }
  get pushBlock(): boolean { return this.block?.kind === 'push' && this.phase === 'play'; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.phase === 'play'; }
  get warmBlock(): boolean { return this.block?.kind === 'warmup' && this.phase === 'play'; }
  /** a sighted push past its lead-in: the lamp answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get live(): boolean { return this.sighted && this.reliable; }
  get leadIn(): number { return this.lead; }
  get restLeadIn(): number { return this.restLead; }
  get power(): number { return powerOf(this.tier); }
  get mult(): number { return comboMult(this.combo); }
  get guard(): Guard | null { return this.arena?.guard ?? null; }
  get fighting(): boolean { const g = this.guard; return !!g && (g.state === 'enter' || g.state === 'fight'); }
  /** the guardian's weak point is open now */
  get guardOpen(): boolean {
    const g = this.guard;
    return !!g && g.state === 'fight' && (g.seq[g.i] === 'open' || g.dawnOpen > 0);
  }
  get move(): MoveKind | null {
    const g = this.guard;
    return g && g.state === 'fight' ? g.seq[g.i] : null;
  }
  /** at the arena, held there until the guardian is beaten */
  get inArena(): boolean { const a = this.arena; return !!a && !a.done && this.px >= a.x - 0.01; }
  /** the meadow's walk is on (a rest block) */
  get meadow(): boolean { return this.restBlock; }
  /** the share of the session gone (the road grows denser) */
  get share(): number { return clamp(this.t / Math.max(1, this.plannedSec - this.finaleSec)); }
  /** the floor the pilgrim stands on (u), for the camera */
  floorY = 0;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.story = this.first ? RULES.storySec : 0;
    this.roadX = 0;
    this.segs.push({ x0: -RULES.behind - 20, x1: this.first ? RULES.warmRun * RULES.storySec + 4 : 9, y: 0, kind: 'road' });
    this.roadX = this.segs[0].x1;
    this.startBlock(0);
    this.talk.clear();
    if (this.first) this.talk.say('first', 2, RULES.storySec + 6);
    else {
      this.talk.say('open', 2, 12);
      this.talk.say(`era.${this.era}`, 1, 16);
    }
    this.layAhead();
    this.resumeTide();
    this.emit({ type: 'stage', level: this.level, stage: this.stage });
  }

  // ── the hands ───────────────────────────────────────────────────
  /** The press: a jump on the ground (or just after an edge), the double jump in the air, else remembered for the landing. */
  press(): void {
    if (!this.started || this.phase === 'done') return;
    this.held = true;
    if (this.state === 'climb') {
      // a tap on the wall: he scrambles up faster
      this.py = Math.min(this.climbTop, this.py + RULES.climbTap);
      return;
    }
    if (this.state !== 'run') return;
    if (this.grounded || this.coyoteT > 0) this.groundJump();
    else if (this.airUsed < RULES.airJumps) this.airJump();
    else this.bufT = RULES.buffer;
  }

  /** The press lets go: a jump still rising is cut short (variable height). */
  releasePress(): void {
    this.held = false;
    if (this.state === 'run' && !this.grounded && this.vy > 0 && !this.stomping) this.vy *= RULES.cut;
  }

  private groundJump(): void {
    this.vy = RULES.jumpV;
    this.grounded = false;
    this.coyoteT = 0;
    this.bufT = 0;
    this.airUsed = 0;
    this.stomping = false;
    this.did.add('jump');
    this.emit({ type: 'jump', air: false, x: this.px, y: this.py });
  }

  private airJump(): void {
    this.vy = RULES.jump2V;
    this.airUsed++;
    this.bufT = 0;
    this.stomping = false;
    this.flapAge = 0;
    this.doubles++;
    if (!this.did.has('double')) {
      this.did.add('double');
      if (this.first) this.talk.say('double', 2, 3);
    }
    this.emit({ type: 'jump', air: true, x: this.px, y: this.py });
  }

  /** ↓ in the air: straight down (a stomp). */
  stomp(): void {
    if (!this.started || this.state !== 'run' || this.grounded) return;
    this.stomping = true;
    this.vy = -RULES.stompV;
  }

  /** Keys: Space, ↑, W, Enter jump (held: higher); ↓, S stomp. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const jump = k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'Enter';
    const drop = k === 'ArrowDown' || k === 's';
    if (!jump && !drop) return false;
    if (down && !this.keys.has(k)) {
      if (jump) this.press();
      else this.stomp();
    }
    if (down) this.keys.add(k);
    else {
      this.keys.delete(k);
      if (jump && ![' ', 'ArrowUp', 'w', 'Enter'].some(j => this.keys.has(j))) this.releasePress();
    }
    return true;
  }

  private readonly keys = new Set<string>();

  /** Every held key lets go (the runner's pause). */
  release(): void {
    this.keys.clear();
    this.held = false;
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.phaseT += dt;
    this.timeScale = this.stop > 0 ? 0 : 1;
    this.stop = Math.max(0, this.stop - dt);
    const w = dt * this.timeScale;
    this.story = Math.max(0, this.story - dt);
    this.brain(dt, w, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.end();
    this.timers(dt, w);
    this.runner(w);
    this.layAhead();
    this.walkShadows(w);
    this.moveShots(w);
    this.staff(w);
    this.guardian(w);
    this.tide(w);
    this.lambsFollow(w);
    this.stairsBuild(w);
    this.progressMarks();
    this.forget();
    this.watch(dt);
    this.coach();
    this.talk.update(dt, this.quiet);
  }

  /** the view has a card up: Ćma waits for it (set by the game every frame) */
  hold = false;

  /** The companion keeps quiet over a telegraph, while the runner's block banner is up and while a card is shown. */
  get quiet(): boolean {
    // a coach mark is up (the runner's bubble): one voice at a time
    if (this.story > 0.5 || this.hold || this.t - this.teachAt < 3.4) return true;
    if (this.phase !== 'play') return false;
    const b = this.block;
    if (b.kind !== 'warmup' && this.blockT < 5.6) return true;
    return b.dur - this.blockT <= RULES.telegraph + 0.3;
  }

  /**
   * The band's slow quantities: the lamp in a sighted push past its lead-in, the Świt from the hold,
   * the oil and the brook's stones from calm in a meadow past its lead-in; the trace.
   */
  private brain(dt: number, w: number, f: FocusFrame): void {
    const R = RULES, b = this.block;
    const play = this.phase === 'play';
    this.reliable = f.reliable;
    this.level01 = f.reliable ? f.level : 0;
    this.calm = f.reliable ? f.calm : 0;
    if (play && f.reliable) this.relSec += dt;
    const live = this.live;
    const base = R.lampMin + this.ups.lamp * R.lampStep;
    const want = live ? lampFor(f.level, this.ups.lamp) : this.pushBlock && !b.blind ? base : R.flame + this.ups.lamp * R.lampStep * 0.5;
    this.lampR = approach(this.lampR, want, dt, R.lampTau);
    this.lampLook = !play || b.kind !== 'push' ? 'flame' : b.blind ? 'blind' : this.blockT < this.lead ? 'wait' : f.reliable ? 'live' : 'grey';
    this.flashT = Math.max(0, this.flashT - dt);
    const phase: TracePhase = !play ? 'free' : b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
    // the light on the shadows inside it: slower always, burning above the threshold
    for (const s of this.shadows) {
      s.inLight = false;
      if (s.state !== 'walk' || !live) continue;
      if (Math.hypot(s.x - this.px, s.y + s.h / 2 - this.py - 0.6) > this.lampR + s.r) continue;
      s.inLight = true;
      const burn = R.burn * above(f.level) * s.max * w;
      if (burn <= 0) continue;
      s.hp -= burn;
      s.burn += burn;
      if (s.hp <= 1e-6) this.kill(s, 'light');
    }
    for (const st of this.stonesOnRoad) st.lit = st.alive && st.x - this.px <= this.lampR + R.fogMargin;
    // the Świt: a held focus lights it (only the hold built inside this block counts)
    if (live && !this.dawnArmed) {
      this.dawnArmed = true;
      this.nextDawn = this.dawnNeed + Math.max(0, f.hold - this.blockT);
    }
    if (f.hold < this.lastHold - 0.5) this.nextDawn = this.dawnNeed;
    this.lastHold = f.hold;
    if (live) this.maxHold = Math.max(this.maxHold, f.hold);
    const need = this.dawnNeed;
    this.dawnCharge = live && this.dawnBlock < R.dawnMax ? clamp((f.hold - (this.nextDawn - need)) / need) : approach(this.dawnCharge, 0, dt, 0.6);
    if (live && f.hold >= this.nextDawn && this.dawnBlock < R.dawnMax) {
      this.dawnBlock++;
      this.nextDawn = f.hold + need;
      this.dawn();
    }
    // the meadow: calm refills the oil and gathers smooth stones from the brook
    if (play && b.kind === 'rest' && this.blockT >= this.restLead && f.reliable) {
      this.oil = Math.min(1, this.oil + R.oilGain * f.calm * dt);
      this.brookP = Math.min(R.brookMax, this.brookP + R.brookGain * f.calm * dt);
      while (Math.floor(this.brookP) > this.brook) {
        this.brook++;
        this.stones++;
        this.gain(R.brookSparks);
        this.emit({ type: 'brook', n: this.brook });
      }
    }
  }

  /** The Świt: every shadow in sight dissolves, every block bursts into stones, the tide is thrown back; a guardian opens. */
  private dawn(): void {
    let n = 0, got = 0;
    for (const s of this.shadows) {
      if (s.state === 'gone' || s.x < this.px - 4 || s.x > this.px + RULES.ahead * 0.7) continue;
      n += this.kill(s, 'dawn');
    }
    for (const st of this.stonesOnRoad) {
      if (!st.alive || st.x < this.px - 3 || st.x > this.px + RULES.ahead * 0.7) continue;
      got += this.breakStone(st, 'dawn');
    }
    for (const s of this.shots) if (s.alive) this.breakShot(s, 'dawn');
    if (this.tideOn) this.tideX = this.px - RULES.tideMax;
    const g = this.guard;
    const onGuard = !!g && g.state === 'fight';
    if (g && onGuard) {
      g.dawnOpen = RULES.dawnOpen;
      this.hurtGuard(g, g.max * RULES.dawnGuard, 'dawn');
      if (g.state === 'fight') this.emit({ type: 'guard', what: 'open', id: g.id, era: g.era });
    }
    this.dawns++;
    this.stop = Math.max(this.stop, RULES.stopBeaten * 0.6);
    this.emit({ type: 'dawn', n, stones: got, guard: onGuard });
    this.talk.say('big', 2, 3);
    this.explain('dawn');
  }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.talk.hush();
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
    this.goodT = this.smallT = this.calmT = 0;
    this.saidGood = this.saidSmall = this.saidCalm = false;
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.dawnBlock = 0;
      this.dawnArmed = false;
      this.nextDawn = this.dawnNeed;
      this.lastHold = 0;
      this.talk.say(b.blind ? 'blind' : 'push', 1, 10);
      if (b.blind) this.explain('fog');
      if (i > 0) this.resumeTide();
    } else if (b.kind === 'rest') {
      this.brookP = 0;
      this.brook = 0;
      this.tideOn = false;
      this.tideX = -Infinity;
      if (this.guard && this.guard.state !== 'beaten') this.withdraw();
      if (!this.inArena) this.cut(b.dur * RULES.walk + 6, 'meadow');
      this.talk.say('rest', 1, 10);
      this.explain('meadow');
    }
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    let key: Key;
    if (b.kind === 'warmup') key = TIPS.warmup[0];
    else if (b.kind === 'push') {
      if (b.blind) key = TIPS.blind[(this.session + i) % TIPS.blind.length];
      else if (first && this.pushesBase === 0) key = TIPS.firstPush;
      else key = TIPS.push[(this.session - 1 + i) % TIPS.push.length];
    } else key = first && this.first ? TIPS.firstRest : TIPS.rest[(this.session - 1 + i) % TIPS.rest.length];
    return t(key);
  }

  /** The block's end: its verdict and what it pays — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block, R = RULES;
    let verdict: boolean | null = null, share = 0, need = 0;
    let pass: SimEvent | null = null;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= R.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'rest' && verdict) {
        this.passedRests++;
        this.oil = 1;
        this.stones += R.restStones;
        this.gain(R.restBonus);
        pass = { type: 'restPass', sparks: R.restBonus, stones: R.restStones };
      }
      if (b.kind === 'push' && verdict) {
        this.passedPushes++;
        this.gain(R.pushBonus);
        pass = { type: 'pushPass', sparks: R.pushBonus };
      }
      if (b.kind === 'push' && verdict === false && share >= need - 0.12) this.talk.say('near', 1, 6);
      if (b.blind) {
        this.trace.unveil(this.t);
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        this.blindFlash(s);
      }
    }
    // a guardian not beaten withdraws, keeping its damage
    if (b.kind === 'push' && this.guard && this.guard.state !== 'beaten') this.withdraw();
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need, t0: this.t - this.blockT, t1: this.t, brook: b.kind === 'rest' ? this.brook : 0 });
    if (pass) this.emit(pass);
  }

  /** The blind block's end: its focus as one flash of that strength. */
  private blindFlash(share: number): void {
    const r = lampFor(share, this.ups.lamp);
    let n = 0;
    for (const s of this.shadows) {
      if (s.state === 'gone' || Math.abs(s.x - this.px) > r) continue;
      n += this.kill(s, 'flash');
    }
    if (this.tideOn) this.tideX = Math.min(this.tideX, this.px - RULES.tideStart * share);
    const g = this.guard;
    if (g && g.state === 'fight' && share >= 0.3) {
      g.dawnOpen = RULES.dawnOpen * share;
      this.emit({ type: 'guard', what: 'open', id: g.id, era: g.era });
    }
    this.flashT = RULES.flashSec;
    this.flashR = r;
    this.emit({ type: 'flash', share, r, n });
  }

  // ── the road: laying it ahead ───────────────────────────────────
  private layAhead(): void {
    let guard = 0;
    while (this.genOn && this.roadX < this.px + RULES.ahead && guard++ < 40) this.layNext();
  }

  private snap(): GenSnap { return { ...this.gen, beats: this.gen.beats }; }

  private flat(to: number, kind: Seg['kind'] = 'road'): void {
    if (to <= this.roadX) return;
    const last = this.segs[this.segs.length - 1];
    if (last && Math.abs(last.x1 - this.roadX) < 1e-6 && Math.abs(last.y - this.genY) < 1e-6 && last.kind === kind) last.x1 = to;
    else this.segs.push({ x0: this.roadX, x1: to, y: this.genY, kind });
    this.roadX = to;
  }

  /** The gap before the next beat: roomy early in a session and a level, tighter later. */
  private gapNow(): number {
    const g = this.gen;
    const k = clamp(0.35 * this.share + 0.08 * Math.min(6, g.level - 1) + 0.12 * (g.stage - 1));
    return span(RULES.gap, k) + this.rng() * 1.4;
  }

  private layNext(): void {
    const g = this.gen;
    if (g.i >= g.beats.length) {
      this.layEnd();
      return;
    }
    const beat = g.beats[g.i];
    const x = this.roadX + this.gapNow();
    this.laid.push({ x, snap: this.snap() });
    g.i++;
    this.flat(x);
    this.post(x);
    const id = () => this.nextId++;
    const era = ERAS[eraOfLevel(g.level)];
    switch (beat) {
      case 'pitN':
      case 'pitW': {
        const w = beat === 'pitN' ? span(RULES.pitNarrow, this.rng()) : span(RULES.pitWide, this.rng());
        this.roadX = x + w;
        this.flat(this.roadX + 1.2);
        break;
      }
      case 'block':
      case 'tall':
      case 'pen': {
        const tall = beat === 'tall', pen = beat === 'pen';
        this.flat(x + RULES.blockW + 1);
        const hp = pen ? stoneHp(g.level, g.stage, false, RULES.penStrikes / RULES.strikes[0]) : stoneHp(g.level, g.stage, tall, 0.85 + this.rng() * 0.3);
        this.stonesOnRoad.push({
          id: id(), x, y: this.genY, w: RULES.blockW * (pen ? 1.25 : 1), h: pen ? 1.25 : RULES.blockH[tall ? 1 : 0], hp, max: hp,
          stones: pen ? 0 : stonesFor(tall, this.ups.stone), tall, pen, alive: true, hitT: 0, lit: false, level: g.level,
        });
        if (pen) this.levelPensLaid(g.level);
        break;
      }
      case 'pair': {
        // a small block, then a tall one on its heels: a step up to jump from
        this.flat(x + RULES.blockW * 2 + 1);
        for (const [dx, tall] of [[0, false], [RULES.blockW, true]] as const) {
          const hp = stoneHp(g.level, g.stage, tall, 0.85 + this.rng() * 0.3);
          this.stonesOnRoad.push({
            id: id(), x: x + dx, y: this.genY, w: RULES.blockW, h: RULES.blockH[tall ? 1 : 0], hp, max: hp,
            stones: stonesFor(tall, this.ups.stone), tall, pen: false, alive: true, hitT: 0, lit: false, level: g.level,
          });
        }
        break;
      }
      case 'walker':
      case 'special': {
        const kind = ERA_SHADOWS[era][beat === 'walker' ? 'walker' : 'special'];
        this.flat(x + 1.2);
        this.spawnShadow(kind, x + 0.6, this.genY, g.level, g.stage);
        break;
      }
      case 'gate':
      case 'gate2': {
        const high = beat === 'gate2';
        this.flat(x + 1.4);
        this.gates.push({ id: id(), x: x + 0.7, y: this.genY, high: false, plus: RULES.gatePlus[0], taken: false });
        if (high) this.gates.push({ id: id(), x: x + 0.7, y: this.genY, high: true, plus: RULES.gatePlus[1], taken: false });
        break;
      }
    }
  }

  private readonly pensLaid = new Map<number, number>();
  private levelPensLaid(level: number, n = 1): void { this.pensLaid.set(level, Math.max(0, (this.pensLaid.get(level) ?? 0) + n)); }

  /** The floor's end: a ledge (with the way out on the third floor), or a guardian's arena. */
  private layEnd(): void {
    const g = this.gen, R = RULES;
    const x = this.roadX + this.gapNow();
    this.laid.push({ x, snap: this.snap() });
    if (g.stage === 3 && guardLevel(g.level) && !(this.first && g.level === 1)) {
      this.flat(x);
      this.flat(x + R.arenaLen + 40, 'arena');
      this.arena = { x: x + 2, y: this.genY, level: g.level, guard: null, done: false };
      this.genOn = false;
      this.roadX = x + R.arenaLen;
      this.advanceGen();
      return;
    }
    const wx = x + R.buildAt + 0.5;
    this.flat(wx);
    const h = ledgeFor(g.level, this.rng());
    const wall: Wall = {
      id: this.nextId++, x: wx, y0: this.genY, top: this.genY + h, level: g.level, stage: g.stage,
      need: stepsFor(h), built: 0, plan: 0, buildT: 0, started: false, passed: false,
    };
    this.walls.push(wall);
    this.genY += h;
    this.flat(wx + 4, 'ledge');
    if (g.stage === 3) {
      this.exitX = wx + 2.2;
      this.exitY = this.genY;
    }
    this.advanceGen();
  }

  private advanceGen(): void {
    const g = this.gen;
    if (g.stage >= 3) {
      g.level++;
      g.stage = 1;
    } else g.stage++;
    g.i = 0;
    g.y = this.genY;
    g.beats = stagePlan(g.level, g.stage, this.rng);
  }

  /** A lantern post beside the road every so often (lit by the band as he passes). */
  private post(x: number): void {
    if (x < this.nextPost) return;
    this.nextPost = x + RULES.postEvery;
    this.posts.push({ x: x - 0.6, y: this.genY, lit: 'none' });
  }

  /**
   * The road ahead gives way to a stretch of `len` u of meadow (a rest) or dawn (the finale): what
   * was laid beyond the cut steps back into the dark and is laid again after it, from where it was.
   */
  private cut(len: number, kind: 'meadow' | 'dawn'): void {
    let c = this.px + 3;
    // never through a stair being built: past the ledge instead
    for (const w of this.walls) if (!w.passed && w.x > this.px && w.x - this.px < RULES.buildAt + 1) c = Math.max(c, w.x + 1.5);
    // a cut in a pit moves to the far rim
    let seg = this.segs.find(s => s.x0 <= c && s.x1 >= c);
    if (!seg) {
      const nextSeg = this.segs.filter(s => s.x0 > c).sort((a, b) => a.x0 - b.x0)[0];
      if (nextSeg) { c = nextSeg.x0 + 0.5; seg = nextSeg; }
    }
    const y = seg ? seg.y : this.floorY;
    // roll the generator back to the first beat laid beyond the cut
    const back = this.laid.find(l => l.x >= c);
    if (back) {
      this.gen = { ...back.snap, beats: back.snap.beats };
      this.laid.splice(this.laid.indexOf(back));
    }
    for (let i = this.segs.length - 1; i >= 0; i--) {
      const s = this.segs[i];
      if (s.x0 >= c) this.segs.splice(i, 1);
      else if (s.x1 > c) s.x1 = c;
    }
    const drop = <T>(arr: T[], keep: (v: T) => boolean) => { for (let i = arr.length - 1; i >= 0; i--) if (!keep(arr[i])) arr.splice(i, 1); };
    for (const st of this.stonesOnRoad) if (st.x >= c && st.pen && st.alive) this.levelPensLaid(st.level, -1);
    drop(this.stonesOnRoad, s => s.x < c);
    drop(this.gates, gt => gt.x < c);
    drop(this.posts, p => p.x < c);
    drop(this.shots, s => s.x < c);
    for (const s of this.shadows) if (s.state === 'walk' && s.x >= c - 0.5) s.state = 'gone';
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      if (w.x >= c) {
        this.walls.splice(i, 1);
        drop(this.steps, st => st.wall !== w.id);
        if (w.stage === 3) this.exitX = Infinity;
      }
    }
    if (this.arena && !this.arena.done && this.arena.x >= c) this.arena = null;
    this.genY = y;
    this.gen.y = y;
    this.roadX = c;
    this.flat(c + len, kind);
    if (kind === 'meadow') {
      this.meadowFrom = c;
      this.meadowTo = c + len;
      this.genOn = true;
    } else this.genOn = false;
    this.nextPost = Math.max(this.nextPost, c + len);
  }

  // ── the shadows ─────────────────────────────────────────────────
  private spawnShadow(kind: ShadowKind, x: number, y: number, level: number, stage: number): void {
    const S = SHADOWS[kind];
    const hp = Math.max(1, Math.round(RULES.shadowStrikes[S.strikes > 1 ? 1 : 0] * powerOf(expectedTier(stage)) * RULES.levelHp ** (level - 1) * 0.9));
    this.shadows.push({
      id: this.nextId++, kind, x, y: y + S.air, r: S.r, h: S.h, hp, max: hp, state: 'walk', age: 0, hitT: 0, stun: 0,
      inLight: false, burn: 0, throwT: 0.6 + this.rng() * RULES.throwEvery, bob: this.rng() * 6,
    });
  }

  private walkShadows(w: number): void {
    const R = RULES;
    for (const s of this.shadows) {
      if (s.state !== 'walk') continue;
      s.age += w;
      s.hitT = Math.max(0, s.hitT - w);
      s.stun = Math.max(0, s.stun - w);
      const S = SHADOWS[s.kind];
      const d = s.x - this.px;
      const k = (s.inLight ? R.lightSlow : 1) * (s.stun > 0 ? 0 : 1);
      if (S.speed > 0 && d < 14 && d > -1 && !this.meadow) {
        const nx = s.x - S.speed * k * w;
        if (s.kind === 'kruk') s.x = nx;
        else {
          // walkers keep to the ground: they stop at a pit's rim, a ledge's edge, a block or a wall
          const here = s.y - S.air;
          const g = this.groundUnder(nx - s.r * 0.5, nx + s.r * 0.5, here + R.stepUp);
          if (g !== null && g >= here - 0.3 && !this.solidAt(nx - s.r, here)) {
            s.x = nx;
            s.y = g + S.air;
          }
        }
      }
      if (s.kind === 'ceglomiot' && d > R.throwFrom[0] && d < R.throwFrom[1] && !this.meadow && !this.fighting) {
        s.throwT -= w * k;
        if (s.throwT <= 0) {
          s.throwT = R.throwEvery;
          this.shots.push({ id: this.nextId++, kind: 'roll', x: s.x - s.r, y0: s.y, y1: s.y + R.rollH, w: 0.5, vx: -R.rollV, alive: true, passed: false, guard: false, t: 0 });
          this.emit({ type: 'throw', id: s.id, x: s.x, y: s.y + s.h * 0.7 });
        }
      }
      // the touch: from above it is a stomp, else it hurts
      if (this.state !== 'run') continue;
      const bx0 = this.px - R.halfW * 0.8, bx1 = this.px + R.halfW * 0.8;
      if (s.x + s.r * 0.85 < bx0 || s.x - s.r * 0.85 > bx1) continue;
      if (this.py > s.y + s.h * 0.92 || this.py + R.height < s.y + 0.05) continue;
      if (this.vy < 0 && this.py >= s.y + s.h * 0.45) {
        this.stompShadow(s);
        continue;
      }
      if (this.safe > 0) continue;
      if (s.kind === 'przewijacz') {
        this.px = Math.max(this.px - R.pullBack, this.px - 2);
        this.emit({ type: 'pull', x: this.px });
        this.harm('shadow', s.x, s.y + s.h / 2);
        this.kill(s, 'fade');
      } else {
        this.harm(S.harm, s.x, s.y + s.h / 2);
        s.stun = 0.6;
        s.x = Math.max(s.x, this.px + R.halfW + s.r + 0.6);
      }
    }
  }

  private stompShadow(s: Shadow): void {
    this.vy = RULES.bounceV;
    this.airUsed = 0;
    this.stomping = false;
    this.stomps++;
    this.did.add('stomp');
    this.emit({ type: 'stomp', x: s.x, y: s.y + s.h, what: 'shadow' });
    this.kill(s, 'stomp');
  }

  /** A shadow leaves the road as motes of light; 1 when it counted. */
  private kill(s: Shadow, via: Via): number {
    if (s.state === 'gone') return 0;
    s.state = 'gone';
    if (via === 'fade') return 0;
    const R = RULES;
    let sparks = SHADOWS[s.kind].sparks * (via === 'stomp' ? 2 : 1);
    if (via === 'strike' || via === 'stomp') {
      this.bump();
      sparks *= this.mult;
      this.stop = Math.max(this.stop, R.stopBreak);
    }
    this.kills++;
    this.gain(sparks);
    this.emit({ type: 'kill', id: s.id, kind: s.kind, x: s.x, y: s.y + s.h / 2, via, sparks, combo: this.combo });
    return 1;
  }

  /** A break or a kill without a hit taken: the combo climbs. */
  private bump(): void {
    this.combo++;
    this.comboT = 0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if ((RULES.comboAt as readonly number[]).includes(this.combo)) {
      this.emit({ type: 'combo', n: this.combo, mult: comboMult(this.combo) });
      this.talk.say('big', 1, 3);
    }
  }

  // ── the shots ───────────────────────────────────────────────────
  private moveShots(w: number): void {
    const R = RULES;
    for (const s of this.shots) {
      if (!s.alive) continue;
      s.t += w;
      const lit = this.live && Math.abs(s.x - this.px) < this.lampR;
      s.x += s.vx * w * (lit ? R.lightSlow : 1);
      if (!s.guard) {
        // a rolling brick falls into a pit and breaks on a block or a wall
        if (this.groundUnder(s.x, s.x + s.w, s.y0 + 0.2) === null) { this.breakShot(s, 'pit'); continue; }
        if (this.solidAt(s.x, s.y0)) { this.breakShot(s, 'wall'); continue; }
      }
      const bx0 = this.px - R.halfW * 0.75, bx1 = this.px + R.halfW * 0.75;
      const hit = this.state === 'run' && s.x < bx1 && s.x + s.w > bx0 && this.py < s.y1 - 0.04 && this.py + R.height * 0.92 > s.y0;
      if (hit) {
        if (this.safe <= 0) this.harm(s.guard ? 'guard' : 'roll', s.x, (s.y0 + s.y1) / 2);
        s.passed = true;
      }
      if (!s.passed && s.x + s.w < bx0) {
        s.passed = true;
        const gap = Math.min(Math.abs(this.py - s.y1), Math.abs(this.py + R.height - s.y0));
        this.emit({ type: 'dodge', near: gap < R.nearMiss, x: this.px, y: this.py });
        if (gap < R.nearMiss) this.talk.say('close', 0, 2);
      }
      if (s.x < this.px - 10) this.breakShot(s, 'past');
    }
  }

  private breakShot(s: Shot, via: 'wall' | 'pit' | 'dawn' | 'past'): void {
    if (!s.alive) return;
    s.alive = false;
    this.emit({ type: 'shotBreak', id: s.id, x: s.x + s.w / 2, y: (s.y0 + s.y1) / 2, via });
  }

  // ── the pilgrim ─────────────────────────────────────────────────
  private timers(dt: number, w: number): void {
    this.safe = Math.max(0, this.safe - w);
    this.stumble = Math.max(0, this.stumble - w);
    this.coyoteT = Math.max(0, this.coyoteT - w);
    this.bufT = Math.max(0, this.bufT - w);
    this.strikeAge += dt;
    this.flapAge += dt;
    for (const st of this.stonesOnRoad) st.hitT = Math.max(0, st.hitT - dt);
    if (this.combo > 0) {
      this.comboT += w;
      if (this.comboT >= RULES.comboLapse) this.combo = 0;
    }
  }

  /** The solid boxes near him: the ground (from below), the stair's steps, the blocks. */
  private boxes(): Box[] {
    const out: Box[] = [];
    const lo = this.px - 20, hi = this.px + RULES.ahead + 4;
    for (const s of this.segs) if (s.x1 >= lo && s.x0 <= hi) out.push({ x0: s.x0, x1: s.x1, y0: -1e9, top: s.y, stone: null });
    for (const s of this.steps) out.push({ x0: s.x0, x1: s.x1, y0: s.y0, top: s.top, stone: null });
    for (const s of this.stonesOnRoad) if (s.alive) out.push({ x0: s.x, x1: s.x + s.w, y0: s.y, top: s.y + s.h, stone: s });
    return out;
  }

  /** The highest top under [x0, x1] at or below `below` (null: nothing — a pit). */
  groundUnder(x0: number, x1: number, below: number): number | null {
    let best: number | null = null;
    for (const b of this.boxes()) {
      if (b.x1 <= x0 || b.x0 >= x1 || b.top > below + 1e-6) continue;
      if (best === null || b.top > best) best = b.top;
    }
    return best;
  }

  /** Something solid at (x, y) — a block or a wall standing above that height. */
  private solidAt(x: number, y: number): boolean {
    for (const b of this.boxes()) if (x > b.x0 && x < b.x1 && b.top > y + RULES.stepUp && b.y0 < y + 0.5) return true;
    return false;
  }

  /** Run, jump, land; blocks and walls stop him, steps lift him, pits catch him (and Ćma lifts him out). */
  private runner(w: number): void {
    const R = RULES;
    if (this.state === 'fallen') {
      this.stateT += w;
      if (this.stateT >= R.fallSec) this.rise();
      return;
    }
    if (this.state === 'pit') {
      this.stateT += w;
      const k = clamp(this.stateT / R.pitSec);
      if (k >= 1) {
        this.state = 'run';
        this.px = this.liftTo.x;
        this.py = this.liftTo.y;
        this.vy = 0;
        this.grounded = true;
        this.airUsed = 0;
        this.safe = Math.max(this.safe, 0.5);
        this.emit({ type: 'lift', x: this.px, y: this.py });
      }
      return;
    }
    if (this.state === 'climb') {
      this.stateT += w;
      this.py = Math.min(this.climbTop, this.py + R.climbV * w);
      if (this.py >= this.climbTop - 1e-6) {
        this.state = 'run';
        this.grounded = true;
        this.vy = 0;
        this.px += 0.05;
        this.stuckT = 0;
      }
      return;
    }
    // the speed this moment wants
    let target: number;
    if (this.story > 0) target = R.warmRun * 0.6;
    else if (this.inArena) target = 0;
    else if (this.phase === 'finale') target = R.dawnRun;
    else if (this.phase === 'done') target = R.walk;
    else if (this.block.kind === 'rest') target = R.walk;
    else if (this.block.kind === 'warmup') target = R.warmRun;
    else target = R.run + Math.min(R.levelRunMax, R.levelRun * (this.level - 1));
    if (this.stumble > 0 && target > 0) target *= 0.5;
    this.speed = approach(this.speed, target, w, R.speedTau);
    const boxes = this.boxes();
    // horizontal: the first solid face ahead within this frame's step stops him
    const tol = this.grounded ? R.stepUp : 0.12;
    let dx = this.speed * w;
    const front = this.px + R.halfW;
    let stop: Box | null = null;
    for (const b of boxes) {
      if (b.x0 < front - 0.02 || b.x0 > front + dx + 1e-6) continue;
      if (b.top <= this.py + tol || b.y0 >= this.py + R.height) continue;
      if (!stop || b.x0 < stop.x0) stop = b;
    }
    const a = this.arena;
    if (a && !a.done && this.px <= a.x + 0.01) dx = Math.max(0, Math.min(dx, a.x - this.px));
    if (stop) {
      dx = Math.max(0, stop.x0 - front);
      this.blocked = stop.stone ? 'stone' : 'wall';
      this.speed = Math.min(this.speed, 0.6);
    } else this.blocked = null;
    this.px += dx;
    if (!this.settled) this.score = Math.max(this.score, Math.floor(this.px));
    // stuck at a wall on the ground: after a moment he climbs it by hand
    // (jumping against it still counts: hops that cannot reach the top never hold him there)
    if (this.blocked === 'wall') {
      this.stuckT += w;
      if (this.grounded && this.stuckT >= (this.first ? R.climbWaitFirst : R.climbWait)) {
        this.state = 'climb';
        this.stateT = 0;
        this.climbTop = stop!.top;
        this.emit({ type: 'climb', x: this.px, y: this.py });
        this.talk.say('climb', 0, 3);
      }
    } else this.stuckT = 0;
    // vertical
    const x0 = this.px - R.halfW * 0.7, x1 = this.px + R.halfW * 0.7;
    if (this.grounded) {
      const g = this.groundUnder(x0, x1, this.py + R.stepUp);
      if (g === null || g < this.py - 0.05) {
        this.grounded = false;
        this.coyoteT = R.coyote;
        this.vy = 0;
      } else this.py = g;
    }
    if (!this.grounded) {
      this.vy -= R.g * w;
      const ny = this.py + this.vy * w;
      if (this.vy <= 0) {
        const g = this.groundUnder(x0, x1, this.py + 0.02);
        if (g !== null && ny <= g) {
          this.landOn(g, boxes, x0, x1);
          return;
        }
      }
      this.py = ny;
      this.guardStomp();
      if (this.py < this.floorY - 2.6) this.pitFall();
    }
  }

  private landOn(g: number, boxes: Box[], x0: number, x1: number): void {
    const R = RULES;
    // a stomp onto a block hits it three times as hard; if it breaks he falls on through
    if (this.stomping) {
      const st = boxes.find(b => b.stone && b.top === g && b.x1 > x0 && b.x0 < x1)?.stone;
      if (st) {
        this.stomps++;
        this.emit({ type: 'stomp', x: st.x + st.w / 2, y: st.y + st.h, what: 'stone' });
        this.hitStone(st, this.power * R.stompHit, 'stomp');
        if (!st.alive) {
          this.py = g - 0.01;
          return;
        }
      }
    }
    const v = -this.vy;
    this.py = g;
    this.vy = 0;
    this.grounded = true;
    this.airUsed = 0;
    this.stomping = false;
    this.floorY = this.supportFloor(g);
    this.emit({ type: 'land', x: this.px, y: g, v });
    if (this.bufT > 0) this.groundJump();
  }

  /** The floor a landing counts for the camera and the pits: the road under him, not a block's top. */
  private supportFloor(g: number): number {
    const seg = this.segs.find(s => s.x0 <= this.px && s.x1 >= this.px);
    return seg ? seg.y : g;
  }

  /** Into a pit: Ćma lifts him to the far rim (a little oil). */
  private pitFall(): void {
    const next = this.segs.filter(s => s.x0 > this.px - 0.5).sort((a, b) => a.x0 - b.x0)[0];
    const prev = this.segs.filter(s => s.x1 <= this.px + 0.5).sort((a, b) => b.x1 - a.x1)[0];
    const to = next ?? prev;
    this.state = 'pit';
    this.stateT = 0;
    this.liftTo = to ? { x: to === next ? to.x0 + 0.45 : to.x1 - 0.45, y: to.y } : { x: this.px, y: this.floorY };
    this.vy = 0;
    this.emit({ type: 'pit', x: this.px, y: this.py });
    this.talk.say('pit', 1, 3);
    this.safe = 0;
    this.harm('pit', this.px, this.py, true);
    this.floorY = this.liftTo.y;
  }

  /** Oil lost (never below none); with none he falls. */
  private harm(kind: HarmKind, x: number, y: number, force = false): void {
    if ((this.safe > 0 && !force) || this.state === 'fallen') return;
    const loss = harmFor(kind, this.ups.oil);
    this.oil = Math.max(0, this.oil - loss);
    this.combo = 0;
    this.safe = RULES.safeSec;
    this.stumble = RULES.stumbleSec;
    this.emit({ type: 'harm', kind, oil: this.oil, x, y });
    if (this.oil <= 0.001 && this.state === 'run') this.fall();
    else if (this.oil < 0.3 && !this.oilWarned) {
      this.oilWarned = true;
      this.talk.say('oil', 1, 3);
    }
  }

  /** No oil: he falls, and rises with half oil (Micah 7:8). */
  private fall(): void {
    this.state = 'fallen';
    this.stateT = 0;
    this.falls++;
    this.emit({ type: 'fall' });
    this.talk.say('fall', 2, 4);
  }

  private rise(): void {
    const R = RULES;
    this.state = 'run';
    this.oil = R.riseOil;
    this.oilWarned = false;
    this.safe = R.safeSec * 1.5;
    for (const s of this.shadows) if (s.state !== 'gone' && Math.abs(s.x - this.px) < R.clearNear) this.kill(s, 'fade');
    for (const s of this.shots) if (s.alive && Math.abs(s.x - this.px) < R.clearNear) this.breakShot(s, 'dawn');
    if (this.tideOn) this.tideX = Math.min(this.tideX, this.px - R.tideStart);
    const g = this.guard;
    if (g && g.state === 'fight') {
      g.i = 0;
      g.moveT = 0;
      g.acted = g.acted2 = false;
      g.begun = false;
    }
    this.emit({ type: 'rise', x: this.px, y: this.py });
  }

  // ── the staff ───────────────────────────────────────────────────
  /** The staff strikes by itself whatever is in reach in front of him: a block, a shadow, an open guardian. */
  private staff(w: number): void {
    const R = RULES;
    this.strikeCd = Math.max(0, this.strikeCd - w);
    if (this.strikeCd > 0 || this.state !== 'run' || w <= 0) return;
    const front = this.px + R.halfW;
    const body0 = this.py, body1 = this.py + R.height;
    let best: { d: number; hit: () => void } | null = null;
    for (const st of this.stonesOnRoad) {
      if (!st.alive) continue;
      const d = st.x - front;
      if (d < -0.05 || d > R.reach * 0.6 || st.y >= body1 || st.y + st.h <= body0 + 0.05) continue;
      if (!best || d < best.d) best = { d, hit: () => this.hitStone(st, this.power, 'strike') };
    }
    for (const s of this.shadows) {
      if (s.state !== 'walk') continue;
      const d = s.x - s.r - front;
      if (d > R.reach || s.x + s.r < this.px - 0.1 || s.y >= body1 || s.y + s.h <= body0) continue;
      if (!best || d < best.d) best = { d, hit: () => this.hitShadow(s) };
    }
    const g = this.guard;
    if (g && g.state === 'fight' && this.guardOpen && g.rel - R.halfW <= R.reach + 0.05 && this.py < this.arena!.y + R.weakY + 0.8) {
      const d = g.rel - R.halfW;
      if (!best || d < best.d) best = { d, hit: () => this.strikeGuard(g, this.power, 'strike') };
    }
    if (!best) return;
    this.strikeCd = R.strikeGap;
    this.strikeAge = 0;
    best.hit();
  }

  private hitStone(st: Stone, dmg: number, via: 'strike' | 'stomp'): void {
    st.hp -= dmg;
    st.hitT = 0.12;
    this.stop = Math.max(this.stop, RULES.stopHit);
    this.emit({ type: 'strike', x: st.x, y: st.y + st.h * 0.5, what: 'stone', dmg });
    if (st.hp <= 1e-6) this.breakStone(st, via);
  }

  /** A block bursts: its stones fly into the pack; a pen frees its lamb.  Returns the stones won. */
  private breakStone(st: Stone, via: 'strike' | 'stomp' | 'dawn'): number {
    if (!st.alive) return 0;
    st.alive = false;
    st.hp = 0;
    this.breaks++;
    if (via !== 'dawn') this.bump();
    this.stop = Math.max(this.stop, RULES.stopBreak);
    let sparks = 1;
    if (st.pen) {
      this.freeLamb(st);
      sparks = RULES.lambSparks;
    } else this.stones += st.stones;
    this.gain(sparks * this.mult);
    if (!st.pen && st.stones > 0) this.did.add('strike');
    this.emit({ type: 'break', id: st.id, x: st.x + st.w / 2, y: st.y + st.h / 2, stones: st.stones, tall: st.tall, pen: st.pen, combo: this.combo, via });
    return st.stones;
  }

  private freeLamb(st: Stone): void {
    this.freed++;
    this.levelLambs++;
    this.did.add('lamb');
    this.lambs.push({ id: st.id, x: st.x + st.w / 2, y: st.y, vy: 3, hop: this.rng() * 6 });
    if (this.lambs.length > RULES.flock) this.lambs.shift();
    this.emit({ type: 'lamb', n: this.freed, x: st.x + st.w / 2, y: st.y + 0.5 });
    this.talk.say('lamb', 1, 3);
  }

  private hitShadow(s: Shadow): void {
    s.hp -= this.power;
    s.hitT = 0.14;
    this.stop = Math.max(this.stop, RULES.stopHit);
    this.emit({ type: 'strike', x: s.x, y: s.y + s.h / 2, what: 'shadow', dmg: this.power });
    if (s.hp <= 1e-6) this.kill(s, 'strike');
    else {
      s.x += 1.3;
      s.stun = 0.4;
    }
  }

  // ── the lambs ───────────────────────────────────────────────────
  private lambsFollow(w: number): void {
    this.lambs.forEach((l, i) => {
      const want = this.px - 1 - i * 0.62;
      l.x = approach(l.x, want, w, 0.25);
      l.hop += w * 9;
      const g = this.groundUnder(l.x - 0.15, l.x + 0.15, l.y + 2) ?? l.y;
      if (l.y > g + 0.01 || l.vy > 0) {
        l.vy -= RULES.g * 0.7 * w;
        l.y = Math.max(g, l.y + l.vy * w);
        if (l.y <= g) l.vy = 0;
      } else l.y = approach(l.y, g, w, 0.08);
    });
  }

  // ── the stairs ──────────────────────────────────────────────────
  /** Near a ledge the stones in the pack fly out and become a stair at its foot, one step at a time. */
  private stairsBuild(w: number): void {
    const R = RULES;
    for (const wall of this.walls) {
      if (wall.passed) continue;
      if (!wall.started && wall.x - this.px <= R.buildAt && this.px < wall.x) {
        wall.started = true;
        wall.plan = Math.min(this.stones, wall.need);
        this.stones -= wall.plan;
        this.stairs++;
        const answer = answerFor(wall.top - wall.y0, wall.plan);
        this.emit({ type: 'stairs', wall: wall.id, n: wall.plan, need: wall.need, answer });
        if (answer === 'climb' || wall.plan < wall.need / 3) this.talk.say('short', 1, 3);
        else this.talk.say('stairs', 0, 3);
        const teach: Teach | null = answer === 'jump' ? 'stairsJump' : answer === 'double' ? 'stairsDouble' : answer === 'climb' ? 'stairsClimb' : null;
        if (teach && (this.first || !this.p.seen.includes('stairs'))) this.teach(teach, wall.x - 0.3, wall.y0 + wall.plan * R.stepH + 0.8, `wall${wall.id}`);
      }
      if (wall.started && wall.built < wall.plan) {
        wall.buildT += w;
        while (wall.built < wall.plan && wall.buildT >= R.stepEvery) {
          wall.buildT -= R.stepEvery;
          const i = wall.built++;
          const x0 = wall.x - (wall.plan - i) * R.stepD;
          // the stair: step i spans from the floor to its own top (higher toward the wall)
          const step: Step = { x0, x1: wall.x, y0: wall.y0, top: wall.y0 + (i + 1) * R.stepH, age: 0, wall: wall.id };
          this.steps.push(step);
          this.emit({ type: 'step', wall: wall.id, i, x: x0 + R.stepD / 2, y: step.top });
        }
      }
      // over the top: the floor changes
      if (this.px >= wall.x + 0.3 && this.py >= wall.top - 0.05 && this.state === 'run') {
        wall.passed = true;
        this.floorY = wall.top;
        this.did.add('stairs');
        if (!this.p.seen.includes('stairs') && !this.first) this.p.seen.push('stairs');
        if (wall.stage < 3) {
          this.stage = wall.stage + 1;
          this.emit({ type: 'stage', level: this.level, stage: this.stage });
          this.resumeTide();
        }
      }
    }
    for (const s of this.steps) s.age += w;
  }

  // ── the gates, the way out, the posts ───────────────────────────
  private progressMarks(): void {
    const R = RULES;
    const mid = this.py + 0.5;
    for (const g of this.gates) {
      if (g.taken || this.px < g.x || this.px - g.x > 0.6) continue;
      const rel = mid - g.y;
      const [lo, hi] = g.high ? R.gateHigh : R.gateLow;
      if (rel < lo || rel > hi) continue;
      // one of a pair: the high one wins, the low one is passed by
      for (const o of this.gates) if (o !== g && Math.abs(o.x - g.x) < 0.01) o.taken = true;
      g.taken = true;
      this.tier += g.plus;
      this.gain(2);
      this.did.add('gate');
      this.emit({ type: 'gate', id: g.id, plus: g.plus, tier: this.tier, high: g.high, x: g.x, y: g.y + (g.high ? 3 : 1.2) });
      if (g.high) this.talk.say('gate', 1, 3);
    }
    if (this.px >= this.exitX && this.state === 'run') this.completeLevel();
    for (const p of this.posts) {
      if (p.lit !== 'none' || this.px < p.x) continue;
      p.lit = this.sighted && this.reliable && this.level01 >= 0.5 ? 'gold' : 'warm';
      this.emit({ type: 'post', x: p.x, y: p.y, lit: p.lit });
    }
  }

  /** The way out of a level: stars, sparks, the leftover stones as sparks; the next level begins. */
  private completeLevel(): void {
    const R = RULES;
    const pens = this.pensLaid.get(this.level) ?? 0;
    const stars = starsFor(this.levelLambs, pens, this.levelCaught);
    const left = Math.floor(this.stones * R.stoneSparks);
    const sparks = 10 + 5 * stars + left;
    this.gain(sparks);
    this.levels++;
    this.stars += stars;
    setStars(this.p, this.level, stars);
    this.emit({ type: 'level', level: this.level, stars, lambs: this.levelLambs, pens, caught: this.levelCaught, sparks: sparks + this.levelSparks });
    this.talk.say('level', 1, 4);
    const eraBefore = eraOfLevel(this.level);
    this.level++;
    this.stage = 1;
    this.tier = startTier(this.ups.forge);
    this.stones = 0;
    this.levelLambs = 0;
    this.levelCaught = false;
    this.levelSparks = 0;
    this.lambs.length = 0;
    this.exitX = Infinity;
    if (this.arena?.done) this.arena = null;
    this.emit({ type: 'stage', level: this.level, stage: 1 });
    if (eraOfLevel(this.level) !== eraBefore) {
      this.emit({ type: 'era', era: this.era, lap: this.lap, level: this.level });
      this.talk.say(`era.${this.era}`, 1, 9);
    }
    this.resumeTide();
  }

  // ── the tide of the dark ────────────────────────────────────────
  /** The tide comes back behind him (a new floor, a push block after a meadow). */
  private resumeTide(): void {
    if (this.phase !== 'play' || this.block.kind === 'rest' || this.first && this.warmBlock) return;
    this.tideOn = true;
    this.tideX = this.px - RULES.tideStart;
    this.tideWarned = false;
  }

  private tide(w: number): void {
    const R = RULES;
    const on = this.tideOn && this.phase === 'play' && this.block.kind !== 'rest' && !this.inArena && this.story <= 0 && !(this.first && this.warmBlock);
    if (!on) return;
    if (!Number.isFinite(this.tideX)) this.tideX = this.px - R.tideStart;
    let v = R.tideV + R.tideLevel * (this.level - 1);
    const d = this.px - this.tideX;
    if (this.live && d < this.lampR) v = this.level01 > 0.5 ? -R.tidePush * above(this.level01) : v * R.tideSlow;
    this.tideX += v * w;
    this.tideX = Math.max(this.tideX, this.px - R.tideMax);
    if (this.px - this.tideX < 4.5 && !this.tideWarned) {
      this.tideWarned = true;
      this.talk.say('tide', 1, 3);
      this.explain('tide');
    }
    if (this.tideX >= this.px - R.halfW && this.state === 'run') this.caughtByTide();
  }

  /** Caught by the tide: Ćma flares the lamp — some oil, some stones spilled, the dark thrown back; the run goes on. */
  private caughtByTide(): void {
    const R = RULES;
    const spilled = Math.ceil(this.stones * R.caughtSpill);
    this.stones -= spilled;
    this.caught++;
    this.levelCaught = true;
    this.tideX = this.px - R.caughtBack;
    this.safe = 0;
    this.emit({ type: 'caught', spilled, x: this.px, y: this.py });
    this.harm('shadow', this.px - 0.5, this.py + 0.5, true);
    this.talk.say('caught', 2, 3);
  }

  // ── the guardian ────────────────────────────────────────────────
  private guardian(w: number): void {
    const a = this.arena, R = RULES;
    if (!a || a.done) return;
    // it comes when he stands in its arena in a push block with time left (never in the warm-up or a meadow)
    if (this.inArena && !a.guard && this.pushBlock && this.block.dur - this.blockT >= R.guardNeed) this.summon(a);
    else if (this.inArena && a.guard && a.guard.state === 'leave' && a.guard.st > 1 && this.pushBlock && this.block.dur - this.blockT >= R.guardNeed) {
      a.guard.state = 'enter';
      a.guard.st = 0;
      this.emit({ type: 'guard', what: 'come', id: a.guard.id, era: a.guard.era });
    }
    const g = a.guard;
    if (!g) return;
    g.st += w;
    g.hitT = Math.max(0, g.hitT - w);
    if (g.state === 'enter') {
      g.rel = approach(g.rel, R.guardAt, w, 0.35);
      if (g.st >= 1.4) {
        g.state = 'fight';
        g.st = 0;
        g.i = 0;
        g.moveT = 0;
        g.begun = false;
        this.emit({ type: 'guard', what: 'fight', id: g.id, era: g.era });
      }
      return;
    }
    if (g.state === 'leave') {
      g.rel = approach(g.rel, 14, w, 0.6);
      return;
    }
    if (g.state === 'beaten') {
      g.rel = approach(g.rel, R.guardAt + 2, w, 0.8);
      return;
    }
    // the fight: its clock slows in a live light, quickens when angry
    const lit = this.live;
    const clock = w * (g.angry ? R.angry : 1) * (lit ? R.lightSlow + (1 - R.lightSlow) * (1 - this.level01) : 1);
    g.dawnOpen = Math.max(0, g.dawnOpen - w);
    if (lit && this.level01 > 0.5) this.hurtGuard(g, R.guardBurn * above(this.level01) * this.power * w, 'light');
    if (g.state !== 'fight') return;
    const mv = g.seq[g.i];
    const spec = R.moves[mv];
    if (!g.begun) {
      g.begun = true;
      this.emit({ type: 'move', kind: mv, act: false, id: g.id });
      if (mv === 'open') this.explain('open');
    }
    g.moveT += clock;
    const open = mv === 'open' || g.dawnOpen > 0;
    g.rel = approach(g.rel, open ? R.guardNear + R.halfW : R.guardAt, w, open ? 0.18 : 0.3);
    if (mv !== 'open' && !g.acted && g.moveT >= spec.tele) {
      g.acted = true;
      this.throwFor(g, mv, false);
      this.emit({ type: 'move', kind: mv, act: true, id: g.id });
    }
    if (mv === 'pair' && g.acted && !g.acted2 && g.moveT >= spec.tele + R.pairGap) {
      g.acted2 = true;
      this.throwFor(g, mv, true);
    }
    if (g.moveT >= spec.len) {
      g.i = (g.i + 1) % g.seq.length;
      g.moveT = 0;
      g.acted = g.acted2 = false;
      g.begun = false;
    }
  }

  private summon(a: Arena): void {
    const era = ERAS[eraOfLevel(a.level)];
    const id = GUARDS[era];
    const hp = guardHpFor(a.level, this.plannedSec, this.tier);
    a.guard = {
      id, era, hp, max: hp, state: 'enter', st: 0, rel: 14, seq: SEQ[id].calm, i: 0, moveT: 0, acted: false, acted2: false, begun: false,
      dawnOpen: 0, hitT: 0, angry: false,
    };
    this.emit({ type: 'guard', what: 'come', id, era });
    this.talk.say(`guard.${id}`, 2, 4);
    this.explain('guard');
  }

  /** A guardian's throw toward him along the road. */
  private throwFor(g: Guard, mv: MoveKind, second: boolean): void {
    const R = RULES, y = this.arena!.y;
    const x = this.px + g.rel - 0.2;
    const kind: ShotKind = mv === 'pair' ? (second ? 'wall' : 'roll') : mv === 'wall' ? 'wall' : mv === 'high' ? 'high' : 'roll';
    const [y0, y1] = kind === 'roll' ? [y, y + 0.7] : kind === 'wall' ? [y, y + R.wallH] : [y + R.highY[0], y + R.highY[1]];
    this.shots.push({ id: this.nextId++, kind, x, y0, y1, w: kind === 'high' ? 1.6 : 0.6, vx: -R.throwV, alive: true, passed: false, guard: true, t: 0 });
  }

  /** A jump that comes down on the open weak point: a stomp, three times as hard. */
  private guardStomp(): void {
    const g = this.guard, R = RULES;
    if (!g || g.state !== 'fight' || !this.guardOpen || this.vy >= 0) return;
    const wy = this.arena!.y + R.weakY;
    const gx = this.px + g.rel;
    // the weak point bows over him while open: only the height counts (both jumps reach it)
    if (this.py > wy + 0.35 || this.py < wy - 0.25 || this.px + R.halfW < gx - 1.2) return;
    this.vy = R.bounceV;
    this.airUsed = 0;
    this.stomps++;
    this.did.add('stomp');
    this.emit({ type: 'stomp', x: gx + 0.4, y: wy, what: 'guard' });
    this.strikeGuard(g, this.power * R.stompHit, 'stomp');
  }

  private strikeGuard(g: Guard, dmg: number, via: 'strike' | 'stomp'): void {
    g.hitT = 0.14;
    this.stop = Math.max(this.stop, RULES.stopGuard);
    if (via === 'strike') this.emit({ type: 'strike', x: this.px + g.rel, y: this.arena!.y + 1, what: 'guard', dmg });
    this.hurtGuard(g, dmg, via);
  }

  private hurtGuard(g: Guard, dmg: number, via: 'strike' | 'stomp' | 'light' | 'dawn'): void {
    if (g.state !== 'fight') return;
    g.hp = Math.max(0, g.hp - dmg);
    if (via !== 'light' || Math.floor(g.hp) !== Math.floor(g.hp + dmg)) this.emit({ type: 'guardHit', id: g.id, left: g.hp / g.max, via });
    if (!g.angry && g.hp <= g.max * RULES.angryAt) {
      g.angry = true;
      g.seq = SEQ[g.id].angry;
      g.i = 0;
      g.moveT = 0;
      g.acted = g.acted2 = false;
      g.begun = false;
      this.emit({ type: 'guard', what: 'angry', id: g.id, era: g.era });
      this.talk.say('angry', 1, 3);
    }
    if (g.hp <= 1e-6) this.beat(g);
  }

  private beat(g: Guard): void {
    const R = RULES, a = this.arena!;
    g.state = 'beaten';
    g.st = 0;
    g.hp = 0;
    for (const s of this.shots) if (s.alive && s.guard) this.breakShot(s, 'dawn');
    this.stop = Math.max(this.stop, R.stopBeaten);
    this.guardsBeaten.push(g.id);
    this.gain(R.guardSparks * (1 + this.lap));
    this.emit({ type: 'guard', what: 'beaten', id: g.id, era: g.era });
    this.talk.say('beaten', 2, 4);
    a.done = true;
    this.exitX = a.x + 3;
    this.exitY = a.y;
    // the road goes on beyond the arena
    this.genOn = true;
    this.roadX = Math.max(this.roadX, a.x + R.arenaLen);
    const last = this.segs[this.segs.length - 1];
    if (last && last.kind === 'arena') last.x1 = this.roadX;
  }

  /** The block ended with the guardian standing: it withdraws into the dark, keeping its damage. */
  private withdraw(): void {
    const g = this.guard;
    if (!g || g.state === 'beaten' || g.state === 'leave') return;
    g.state = 'leave';
    g.st = 0;
    for (const s of this.shots) if (s.alive && s.guard) this.breakShot(s, 'dawn');
    this.emit({ type: 'guard', what: 'leave', id: g.id, era: g.era });
  }

  // ── forgetting what is behind ───────────────────────────────────
  private forget(): void {
    const cut = this.px - RULES.behind;
    const drop = <T>(arr: T[], gone: (v: T) => boolean) => {
      let n = 0;
      while (n < arr.length && gone(arr[n])) n++;
      if (n) arr.splice(0, n);
    };
    drop(this.segs, s => s.x1 < cut - 10 && this.segs.length > 1);
    drop(this.laid, l => l.x < cut);
    for (let i = this.stonesOnRoad.length - 1; i >= 0; i--) if (this.stonesOnRoad[i].x < cut || !this.stonesOnRoad[i].alive && this.stonesOnRoad[i].hitT <= 0) this.stonesOnRoad.splice(i, 1);
    for (let i = this.shadows.length - 1; i >= 0; i--) if (this.shadows[i].state === 'gone' || this.shadows[i].x < cut) this.shadows.splice(i, 1);
    for (let i = this.shots.length - 1; i >= 0; i--) if (!this.shots[i].alive) this.shots.splice(i, 1);
    for (let i = this.gates.length - 1; i >= 0; i--) if (this.gates[i].x < cut) this.gates.splice(i, 1);
    for (let i = this.posts.length - 1; i >= 0; i--) if (this.posts[i].x < cut - 6) this.posts.splice(i, 1);
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      if (w.passed && w.x < cut) {
        this.walls.splice(i, 1);
        for (let j = this.steps.length - 1; j >= 0; j--) if (this.steps[j].wall === w.id) this.steps.splice(j, 1);
      }
    }
  }

  // ── the coach and the companion's eyes ──────────────────────────
  /** A coach mark for a thing (once per thing; each kind at most twice, never two within 2.5 s). */
  private teach(what: Teach, x: number, y: number, key: string): void {
    if (this.taught.has(key) || this.t - this.teachAt < 2.5) return;
    if ([...this.taught.values()].filter(v => v === what).length >= 2) return;
    this.taught.set(key, what);
    this.teachAt = this.t;
    this.emit({ type: 'teach', what, x, y });
  }

  /** A first-time explanation in a later session (the guardian, the meadow, the tide, the fog, the Świt): once ever. */
  private explain(what: 'tide' | 'meadow' | 'guard' | 'open' | 'fog' | 'dawn'): void {
    if (this.p.seen.includes(what)) return;
    this.p.seen.push(what);
    // point at the thing: the guardian, the tide behind, else the road ahead
    const g = this.guard;
    const at = (what === 'guard' || what === 'open') && g ? { x: this.px + Math.min(g.rel, RULES.guardAt) + 1, y: this.floorY + 3.6 }
      : what === 'tide' ? { x: this.px - 3, y: this.floorY + 2.4 } : { x: this.px + 3, y: this.floorY + 2.6 };
    this.teach(what, at.x, at.y, `x-${what}`);
  }

  /** The first session teaches the hands, one thing at a time, as each first matters. */
  private coach(): void {
    if (!this.first || this.state !== 'run' || this.story > 0 || this.phase !== 'play') return;
    const ahead = (x: number, near: number) => x - this.px > 0 && x - this.px < near;
    // pits: the first edge ahead
    for (let i = 0; i + 1 < this.segs.length; i++) {
      const a = this.segs[i], b = this.segs[i + 1];
      const gap = b.x0 - a.x1;
      if (gap < 0.5 || !ahead(a.x1, 4.8)) continue;
      const wide = gap > RULES.pitNarrow[1] + 0.2;
      if (wide && !this.did.has('double')) this.teach('double', a.x1 + gap / 2, a.y + 2.2, `pit${a.x1.toFixed(1)}`);
      else if (!wide && !this.did.has('jump')) this.teach('jump', a.x1 + gap / 2, a.y + 1.4, `pit${a.x1.toFixed(1)}`);
      break;
    }
    for (const st of this.stonesOnRoad) {
      if (!st.alive || !ahead(st.x, 4.4)) continue;
      if (st.pen && !this.did.has('lamb')) this.teach('lamb', st.x + st.w / 2, st.y + st.h + 0.6, `st${st.id}`);
      else if (st.tall && !this.did.has('double')) this.teach('tall', st.x + st.w / 2, st.y + st.h + 0.6, `st${st.id}`);
      else if (!st.pen && !st.tall && !this.did.has('strike')) this.teach('strike', st.x + st.w / 2, st.y + st.h + 0.5, `st${st.id}`);
      break;
    }
    for (const g of this.gates) {
      if (g.high && !g.taken && ahead(g.x, 5) && !this.did.has('gate')) this.teach('gate', g.x, g.y + 3, `g${g.id}`);
    }
    for (const s of this.shadows) {
      if (s.state === 'walk' && ahead(s.x, 4.2) && !this.did.has('stomp')) this.teach('stomp', s.x, s.y + s.h + 0.6, `s${s.id}`);
    }
  }

  /** Watch for the moments she comments on: a good push, a dim lamp, a calm meadow. */
  private watch(dt: number): void {
    if (this.phase !== 'play') return;
    if (this.live) {
      this.goodT = this.level01 >= 0.6 ? this.goodT + dt : 0;
      this.smallT = this.level01 < 0.35 ? this.smallT + dt : 0;
      if (this.goodT >= 4 && !this.saidGood) {
        this.saidGood = true;
        this.talk.say('good', 1, 4);
      }
      if (this.smallT >= 9 && !this.saidSmall) {
        this.saidSmall = true;
        this.talk.say('small', 0, 4);
      }
    }
    if (this.restBlock && this.blockT >= this.restLead && this.reliable) {
      this.calmT = this.calm >= 0.6 ? this.calmT + dt : 0;
      if (this.calmT >= 4 && !this.saidCalm) {
        this.saidCalm = true;
        this.talk.say('calm', 1, 4);
      }
    }
    if (this.oil > 0.6) this.oilWarned = false;
  }

  /** What a guardian's move asks of the hands (the view's sign over it). */
  get answer(): Answer | null {
    const mv = this.move;
    if (!mv) return null;
    return this.guardOpen ? 'open' : ANSWER[mv];
  }

  // ── the end ─────────────────────────────────────────────────────
  /** The last block ended: the run toward the dawn. */
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    if (this.guard && this.guard.state !== 'beaten') this.withdraw();
    this.phase = 'finale';
    this.phaseT = 0;
    this.dawnCharge = 0;
    this.tideOn = false;
    if (this.arena && !this.arena.done) {
      this.arena.done = true;
      this.arena.guard = null;
    }
    this.cut(200, 'dawn');
    this.emit({ type: 'finale' });
    this.talk.say('end', 3, 4);
  }

  private end(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.phaseT = 0;
    this.emit({ type: 'done' });
    this.settle();
  }

  private gain(sparks: number): void {
    if (sparks <= 0 || this.settled) return;
    const n = Math.round(sparks * (1 + RULES.incomeStep * this.ups.income));
    this.sparks += n;
    this.levelSparks += n;
  }

  /**
   * The run is settled once — at the dawn, or when it ends early: the day's gift comes, the sparks
   * reach the purse and the looks, the level reached is where the next run starts, the counters
   * reach the progress.
   */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p, R = RULES;
    if (p.giftDay !== this.init.day) {
      p.giftDay = this.init.day;
      this.dayGiftNow = R.dayGift;
      this.emit({ type: 'dayGift', n: R.dayGift });
    }
    const before = lookOf(p.sparksAll);
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushesBase + this.pushesBegun);
    p.total += this.score;
    p.sparks += this.sparks + this.dayGiftNow;
    p.sparksAll += this.sparks + this.dayGiftNow;
    p.guards += this.guardsBeaten.length;
    p.lambs += this.freed;
    p.dawns += this.dawns;
    p.level = Math.max(p.level, this.level);
    p.top = Math.max(p.top, this.level - 1);
    p.lastLen = this.plannedSec;
    const after = lookOf(p.sparksAll);
    if (after > before) {
      this.lookUp = after;
      this.emit({ type: 'look', look: after });
    }
  }

  /** The session ends before its own dawn: settle as the dawn would. */
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

  /** The panel's gauge: the lamp's reach in a sighted push (0.5 at the ring), calm in a meadow; null when blind or without signal. */
  meter(): number | null {
    if (!this.started || this.phase !== 'play' || !this.reliable) return null;
    const b = this.block;
    if (b.kind === 'rest') return this.calm;
    if (b.kind !== 'push' || b.blind || this.blockT < this.lead) return null;
    return clamp((this.lampR - RULES.lampMin - this.ups.lamp * RULES.lampStep) / RULES.lampExtra);
  }

  /** The pad follows the lamp in a sighted push, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return this.meter();
    return null;
  }

  /** Time is up: stop once the run reached its dawn, or a moment later. */
  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best = { ...p.best, [key]: Math.max(p.best[key] ?? 0, this.score) };
      p.bestCombo = Math.max(p.bestCombo, this.bestCombo);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.level'), t('stat.levelVal', { from: this.levelStart, to: this.level })],
      [t('stat.stars'), String(this.stars)],
      [t('stat.lambs'), String(this.freed)],
      [t('stat.guards'), this.guardsBeaten.length ? this.guardsBeaten.map(guardName).join(', ') : '—'],
      [t('stat.sparks'), fmtNum(this.sparks)],
      [t('stat.doubles'), String(this.doubles)],
      [t('stat.dawns'), String(this.dawns)],
      [t('stat.look'), lookName(lookOf(p.sparksAll))],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: t('unit'), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the run fits, in turn from session to session: the first run,
   * a lamb brought back, a guardian beaten or a fall risen from, a Świt, high places reached with both
   * jumps, a long push with a wide lamp, a passed meadow; else Psalm 139:12.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.first) fit.push('psa23.4');
    if (this.freed > 0) fit.push('luk15.4-6');
    if (this.guardsBeaten.length) fit.push('rom12.21');
    if (this.falls > 0) fit.push('mic7.8');
    if (this.dawns > 0) fit.push('jhn1.5');
    if (this.doubles >= 5 && this.levels > 0) fit.push('hab3.19');
    if (this.maxHold >= RULES.longHold) fit.push('psa119.105');
    if (this.passedRests > 0) fit.push('psa23.1-3');
    fit.push('psa139.12');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.guardsBeaten.length) add(0, t('hl.guards', { list: this.guardsBeaten.map(guardName).join(', ') }));
    if (this.levels) add(1, t('hl.levels', { n: this.levels, stars: this.stars }));
    if (this.lookUp >= 0) add(2, t('hl.look', { name: lookName(this.lookUp) }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(3, t('hl.record', { n: fmtNum(this.score) }));
    else if (this.bestBefore !== null && this.bestBefore - this.score <= 120 && this.score > 0) add(3, t('hl.near', { n: fmtNum(this.bestBefore - this.score) }));
    if (this.freed) add(4, t('hl.lambs', { n: this.freed }));
    if (this.dawns) add(5, t('hl.dawns', { n: this.dawns }));
    if (this.blindShare >= 0) add(6, t('hl.blind', { n: this.blindShare }));
    if (this.dayGiftNow) add(7, t('hl.dayGift', { sparks: sparksText(this.dayGiftNow) }));
    const out = notes.sort((a, b) => a.rank - b.rank).slice(0, 4).map(n => n.text);
    // the story's closing line, in Ćma's words
    out.push(t(this.guardsBeaten.length ? 'close.guard' : this.levels ? 'close.level' : this.started && this.t > 20 ? 'close.walk' : 'close.short'));
    return out;
  }

  /** Stars already won on the level he is on (the score corner shows the best). */
  get levelBestStars(): number { return starsOf(this.p, this.level); }

  /** For the view: the floor's era name. */
  get eraLabel(): string { return eraName(this.era); }
}

/** A moment of the companion (re-exported for the tests). */
export type { Moment };
