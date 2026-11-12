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
 *
 * Version 3 (after the newest Hell Escape) adds, around that core:
 *   companions     up to three run behind him (slots open with the guardians beaten; each one is found
 *                  in a cage of smoke on the road), strike a block he is stopped at with him, and each
 *                  carries a power that fires by itself when charged — Huk, Parasol, Rusztowanie,
 *                  Pauza, Szarża, Zapasy.  In a live push their charge runs faster the higher the
 *                  lamp stands above the threshold (they fight in his light); in the meadow calm fills
 *                  it, and a passed meadow fills it all.
 *   the tower      the second mode: the clock tower's floors, each a trial (a quarry, a bridge of
 *                  falling planks, swinging weights, gates and a giant block, pens, a dark floor, the
 *                  dark rising fast), a keeper every fifth; the clock's hands move toward the dawn.
 *   the road       crumbling bridges, swinging weights, smoke curtains that the light, the powers and
 *                  the Świt break best, a giant block, the companions' cages.
 *   the meta       gear from chests (the guardians', the keepers', every third mission's), provisions
 *                  for three runs, missions, and forms that each bring a perk.
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome } from '../kit/types';
import { Companion, type Moment } from './companion';
import {
  ANSWER, COMPS, ERAS, ERA_SHADOWS, GUARDS, GUARD_ERA, KEEPERS, POWER, SEQ, SHADOWS, TIPS, compName, eraName, eraOfLevel, floorName, gearName, guardLevel,
  guardName, lapOfLevel, lookName, powerOf, tierName,
  type Answer, type BuffId, type CompId, type EraId, type FloorKind, type GearSlot, type GuardId, type HarmKind, type MissionKind, type MoveKind,
  type PowerId, type ShadowKind,
} from './content';
import { sparks as sparksText, t, type Key } from './i18n';
import {
  activeBuffs, applyChest, bestFor, bondLevel, clockTime, compBond, completeMission, gearTier, lenKey, lookOf, missionReward, nightOf, partyFor,
  rollChest, setStars, slotsFor, starsOf, upLevel,
  type ChestDrop, type ChestSource, type DolinaProgress, type GearResult, type Mission, type Mode,
} from './meta';
import { WARM_PLAN, eraOfFloor, floorKind, floorLevel, keeperFloor, stagePlan, towerPlan, type Beat } from './plan';
import { RULES, span } from './rules';

export { RULES } from './rules';
export { WARM_PLAN, stagePlan, type Beat } from './plan';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';
/** How the lamp looks: the steady small flame, live, waiting out the band's delay, grey without signal, the blind fog. */
export type LampLook = 'flame' | 'live' | 'wait' | 'grey' | 'blind';
/** How a shadow left the road. */
export type Via = 'strike' | 'stomp' | 'light' | 'dawn' | 'flash' | 'fade';

/**
 * A stretch of ground: its top (u). The kind is mostly for the painter; a bridge's plank (v3) holds a
 * moment after it is trodden (`crumble` counts from the first step, −1 untouched) and then falls.
 */
export interface Seg {
  x0: number; x1: number; y: number; kind: 'road' | 'ledge' | 'meadow' | 'arena' | 'dawn' | 'bridge';
  crumble?: number; gone?: boolean;
}
/**
 * A stone block (or a pen with a lamb in it): its left edge, base and size, its light (hit points) and
 * what it gives.  Version 3: a companion's cage, a smoke curtain, a giant block.
 */
export interface Stone {
  id: number; x: number; y: number; w: number; h: number; hp: number; max: number;
  stones: number; tall: boolean; pen: boolean; alive: boolean; level: number;
  /** a hit's flash (s left), inside the light now */
  hitT: number; lit: boolean;
  cage?: CompId; barrier?: boolean; giant?: boolean;
}
/** A clock weight swinging over the road from above: its pivot's x, the road under it, its phase (rad), a hit's flash. */
export interface Pend { id: number; x: number; y: number; ph: number; hitT: number }
/** A companion on the run: their bond level, the power's charge (0..1), seconds since it fired, the bond this run, the next assist. */
export interface Mate { id: CompId; lv: number; charge: number; fired: number; bondRun: number; assistCd: number }
/** A step of a built stair. */
export interface Step { x0: number; x1: number; y0: number; top: number; age: number; wall: number }
/** A ledge: the wall at its front, the floor below and above, the stair built at its foot. */
export interface Wall {
  id: number; x: number; y0: number; top: number; level: number; stage: number;
  /** steps wanted to walk up, steps built (and planned), the jump left at the top */
  need: number; built: number; plan: number; buildT: number; started: boolean; passed: boolean;
  /** v3: the Świt (keeper of the dawn's form) raises it whole; Bóbr's wooden steps in it */
  full?: boolean; wood?: number;
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
/** A guardian's arena: in the valley at a level's end (the era's guardian), in the tower every fifth floor (`keeper`). */
export interface Arena { x: number; y: number; level: number; guard: Guard | null; done: boolean; keeper?: GuardId }

/** What the coach mark teaches (the first session) or explains the first time (later sessions). */
export type Teach =
  | 'jump' | 'double' | 'strike' | 'tall' | 'gate' | 'stomp' | 'lamb' | 'stairsJump' | 'stairsDouble' | 'stairsClimb'
  | 'tide' | 'meadow' | 'guard' | 'open' | 'fog' | 'dawn'
  // v3: a cage, a companion joined, a power fired, the tower, a bridge, a weight, a curtain, a chest
  | 'cage' | 'mate' | 'power' | 'tower' | 'bridge' | 'pend' | 'barrier' | 'chest';
/** First-time explanations (once ever, in any session). */
export type Explain = 'tide' | 'meadow' | 'guard' | 'open' | 'fog' | 'dawn' | 'cage' | 'mate' | 'power' | 'tower' | 'bridge' | 'pend' | 'barrier' | 'chest';

export type SimEvent =
  | { type: 'jump'; air: boolean; x: number; y: number }
  | { type: 'land'; x: number; y: number; v: number }
  | { type: 'stomp'; x: number; y: number; what: 'shadow' | 'stone' | 'guard' }
  | { type: 'strike'; x: number; y: number; what: 'stone' | 'shadow' | 'guard'; dmg: number }
  | { type: 'break'; id: number; x: number; y: number; stones: number; tall: boolean; pen: boolean; combo: number; via: StoneVia; what: StoneWhat }
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
  | { type: 'look'; look: number }
  // v3
  /** a companion freed from a cage (and joining the party, or waiting at the camp for a slot) */
  | { type: 'mate'; what: 'join' | 'wait'; id: CompId; x: number; y: number }
  /** a companion's power fired: what it did in numbers (a blow's damage, steps, seconds, stones) */
  | { type: 'power'; id: CompId; power: PowerId; x: number; y: number; n: number }
  /** a companion strikes the block he is stopped at */
  | { type: 'assist'; id: CompId; x: number; y: number; dmg: number; gold: boolean }
  /** the umbrella took a hit */
  | { type: 'shield'; x: number; y: number; left: number }
  | { type: 'mateLevel'; id: CompId; lv: number }
  | { type: 'slot'; n: number }
  /** a tower floor begins (its trial and the clock), is passed, the clock reaches the dawn */
  | { type: 'floor'; floor: number; kind: FloorKind; time: string }
  | { type: 'floorDone'; floor: number; sparks: number; time: string }
  | { type: 'towerDawn'; night: number }
  | { type: 'plank'; x: number; y: number }
  | { type: 'chest'; source: ChestSource; drop: ChestDrop; gear: GearResult | null }
  | { type: 'mission'; m: Mission; sparks: number; chest: boolean }
  /** the first guardian ever beaten: the clock tower opens (the lobby's second mode) */
  | { type: 'towerOpen' }
  /** the first form's stomp shakes the ground; the last form's flap rings out */
  | { type: 'shock'; x: number; y: number; n: number }
  | { type: 'flameRing'; x: number; y: number; n: number };

/** How a block was broken, and what it was. */
export type StoneVia = 'strike' | 'stomp' | 'dawn' | 'mate' | 'light';
export type StoneWhat = 'block' | 'pen' | 'cage' | 'barrier' | 'giant';

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

// ── v3: pure rules of the companions, the gear and the forms ─────
/** A companion's power cooldown (s) at a bond level. */
export const cooldownFor = (id: CompId, lv: number): number => RULES.comp.cd[id] * (1 - RULES.comp.cdLevel * (Math.max(1, lv) - 1));
/** The rate a power charges at: × (1 + above(level)) in a live push (they fight in his light), never less than 1. */
export const chargeRate = (live: boolean, level: number): number => 1 + (live ? above(level) : 0);
/** Huk's blow at a level, in strikes of his power. */
export const hukFor = (lv: number): number => RULES.comp.huk + RULES.comp.hukLevel * (Math.max(1, lv) - 1);
/** The strike gap (s) with the blade's tier, and the Lampiarz's golden rhythm in a live push above the threshold. */
export const strikeGapFor = (bladeTier: number, rhythm: boolean): number =>
  RULES.strikeGap / (1 + RULES.gear.blade * Math.max(0, bladeTier)) * (rhythm ? RULES.form.rhythm : 1);
/** The harm a hit does with the Dzban upgrades, the cloak's tier and the dates (provisions). */
export const harmWith = (kind: HarmKind, oilUps: number, cloakTier: number, dates: boolean): number =>
  harmFor(kind, oilUps) * (1 - RULES.gear.cloak * Math.max(0, cloakTier)) * (dates ? RULES.buff.dates : 1);
/** Where a swinging weight is (centre, u from its pivot's x and the road) at a phase. */
export function pendAt(p: { x: number; y: number; ph: number }): { x: number; y: number } {
  const P = RULES.pend;
  const th = P.swing * Math.sin(p.ph);
  return { x: p.x + P.arm * Math.sin(th), y: p.y + P.low + P.arm * (1 - Math.cos(th)) };
}

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

  // ── v3 ──
  /** the valley's levels or the clock tower's floors; the tower's first run (its story card) */
  readonly mode: Mode;
  readonly towerFirst: boolean;
  /** the tower: the floor he is on, the one the run began on, its trial, floors passed this run, the clock's dawns */
  floor: number;
  readonly floorStart: number;
  floorKind: FloorKind = 'quarry';
  floorsDone = 0;
  towerDawns = 0;
  /** the companions running with him, the slots open, those freed this run (and waiting at the camp) */
  readonly party: Mate[] = [];
  slots: number;
  readonly freedNow: CompId[] = [];
  private cageFor: CompId | null = null;
  /** the umbrella's hits left, slow time left (s), the goat's burst left (s) */
  shieldHits = 0;
  slowT = 0;
  dashT = 0;
  /** powers fired this run, chests opened, missions done, the swinging weights on the road */
  powers = 0;
  readonly chestsNow: { source: ChestSource; drop: ChestDrop; gear: GearResult | null }[] = [];
  readonly missionsNow: Mission[] = [];
  readonly pends: Pend[] = [];
  /** the form's perks (the look), the gear's tiers (a chest may raise one mid-run), the provisions eaten this run */
  readonly form: number;
  readonly gear: Record<GearSlot, number>;
  readonly buffs: ReadonlySet<BuffId>;
  /** the oil's lowest this run (the smoldering wick's closing line) */
  minOil = 1;
  private lastScore = 0;
  bestStair = 0;
  /** stones the tide spilled (Wiewiórka finds them again) */
  private spilled = 0;
  /** the clock tower opened in this run */
  towerOpened = false;

  constructor(private readonly init: SimInit) {
    const p = (this.p = init.progress);
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.restLead = RULES.restLead[band];
    this.finaleSec = finaleFor(init.plannedSec);
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.first = this.session === 1;
    this.look = this.form = lookOf(p.sparksAll);
    this.ups = { stone: upLevel(p, 'stone'), forge: upLevel(p, 'forge'), income: upLevel(p, 'income'), lamp: upLevel(p, 'lamp'), oil: upLevel(p, 'oil') };
    this.gear = { blade: gearTier(p, 'blade'), cloak: gearTier(p, 'cloak'), sandals: gearTier(p, 'sandals'), lamp: gearTier(p, 'lamp') };
    this.buffs = new Set(activeBuffs(p));
    // the lamp's gear lights the Świt sooner
    this.dawnNeed = RULES.dawnHold[band] * (1 - RULES.gear.lamp * this.gear.lamp);
    this.level = this.levelStart = Math.max(1, Math.round(p.level || 1));
    this.mode = p.mode === 'tower' && p.guards >= 1 && !this.first ? 'tower' : 'valley';
    this.towerFirst = this.mode === 'tower' && !p.seen.includes('tower');
    this.floor = this.floorStart = Math.max(1, Math.round(p.tower?.floor || 1));
    this.tier = startTier(this.ups.forge);
    this.pushesBase = p.pushes;
    this.plan = planBlocks(init.plannedSec, this.first, init.rng);
    this.talk = new Companion(init.rng);
    this.slots = slotsFor(p.guards);
    for (const id of partyFor(p, this.slots)) this.party.push(this.mate(id));
    if (this.mode === 'tower') {
      this.floorKind = floorKind(this.floor);
      this.gen = { level: this.floor, stage: 1, i: 0, y: 0, beats: this.withCage(towerPlan(this.floor, this.floorKind, this.rng), this.floor, 1) };
    } else {
      this.gen = { level: this.level, stage: 1, i: 0, y: 0, beats: this.first ? WARM_PLAN.slice() : stagePlan(this.level, 1, this.rng) };
    }
  }

  private mate(id: CompId): Mate {
    return { id, lv: bondLevel(compBond(this.p, id)), charge: 0.35, fired: 9, bondRun: 0, assistCd: 0 };
  }

  /** In the tower: a floor counts as this valley level for the numbers (blocks, ledges, speed). */
  private diff(n: number): number { return this.mode === 'tower' ? floorLevel(n) : n; }
  /** The level the pilgrim's run is scaled by now (the valley's level, or the tower floor's). */
  get difficulty(): number { return this.diff(this.mode === 'tower' ? this.floor : this.level); }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get era(): EraId { return this.mode === 'tower' ? eraOfFloor(this.floor) : ERAS[eraOfLevel(this.level)]; }
  get lap(): number { return this.mode === 'tower' ? nightOf(this.floor) - 1 : lapOfLevel(this.level); }
  get tower(): boolean { return this.mode === 'tower'; }
  /** the clock on the tower's wall ("01:12") */
  get clock(): string { return clockTime(this.floor); }
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
    // the opening story card (the first session, the tower's first run) holds the road quiet
    this.story = this.first || this.towerFirst ? RULES.storySec : 0;
    this.roadX = 0;
    this.segs.push({ x0: -RULES.behind - 20, x1: this.story > 0 ? RULES.warmRun * RULES.storySec + 4 : 9, y: 0, kind: 'road' });
    this.roadX = this.segs[0].x1;
    this.startBlock(0);
    this.talk.clear();
    if (this.first) this.talk.say('first', 2, RULES.storySec + 6);
    else if (this.tower) {
      this.talk.say('tower', 2, 12);
      this.explain('tower');
    } else {
      this.talk.say('open', 2, 12);
      this.talk.say(`era.${this.era}`, 1, 16);
    }
    // a companion of the party greets the road now and then
    if (this.party.length && !this.first) this.talk.say(`m.${this.party[Math.floor(this.rng() * this.party.length) % this.party.length].id}.quip`, 0, 30);
    this.layAhead();
    this.resumeTide();
    this.emit({ type: 'stage', level: this.level, stage: this.stage });
    if (this.tower) this.emit({ type: 'floor', floor: this.floor, kind: this.floorKind, time: this.clock });
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
    this.mission('doubles');
    if (!this.did.has('double')) {
      this.did.add('double');
      if (this.first) this.talk.say('double', 2, 3);
    }
    this.emit({ type: 'jump', air: true, x: this.px, y: this.py });
    // the master of the lamp: the flap rings out — shadows and throws this close dissolve
    if (this.form >= 5) {
      const r = RULES.form.flame;
      let n = 0;
      for (const s of this.shadows) if (s.state === 'walk' && Math.hypot(s.x - this.px, s.y + s.h / 2 - this.py - 0.5) <= r + s.r) n += this.kill(s, 'strike');
      for (const s of this.shots) if (s.alive && Math.abs(s.x + s.w / 2 - this.px) <= r) { this.breakShot(s, 'dawn'); n++; }
      if (n) this.emit({ type: 'flameRing', x: this.px, y: this.py + 0.5, n });
    }
  }

  /**
   * The double jump taken back: a finger's swipe down begins as a press, so the press made the flap a
   * moment before the swipe could be told apart.  The air jump returns and does not count (the doubles,
   * their mission); the stomp follows.  Only within a moment of the flap, in the air.  True when undone.
   */
  undoAirJump(): boolean {
    if (!this.started || this.grounded || this.airUsed <= 0 || this.flapAge > 0.3) return false;
    this.airUsed--;
    this.doubles = Math.max(0, this.doubles - 1);
    this.flapAge = 9;
    const m = this.p.missions.find(x => x.kind === 'doubles');
    if (m && m.have > 0 && m.have < m.goal) m.have--;
    return true;
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
    // Zegarmistrz's Pauza: the valley's shadows, throws, weights, tide and guardian move slow (he does not)
    const ew = w * (this.slowT > 0 ? RULES.comp.slow : 1);
    this.story = Math.max(0, this.story - dt);
    this.brain(dt, w, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.end();
    this.timers(dt, w);
    this.runner(w);
    this.bridges(w);
    this.layAhead();
    this.walkShadows(ew);
    this.moveShots(ew);
    this.pendulums(ew);
    this.staff(w);
    this.mates(dt, w, f);
    this.guardian(ew);
    this.tide(ew);
    this.lambsFollow(w);
    this.stairsBuild(w);
    this.progressMarks();
    this.forget();
    this.watch(dt);
    this.coach();
    this.lookAhead();
    this.talk.update(dt, this.quiet);
    if (this.score > this.lastScore) {
      this.mission('metres', this.score - this.lastScore);
      this.lastScore = this.score;
    }
    if (this.state !== 'fallen') this.minOil = Math.min(this.minOil, this.oil);
  }

  /** the view has a card up: Ćma waits for it (set by the game every frame) */
  hold = false;

  /** Seconds the runner's block banner still stands over the play (a push's or a rest's first seconds), else 0. */
  get bannerLeft(): number {
    const b = this.block;
    return this.phase === 'play' && b && b.kind !== 'warmup' ? Math.max(0, RULES.bannerSec - this.blockT) : 0;
  }

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
    const margin = this.tower && this.floorKind === 'dark' ? 0 : R.fogMargin;
    for (const st of this.stonesOnRoad) {
      st.lit = st.alive && st.x - this.px <= this.lampR + margin;
      // a smoke curtain in the light above the threshold burns away
      if (st.barrier && st.alive && live && st.x - this.px <= this.lampR && above(f.level) > 0) {
        st.hp -= R.barrier.burn * above(f.level) * st.max * w;
        if (st.hp <= 1e-6) this.breakStone(st, 'light');
      }
    }
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
    // the meadow: calm refills the oil and gathers smooth stones from the brook (and the companions rest: calm fills their powers)
    if (play && b.kind === 'rest' && this.blockT >= this.restLead && f.reliable) {
      this.oil = Math.min(1, this.oil + R.oilGain * f.calm * dt);
      this.brookP = Math.min(R.brookMax, this.brookP + R.brookGain * (1 + R.gear.lamp * this.gear.lamp) * f.calm * dt);
      for (const m of this.party) m.charge = Math.min(1, m.charge + R.comp.restCharge * f.calm * dt);
      while (Math.floor(this.brookP) > this.brook) {
        this.brook++;
        this.stones++;
        this.gain(R.brookSparks);
        this.emit({ type: 'brook', n: this.brook });
      }
    }
  }

  /**
   * The Świt: every shadow in sight dissolves, every block bursts into stones, the tide is thrown back;
   * a guardian opens.  Version 3: the companions' powers fill; the keeper of the dawn's form also raises
   * the next stair whole.
   */
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
    for (const m of this.party) m.charge = 1;
    if (this.form >= 3) {
      const wall = this.walls.find(w => !w.passed && w.x > this.px && !w.started);
      if (wall) wall.full = true;
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
      if (b.kind === 'rest') this.mission('rests');
      if (b.kind === 'rest' && verdict) {
        this.passedRests++;
        this.oil = 1;
        this.stones += R.restStones;
        this.gain(R.restBonus);
        // rested companions come back with their powers full
        for (const m of this.party) m.charge = 1;
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
    const k = clamp(0.35 * this.share + 0.08 * Math.min(6, this.diff(g.level) - 1) + 0.12 * (this.stageOf(g) - 1));
    return span(RULES.gap, k) + this.rng() * 1.4;
  }

  /** The stage a generator floor counts as for the weapon it expects: the valley's floor, or a tower floor's place in its band of five. */
  private stageOf(g: GenSnap): number {
    return this.tower ? 1 + 0.8 * ((Math.max(1, g.level) - 1) % RULES.tower.keeperEvery) : g.stage;
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
    const era = this.tower ? eraOfFloor(g.level) : ERAS[eraOfLevel(g.level)];
    const L = this.diff(g.level), st = this.stageOf(g);
    const block = (o: Partial<Stone> & Pick<Stone, 'x' | 'w' | 'h' | 'hp' | 'stones'>): Stone => {
      const s: Stone = { id: id(), y: this.genY, max: o.hp, tall: false, pen: false, alive: true, hitT: 0, lit: false, level: g.level, ...o };
      this.stonesOnRoad.push(s);
      return s;
    };
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
        const hp = pen ? stoneHp(L, st, false, RULES.penStrikes / RULES.strikes[0]) : stoneHp(L, st, tall, 0.85 + this.rng() * 0.3);
        block({ x, w: RULES.blockW * (pen ? 1.25 : 1), h: pen ? 1.25 : RULES.blockH[tall ? 1 : 0], hp, stones: pen ? 0 : stonesFor(tall, this.ups.stone), tall, pen });
        if (pen) this.levelPensLaid(g.level);
        break;
      }
      case 'pair': {
        // a small block, then a tall one on its heels: a step up to jump from
        this.flat(x + RULES.blockW * 2 + 1);
        for (const [dx, tall] of [[0, false], [RULES.blockW, true]] as const) {
          const hp = stoneHp(L, st, tall, 0.85 + this.rng() * 0.3);
          block({ x: x + dx, w: RULES.blockW, h: RULES.blockH[tall ? 1 : 0], hp, stones: stonesFor(tall, this.ups.stone), tall });
        }
        break;
      }
      case 'walker':
      case 'special': {
        const kind = ERA_SHADOWS[era][beat === 'walker' ? 'walker' : 'special'];
        this.flat(x + 1.2);
        this.spawnShadow(kind, x + 0.6, this.genY, L, st);
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
      case 'bridge': {
        // planks over a chasm that fall a moment after they are trodden; one or two are already gone (a jump)
        const B = RULES.bridge;
        const n = Math.max(6, Math.round(span(B.len, this.rng()) / B.plank));
        const gap = B.missing[this.rng() < 0.55 ? 0 : 1];
        const at = 2 + Math.floor(this.rng() * Math.max(1, n - gap - 4));
        for (let i = 0; i < n; i++) {
          if (i >= at && i < at + gap) continue;
          this.segs.push({ x0: x + i * B.plank, x1: x + (i + 1) * B.plank - 0.04, y: this.genY, kind: 'bridge', crumble: -1 });
        }
        this.roadX = x + n * B.plank;
        this.flat(this.roadX + 1.4);
        break;
      }
      case 'pend': {
        // a clock weight swinging over the road from the beam above: jump it when it is low
        this.flat(x + 2.4);
        this.pends.push({ id: id(), x: x + 1.2, y: this.genY, ph: this.rng() * Math.PI * 2, hitT: 0 });
        break;
      }
      case 'giant': {
        // the gallery's reward: a giant block with a big number for the weapon the gates merged
        const G = RULES.giant;
        this.flat(x + G.w + 1.4);
        const hp = Math.max(1, Math.round(G.strikes * powerOf(expectedTier(st)) * RULES.levelHp ** (L - 1)));
        block({ x, w: G.w, h: RULES.blockH[1], hp, stones: G.stones + this.ups.stone, tall: true, giant: true });
        break;
      }
      case 'barrier': {
        // a curtain of smoke across the road: the sword barely bites; powers, the Świt and the light break it, and it pays
        const B = RULES.barrier;
        this.flat(x + B.w + 1.2);
        const hp = Math.max(1, Math.round(B.strikes * powerOf(expectedTier(st)) * RULES.levelHp ** (L - 1)));
        block({ x, w: B.w, h: B.h, hp, stones: B.stones, barrier: true });
        break;
      }
      case 'cage': {
        // a cage of smoke with a companion in it: it stands in the way until it is broken
        const who = COMPS[this.p.found.length];
        if (!who || this.cageFor || this.p.found.includes(who)) break;
        this.flat(x + 1.3 + 1.6);
        const hp = Math.max(1, Math.round(RULES.comp.cageStrikes * powerOf(expectedTier(st)) * RULES.levelHp ** (L - 1)));
        block({ x, w: 1.3, h: 3.2, hp, stones: 0, cage: who });
        this.cageFor = who;
        break;
      }
    }
  }

  /** A floor's plan with the next companion's cage in it when one is due (valley: the second floor of a level; tower: any trial floor). */
  private withCage(beats: Beat[], n: number, stage: number): Beat[] {
    const k = this.p.found.length;
    if (k >= COMPS.length || this.cageFor || beats.includes('cage')) return beats;
    const C = RULES.comp;
    const due = this.tower ? !keeperFloor(n) && n >= C.findFloor[k] : stage === 2 && n >= C.findLevel[k];
    if (due) beats.splice(Math.max(1, beats.length - 1), 0, 'cage');
    return beats;
  }

  private readonly pensLaid = new Map<number, number>();
  private levelPensLaid(level: number, n = 1): void { this.pensLaid.set(level, Math.max(0, (this.pensLaid.get(level) ?? 0) + n)); }

  /** The floor's end: a ledge (with the way out on the third floor), or a guardian's arena — in the tower, a keeper's every fifth floor. */
  private layEnd(): void {
    const g = this.gen, R = RULES;
    const x = this.roadX + this.gapNow();
    this.laid.push({ x, snap: this.snap() });
    if (this.tower && keeperFloor(g.level)) {
      this.flat(x);
      this.flat(x + R.arenaLen + 40, 'arena');
      this.arena = { x: x + 2, y: this.genY, level: g.level, guard: null, done: false, keeper: KEEPERS[(g.level / RULES.tower.keeperEvery - 1) % KEEPERS.length] };
      this.genOn = false;
      this.roadX = x + R.arenaLen;
      this.advanceGen();
      return;
    }
    if (!this.tower && g.stage === 3 && guardLevel(g.level) && !(this.first && g.level === 1)) {
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
    const h = ledgeFor(this.diff(g.level), this.rng());
    const wall: Wall = {
      id: this.nextId++, x: wx, y0: this.genY, top: this.genY + h, level: g.level, stage: g.stage,
      need: stepsFor(h), built: 0, plan: 0, buildT: 0, started: false, passed: false,
    };
    this.walls.push(wall);
    this.genY += h;
    this.flat(wx + 4, 'ledge');
    if (g.stage === 3 && !this.tower) {
      this.exitX = wx + 2.2;
      this.exitY = this.genY;
    }
    this.advanceGen();
  }

  private advanceGen(): void {
    const g = this.gen;
    g.i = 0;
    g.y = this.genY;
    if (this.tower) {
      g.level++;
      g.stage = 1;
      g.beats = this.withCage(towerPlan(g.level, floorKind(g.level), this.rng), g.level, 1);
      return;
    }
    if (g.stage >= 3) {
      g.level++;
      g.stage = 1;
    } else g.stage++;
    g.beats = this.withCage(stagePlan(g.level, g.stage, this.rng), g.level, g.stage);
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
    // a cage beyond the cut steps back with the rest (its companion waits there, laid again later)
    if (this.stonesOnRoad.some(st => st.x >= c && st.cage && st.alive)) this.cageFor = null;
    drop(this.stonesOnRoad, s => s.x < c);
    drop(this.gates, gt => gt.x < c);
    drop(this.posts, p => p.x < c);
    drop(this.shots, s => s.x < c);
    drop(this.pends, p => p.x < c - 2);
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
    this.shock(s.x, s.y, null);
  }

  /** The traveller's form: a stomp's landing shakes the ground — blocks and shadows this close take a blow. */
  private shock(x: number, y: number, skip: Stone | null): void {
    if (this.form < 1) return;
    const R = RULES.form;
    let n = 0;
    const dmg = this.power * R.shockK;
    for (const st of this.stonesOnRoad) {
      if (!st.alive || st === skip || st.cage || Math.abs(st.x + st.w / 2 - x) > R.shockR + st.w / 2 || Math.abs(st.y - y) > 1) continue;
      this.hitStone(st, dmg, 'stomp');
      n++;
    }
    for (const s of this.shadows) {
      if (s.state !== 'walk' || Math.abs(s.x - x) > R.shockR + s.r || Math.abs(s.y - SHADOWS[s.kind].air - y) > 1.2) continue;
      s.stun = Math.max(s.stun, 0.8);
      s.hp -= dmg;
      if (s.hp <= 1e-6) this.kill(s, 'stomp');
      n++;
    }
    if (n) this.emit({ type: 'shock', x, y, n });
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
    if (via === 'stomp') this.mission('stomps');
    this.kills++;
    this.bondAll('kill');
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
    this.slowT = Math.max(0, this.slowT - w);
    this.dashT = Math.max(0, this.dashT - w);
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
    for (const s of this.segs) if (!s.gone && s.x1 >= lo && s.x0 <= hi) out.push({ x0: s.x0, x1: s.x1, y0: -1e9, top: s.y, stone: null });
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
    else target = (R.run + Math.min(R.levelRunMax, R.levelRun * (this.difficulty - 1))) * (1 + R.gear.sandals * this.gear.sandals);
    // Kozica's charge carries him along a moment
    if (this.dashT > 0 && target > R.walk) target *= R.comp.dashK;
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
      const st = boxes.find(b => b.stone && b.top === g && b.x1 > x0 && b.x0 < x1)?.stone ?? null;
      this.shock(this.px, st ? st.y : g, st);
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

  /** Into a pit: Ćma lifts him to the far rim (a little oil) — past a bridge's planks, onto solid ground. */
  private pitFall(): void {
    const solid = (s: Seg) => !s.gone && s.kind !== 'bridge';
    const next = this.segs.filter(s => solid(s) && s.x0 > this.px - 0.5).sort((a, b) => a.x0 - b.x0)[0];
    const prev = this.segs.filter(s => solid(s) && s.x1 <= this.px + 0.5).sort((a, b) => b.x1 - a.x1)[0];
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

  /** Babcia's umbrella takes a hit if it is open: true when it did. */
  private umbrella(x: number, y: number): boolean {
    if (this.shieldHits <= 0) return false;
    this.shieldHits--;
    this.safe = Math.max(this.safe, 0.5);
    this.emit({ type: 'shield', x, y, left: this.shieldHits });
    if (this.rng() < 0.5) this.talk.say('m.babcia.block', 0, 2);
    return true;
  }

  /** Oil lost (never below none); with none he falls. */
  private harm(kind: HarmKind, x: number, y: number, force = false): void {
    if ((this.safe > 0 && !force) || this.state === 'fallen') return;
    if (kind !== 'pit' && this.umbrella(x, y)) return;
    const loss = harmWith(kind, this.ups.oil, this.gear.cloak, this.buffs.has('dates'));
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
    this.strikeCd = strikeGapFor(this.gear.blade, this.form >= 2 && this.live && this.level01 > 0.5);
    this.strikeAge = 0;
    best.hit();
  }

  /** The block standing right in front of him (the one he is stopped at), if any. */
  private frontStone(): Stone | null {
    const front = this.px + RULES.halfW, body0 = this.py, body1 = this.py + RULES.height;
    let best: Stone | null = null;
    for (const st of this.stonesOnRoad) {
      if (!st.alive) continue;
      const d = st.x - front;
      if (d < -0.05 || d > RULES.reach * 0.6 || st.y >= body1 || st.y + st.h <= body0 + 0.05) continue;
      if (!best || st.x < best.x) best = st;
    }
    return best;
  }

  /** A blow on a block.  A smoke curtain takes only a share of the sword's and the companions' plain blows; powers bite in full. */
  private hitStone(st: Stone, dmg: number, via: 'strike' | 'stomp' | 'mate' | 'power'): void {
    if (!st.alive) return;
    if (st.barrier && via !== 'power') dmg *= RULES.barrier.sword;
    st.hp -= dmg;
    st.hitT = 0.12;
    this.stop = Math.max(this.stop, RULES.stopHit);
    if (via !== 'mate') this.emit({ type: 'strike', x: st.x, y: st.y + st.h * 0.5, what: 'stone', dmg: Math.round(dmg) });
    if (st.hp <= 1e-6) this.breakStone(st, via === 'power' ? 'mate' : via);
  }

  /**
   * A block bursts: its stones fly into the pack; a pen frees its lamb; a cage its companion; a smoke
   * curtain pays; a giant block pours its stones.  Returns the stones won.
   */
  private breakStone(st: Stone, via: StoneVia): number {
    if (!st.alive) return 0;
    st.alive = false;
    st.hp = 0;
    this.breaks++;
    if (via !== 'dawn' && via !== 'light') this.bump();
    this.stop = Math.max(this.stop, st.giant || st.cage ? RULES.stopBeaten * 0.5 : RULES.stopBreak);
    let sparks = 1;
    const what: StoneWhat = st.pen ? 'pen' : st.cage ? 'cage' : st.barrier ? 'barrier' : st.giant ? 'giant' : 'block';
    if (st.pen) {
      this.freeLamb(st);
      sparks = RULES.lambSparks;
    } else if (st.cage) {
      this.freeMate(st);
      sparks = RULES.lambSparks * 2;
    } else {
      this.stones += st.stones;
      if (st.barrier) sparks = RULES.barrier.sparks;
      else if (st.giant) sparks = 10;
      this.mission('blocks');
    }
    this.bondAll('break');
    this.gain(sparks * this.mult);
    if (!st.pen && st.stones > 0) this.did.add('strike');
    this.emit({ type: 'break', id: st.id, x: st.x + st.w / 2, y: st.y + st.h / 2, stones: st.stones, tall: st.tall, pen: st.pen, combo: this.combo, via, what });
    return st.stones;
  }

  private freeLamb(st: Stone): void {
    this.freed++;
    this.levelLambs++;
    this.did.add('lamb');
    this.mission('lambs');
    this.bondAll('lamb');
    this.lambs.push({ id: st.id, x: st.x + st.w / 2, y: st.y, vy: 3, hop: this.rng() * 6 });
    if (this.lambs.length > (this.form >= 4 ? RULES.form.flock : RULES.flock)) this.lambs.shift();
    this.emit({ type: 'lamb', n: this.freed, x: st.x + st.w / 2, y: st.y + 0.5 });
    this.talk.say('lamb', 1, 3);
  }

  // ── v3: the companions ──────────────────────────────────────────
  /** A cage breaks: its companion is found for good — into the party when a slot is free, else to the camp (the lobby's pick). */
  private freeMate(st: Stone): void {
    const id = st.cage!;
    this.cageFor = null;
    if (this.p.found.includes(id)) return;
    this.p.found = [...this.p.found, id];
    this.freedNow.push(id);
    const x = st.x + st.w / 2, y = st.y;
    const join = this.party.length < this.slots;
    if (join) this.party.push(this.mate(id));
    this.emit({ type: 'mate', what: join ? 'join' : 'wait', id, x, y });
    this.talk.say(`c.${id}`, 2, 4);
    if (join) this.talk.say(`m.${id}.join`, 2, 8);
    this.explain('mate');
  }

  /** A slot opens (a guardian beaten): companions waiting at the camp join at once. */
  private openSlots(): void {
    const n = slotsFor(this.p.guards + this.guardsBeaten.length);
    if (n <= this.slots) return;
    this.slots = n;
    this.emit({ type: 'slot', n });
    for (const id of this.p.found) {
      if (this.party.length >= this.slots || this.party.some(m => m.id === id)) continue;
      this.party.push(this.mate(id));
      this.emit({ type: 'mate', what: 'join', id, x: this.px - 1, y: this.py });
      this.talk.say(`m.${id}.join`, 1, 8);
    }
  }

  /** Bond for everyone in the party (a break, a kill, a lamb, a level). */
  private bondAll(what: keyof typeof RULES.comp.gain): void {
    if (this.settled) return;
    const n = RULES.comp.gain[what];
    for (const m of this.party) {
      m.bondRun += n;
      this.levelCheck(m);
    }
  }

  /** A companion's bond crossed a level: a stronger power (level 3 changes it). */
  private levelCheck(m: Mate): void {
    const lv = bondLevel(compBond(this.p, m.id) + m.bondRun);
    if (lv <= m.lv) return;
    m.lv = lv;
    this.emit({ type: 'mateLevel', id: m.id, lv });
    this.talk.say(`m.${m.id}.level`, 1, 6);
  }

  /**
   * The companions this frame: their powers charge (× (1 + the lamp above the threshold) in a live
   * push: they fight in his light; not in the meadow, where calm fills them instead), they strike the
   * block he is stopped at with him (gold blows above the threshold), and a charged power fires when
   * it has something to do.
   */
  private mates(dt: number, w: number, f: FocusFrame): void {
    if (!this.party.length || !this.started) return;
    const R = RULES.comp;
    const resting = this.phase === 'play' && this.block.kind === 'rest';
    const still = this.story > 0 || this.state === 'fallen' || resting || this.phase === 'done';
    const rate = still ? 0 : chargeRate(this.live, f.level) * (this.form >= 4 ? RULES.form.lead : 1) * (this.buffs.has('honey') ? RULES.buff.honey : 1);
    const gold = this.live && this.level01 > 0.5;
    const front = this.blocked === 'stone' && w > 0 ? this.frontStone() : null;
    for (const m of this.party) {
      m.fired += dt;
      m.charge = Math.min(1, m.charge + (w * rate) / cooldownFor(m.id, m.lv));
      m.assistCd = Math.max(0, m.assistCd - w);
      if (front && front.alive && m.assistCd <= 0) {
        m.assistCd = R.assistGap * (0.85 + 0.3 * this.rng());
        const dmg = Math.max(1, Math.round(this.power * R.assistK * (1 + R.assistLevel * (m.lv - 1)) * (gold ? R.gold : 1)));
        this.emit({ type: 'assist', id: m.id, x: front.x, y: front.y + Math.min(front.h, 1.2) * 0.6, dmg, gold });
        this.hitStone(front, dmg, 'mate');
      }
      // they rest in the meadow: a charged power waits for the road
      if (m.charge >= 1 && !resting && this.state === 'run' && this.phase !== 'done' && this.story <= 0) this.tryPower(m);
    }
  }

  /** Something ahead the watchmaker would slow: a guardian's fight, a throw, a weight, two shadows, the tide close. */
  private threatAhead(): boolean {
    if (this.fighting) return true;
    if (this.shots.some(s => s.alive && s.x > this.px && s.x - this.px < 7)) return true;
    if (this.pends.some(p => p.x > this.px - 0.5 && p.x - this.px < 5)) return true;
    if (this.shadows.filter(s => s.state === 'walk' && s.x > this.px && s.x - this.px < 7).length >= 2) return true;
    return this.tideOn && Number.isFinite(this.tideX) && this.px - this.tideX < 4;
  }

  /** A charged power fires when it has something to do (else it waits, charged). */
  private tryPower(m: Mate): void {
    const R = RULES.comp, lv3 = m.lv >= 3;
    let n = 0, x = this.px + 1, y = this.py + 0.8;
    switch (POWER[m.id]) {
      case 'huk': {
        // a giant's blow on what stands ahead: an open guardian, else the nearest block, else a shadow
        const dmg = this.power * hukFor(m.lv);
        const g = this.guard;
        const ahead = this.stonesOnRoad.filter(st => st.alive && st.x + st.w > this.px && st.x - this.px < R.hukReach).sort((a, b) => a.x - b.x);
        const shadow = this.shadows.filter(s => s.state === 'walk' && s.x > this.px && s.x - this.px < R.hukReach).sort((a, b) => a.x - b.x)[0];
        if (g && g.state === 'fight' && this.guardOpen) {
          x = this.px + g.rel + 0.6;
          y = this.arena!.y + RULES.weakY;
          this.strikeGuard(g, dmg, 'stomp');
        } else if (ahead.length) {
          x = ahead[0].x + ahead[0].w / 2;
          y = ahead[0].y + Math.min(ahead[0].h, 1.5);
          this.hitStone(ahead[0], dmg, 'power');
          if (lv3 && ahead[1]) this.hitStone(ahead[1], dmg / 2, 'power');
        } else if (shadow) {
          x = shadow.x;
          y = shadow.y + shadow.h / 2;
          shadow.hp -= dmg;
          if (shadow.hp <= 1e-6) this.kill(shadow, 'strike');
        } else return;
        n = Math.round(dmg);
        break;
      }
      case 'parasol': {
        if (this.shieldHits > 0) return;
        this.shieldHits = R.parasol[lv3 ? 1 : 0];
        n = this.shieldHits;
        x = this.px;
        y = this.py + 1.4;
        break;
      }
      case 'rusztowanie':
        // fires at a stair's start (stairsBuild)
        return;
      case 'pauza': {
        if (!this.threatAhead()) return;
        this.slowT = R.pause[lv3 ? 1 : 0];
        n = this.slowT;
        x = this.px;
        y = this.py + 1.2;
        break;
      }
      case 'szarza': {
        const reach = R.charge[lv3 ? 1 : 0];
        const shadows = this.shadows.filter(s => s.state === 'walk' && s.x > this.px - 0.3 && s.x - this.px < reach);
        const tideNear = this.tideOn && Number.isFinite(this.tideX) && this.px - this.tideX < 4;
        if (!shadows.some(s => s.x - this.px < 5) && !tideNear) return;
        for (const s of shadows) n += this.kill(s, 'strike');
        for (const st of this.stonesOnRoad) {
          if (!st.alive || st.pen || st.cage || st.giant || (st.tall && !lv3) || st.x < this.px || st.x - this.px > reach) continue;
          this.hitStone(st, this.power * R.chargeHit, 'power');
        }
        if (this.tideOn && Number.isFinite(this.tideX)) this.tideX = Math.max(this.px - RULES.tideMax, this.tideX - R.chargeTide);
        this.dashT = R.dash;
        x = this.px + reach / 2;
        y = this.py + 0.5;
        break;
      }
      case 'zapasy': {
        const add = R.stash[lv3 ? 1 : 0] + this.spilled;
        this.spilled = 0;
        this.stones += add;
        this.gain(R.stashSparks * this.mult);
        n = add;
        x = this.px - 1;
        y = this.py + 0.4;
        break;
      }
    }
    this.fired(m, x, y, n);
  }

  /** A power went off: the charge empties, bond and missions count it, Ćma or the companion may say something. */
  private fired(m: Mate, x: number, y: number, n: number): void {
    m.charge = 0;
    m.fired = 0;
    this.powers++;
    m.bondRun += RULES.comp.gain.power;
    this.levelCheck(m);
    this.mission('powers');
    this.emit({ type: 'power', id: m.id, power: POWER[m.id], x, y, n });
    if (this.rng() < 0.5) this.talk.say(`m.${m.id}.power`, 0, 2);
    this.explain('power');
  }

  /** Bóbr's Rusztowanie at a stair's start: wooden steps added to what the stones give. */
  private scaffold(wall: Wall): void {
    const m = this.party.find(x => x.id === 'bobr' && x.charge >= 1);
    if (!m || wall.plan >= wall.need) return;
    const add = Math.min(wall.need - wall.plan, RULES.comp.scaffold[m.lv >= 3 ? 1 : 0]);
    wall.plan += add;
    wall.wood = (wall.wood ?? 0) + add;
    this.fired(m, wall.x - 0.6, wall.y0 + wall.plan * RULES.stepH * 0.5, add);
  }

  // ── v3: missions and chests ─────────────────────────────────────
  /** A mission's count (a sum, or the best of a kind for the stairs); done ones pay at once and the next is drawn. */
  private mission(kind: MissionKind, n = 1, best = false): void {
    if (this.settled || !this.started) return;
    const m = this.p.missions.find(x => x.kind === kind);
    if (!m) return;
    m.have = Math.min(m.goal, best ? Math.max(m.have, n) : m.have + n);
    if (m.have < m.goal) return;
    const sparks = missionReward(m);
    this.gain(sparks);
    this.missionsNow.push({ ...m });
    const chest = completeMission(this.p, m);
    this.emit({ type: 'mission', m: { ...m }, sparks, chest });
    this.talk.say('mission', 1, 5);
    if (chest) this.chest('mission');
  }

  /** A chest opens at once: gear (on or merged), a companion's bond, or provisions for three runs. */
  private chest(source: ChestSource): void {
    if (this.settled) return;
    const drop = rollChest(this.p, source, this.rng);
    const gear = applyChest(this.p, drop);
    if (gear && gear.tier > this.gear[gear.slot]) this.gear[gear.slot] = gear.tier;
    if (drop.kind === 'bond') {
      const m = this.party.find(x => x.id === drop.comp);
      if (m) this.levelCheck(m);
    }
    this.chestsNow.push({ source, drop, gear });
    this.emit({ type: 'chest', source, drop, gear });
    this.talk.say('chest', 1, 6);
    this.explain('chest');
  }

  // ── v3: bridges and weights ─────────────────────────────────────
  /** A trodden plank holds a moment, then falls; the one under his feet starts to give. */
  private bridges(w: number): void {
    const B = RULES.bridge;
    for (const s of this.segs) {
      if (s.kind !== 'bridge' || s.gone || s.crumble === undefined || s.crumble < 0) continue;
      s.crumble += w;
      if (s.crumble >= B.fall) {
        s.gone = true;
        this.emit({ type: 'plank', x: (s.x0 + s.x1) / 2, y: s.y });
      }
    }
    if (!this.grounded || this.state !== 'run') return;
    const x0 = this.px - RULES.halfW * 0.7, x1 = this.px + RULES.halfW * 0.7;
    for (const s of this.segs) {
      if (s.kind !== 'bridge' || s.gone || s.x1 <= x0 || s.x0 >= x1 || Math.abs(s.y - this.py) > 0.05) continue;
      if ((s.crumble ?? -1) < 0) s.crumble = 0;
    }
  }

  /** The swinging weights: their phase runs (slow in a Pauza); one that meets him hurts; passing under a near one is a near miss. */
  private pendulums(w: number): void {
    const P = RULES.pend, R = RULES;
    for (const p of this.pends) {
      p.ph += (w * Math.PI * 2) / P.period;
      p.hitT = Math.max(0, p.hitT - w);
      if (this.state !== 'run') continue;
      const c = pendAt(p);
      const bx0 = this.px - R.halfW * 0.8, bx1 = this.px + R.halfW * 0.8, by0 = this.py, by1 = this.py + R.height * 0.95;
      const nx = clamp(c.x, bx0, bx1), ny = clamp(c.y, by0, by1);
      const d = Math.hypot(c.x - nx, c.y - ny);
      if (d < P.r) {
        if (this.safe <= 0 && p.hitT <= 0) {
          p.hitT = 0.5;
          this.harm('pend', c.x, c.y);
        }
      } else if (d < P.r + 0.3 && p.hitT <= 0 && Math.abs(c.x - this.px) < 0.6) {
        p.hitT = 0.6;
        this.emit({ type: 'dodge', near: true, x: this.px, y: this.py });
        this.talk.say('close', 0, 2);
      }
    }
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
        if (wall.full) wall.plan = wall.need;
        else {
          wall.plan = Math.min(this.stones, wall.need);
          this.stones -= wall.plan;
          this.scaffold(wall);
        }
        this.stairs++;
        this.bestStair = Math.max(this.bestStair, wall.plan);
        this.mission('stairs', wall.plan, true);
        const answer = answerFor(wall.top - wall.y0, wall.plan);
        this.emit({ type: 'stairs', wall: wall.id, n: wall.plan, need: wall.need, answer });
        if (answer === 'climb' || wall.plan < wall.need / 3) this.talk.say('short', 1, 3);
        else this.talk.say('stairs', 0, 3);
        const teach: Teach | null = answer === 'jump' ? 'stairsJump' : answer === 'double' ? 'stairsDouble' : answer === 'climb' ? 'stairsClimb' : null;
        if (teach && (this.first || !this.p.seen.includes('stairs'))) this.teach(teach, wall.x - 0.3, wall.y0 + wall.plan * R.stepH + 0.8, `wall${wall.id}`);
      }
      if (wall.started && wall.built < wall.plan) {
        wall.buildT += w;
        // the beaver in the party: the stair goes up faster
        const every = R.stepEvery * (this.party.some(m => m.id === 'bobr') ? R.comp.scaffoldFast : 1);
        while (wall.built < wall.plan && wall.buildT >= every) {
          wall.buildT -= every;
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
        if (this.tower) this.completeFloor(wall.level);
        else if (wall.stage < 3) {
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
      if (g.high) {
        this.mission('gates');
        this.talk.say('gate', 1, 3);
      }
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
    this.bondAll('level');
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

  // ── v3: the tower's floors ──────────────────────────────────────
  /**
   * A tower floor passed (its ledge climbed, or its keeper beaten): sparks, the clock's hands move on,
   * the next floor's trial begins; after a keeper the weapon starts over and the stones left become
   * sparks; at floor 60 the clock reaches the dawn (a great chest) and a new night begins.
   */
  private completeFloor(n: number): void {
    if (n < this.floor) return;
    const T = RULES.tower;
    const sparks = T.floorSparks[0] + T.floorSparks[1] * Math.floor(n / T.keeperEvery);
    this.gain(sparks);
    this.floorsDone++;
    this.mission('floors');
    this.bondAll('level');
    this.floor = n + 1;
    this.floorKind = floorKind(this.floor);
    this.emit({ type: 'floorDone', floor: n, sparks, time: this.clock });
    if (n % T.dawnFloor === 0) {
      this.towerDawns++;
      this.emit({ type: 'towerDawn', night: nightOf(this.floor) });
      this.talk.say('towerDawn', 2, 6);
      this.chest('dawn');
    } else this.talk.say('floor', 0, 5);
    if (keeperFloor(n)) {
      this.tier = startTier(this.ups.forge);
      const left = Math.floor(this.stones * RULES.stoneSparks);
      if (left) this.gain(left);
      this.stones = 0;
    }
    this.emit({ type: 'floor', floor: this.floor, kind: this.floorKind, time: this.clock });
    this.resumeTide();
  }

  // ── the tide of the dark ────────────────────────────────────────
  /** The tide comes back behind him (a new floor, a push block after a meadow) — close behind on the tower's tide floor. */
  private resumeTide(): void {
    if (this.phase !== 'play' || this.block.kind === 'rest' || this.first && this.warmBlock) return;
    this.tideOn = true;
    this.tideX = this.px - (this.tower && this.floorKind === 'tide' ? RULES.tower.tideStart : RULES.tideStart);
    this.tideWarned = false;
  }

  private tide(w: number): void {
    const R = RULES;
    const on = this.tideOn && this.phase === 'play' && this.block.kind !== 'rest' && !this.inArena && this.story <= 0 && !(this.first && this.warmBlock);
    if (!on) return;
    if (!Number.isFinite(this.tideX)) this.tideX = this.px - R.tideStart;
    let v = (R.tideV + R.tideLevel * (this.difficulty - 1)) * (this.tower && this.floorKind === 'tide' ? R.tower.tideFast : 1);
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
    // Babcia's umbrella keeps the dark off: thrown back, nothing spilled, not caught
    if (this.umbrella(this.px - 0.5, this.py + 0.5)) {
      this.tideX = this.px - R.caughtBack;
      return;
    }
    const spilled = Math.ceil(this.stones * R.caughtSpill * (1 - R.gear.cloakSpill * this.gear.cloak));
    this.stones -= spilled;
    this.spilled += spilled;
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
    const id = a.keeper ?? GUARDS[ERAS[eraOfLevel(a.level)]];
    const era = GUARD_ERA[id];
    const T = RULES.tower;
    const hp = a.keeper
      ? Math.max(10, Math.round(T.keeperStrikes * powerOf(this.tier) * (this.plannedSec < 70 ? RULES.guardShort : 1) * (1 + T.keeperNight * (nightOf(a.level) - 1))))
      : guardHpFor(a.level, this.plannedSec, this.tier);
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
    this.gain(a.keeper ? R.tower.keeperSparks * nightOf(a.level) : R.guardSparks * (1 + this.lap));
    this.emit({ type: 'guard', what: 'beaten', id: g.id, era: g.era });
    this.talk.say('beaten', 2, 4);
    this.mission('guards');
    a.done = true;
    // the road goes on beyond the arena
    this.genOn = true;
    this.roadX = Math.max(this.roadX, a.x + R.arenaLen);
    const last = this.segs[this.segs.length - 1];
    if (last && last.kind === 'arena') last.x1 = this.roadX;
    if (a.keeper) this.completeFloor(a.level);
    else {
      this.exitX = a.x + 3;
      this.exitY = a.y;
    }
    // every guardian's chest; a slot may open; the first one ever opens the clock tower
    this.chest(a.keeper ? 'keeper' : 'guard');
    this.openSlots();
    if (!this.tower && this.p.guards + this.guardsBeaten.length === 1) {
      this.towerOpened = true;
      this.emit({ type: 'towerOpen' });
    }
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
    for (let i = this.pends.length - 1; i >= 0; i--) if (this.pends[i].x < cut) this.pends.splice(i, 1);
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
    // the runner holds a coach mark under its block banner: Ćma's quiet counts from when it shows
    this.teachAt = this.t + this.bannerLeft;
    this.emit({ type: 'teach', what, x, y });
  }

  /** A first-time explanation (the guardian, the meadow, the tide, the fog, the Świt; v3: a cage, a companion, a power, the tower, a bridge, a weight, a curtain, a chest): once ever. */
  private explain(what: Explain, at?: { x: number; y: number }): void {
    if (this.p.seen.includes(what)) return;
    // one coach mark at a time: a later frame asks again
    if (this.t - this.teachAt < 2.5) return;
    this.p.seen.push(what);
    // point at the thing: the guardian, the tide behind, the companions behind, else the road ahead
    const g = this.guard;
    const where = at ?? ((what === 'guard' || what === 'open') && g ? { x: this.px + Math.min(g.rel, RULES.guardAt) + 1, y: this.floorY + 3.6 }
      : what === 'tide' ? { x: this.px - 3, y: this.floorY + 2.4 }
        : what === 'mate' || what === 'power' ? { x: this.px - 1.2, y: this.py + 2.2 } : { x: this.px + 3, y: this.floorY + 2.6 });
    this.teach(what, where.x, where.y, `x-${what}`);
  }

  /** Something new on the road ahead, explained the first time it comes (any session). */
  private lookAhead(): void {
    if (this.story > 0 || this.phase !== 'play') return;
    const near = (x: number) => x > this.px + 0.5 && x - this.px < 8;
    for (const st of this.stonesOnRoad) {
      if (!st.alive || !near(st.x)) continue;
      if (st.cage) this.explain('cage', { x: st.x + st.w / 2, y: st.y + st.h + 0.4 });
      else if (st.barrier) this.explain('barrier', { x: st.x + st.w / 2, y: st.y + st.h + 0.4 });
    }
    for (const p of this.pends) if (near(p.x)) this.explain('pend', { x: p.x, y: p.y + 2.6 });
    for (const s of this.segs) if (s.kind === 'bridge' && !s.gone && near(s.x0)) { this.explain('bridge', { x: s.x0 + 1, y: s.y + 1.4 }); break; }
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
    // a companion's quip after a long quiet stretch (the party's banter)
    if (this.party.length && this.talk.quietFor > 22 && !this.fighting) {
      const m = this.party[Math.floor(this.rng() * this.party.length) % this.party.length];
      this.talk.say(`m.${m.id}.quip`, 0, 6);
    }
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
    const n = Math.round(sparks * (1 + RULES.incomeStep * this.ups.income) * (this.buffs.has('raisins') ? RULES.buff.raisins : 1));
    this.sparks += n;
    this.levelSparks += n;
  }

  /**
   * The run is settled once — at the dawn, or when it ends early: the day's gift comes, the sparks
   * reach the purse and the forms, the level reached is where the next run starts, the counters
   * reach the progress; v3: the tower's floor and record, the companions' bond, one run of each
   * provision eaten.
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
    if (this.tower) {
      p.tower = {
        floor: Math.max(p.tower.floor, this.floor), best: Math.max(p.tower.best, this.floor - 1),
        night: Math.max(p.tower.night, nightOf(this.floor) - 1),
      };
    }
    for (const m of this.party) if (m.bondRun > 0) p.bond = { ...p.bond, [m.id]: compBond(p, m.id) + m.bondRun };
    for (const b of this.buffs) p.buffs = { ...p.buffs, [b]: Math.max(0, (p.buffs?.[b] ?? 0) - 1) };
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
      this.tower
        ? [t('stat.floors'), t('stat.floorsVal', { from: this.floorStart, to: this.floor })]
        : [t('stat.level'), t('stat.levelVal', { from: this.levelStart, to: this.level })],
      ...(this.tower ? [] : [[t('stat.stars'), String(this.stars)] as [string, string]]),
      [t('stat.lambs'), String(this.freed)],
      [t('stat.guards'), this.guardsBeaten.length ? this.guardsBeaten.map(guardName).join(', ') : '—'],
      [t('stat.party'), this.party.length ? String(this.party.length) : '—'],
      [t('stat.powers'), String(this.powers)],
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
   * jumps, a long push with a wide lamp, a passed meadow; v3: a companion found (the cloud of
   * witnesses who run with us), tower floors climbed (pressing on toward the upward call), the clock's
   * dawn (out of darkness into His light), a lamp that nearly went out and did not (the smoldering
   * wick); else Psalm 139:12.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.first) fit.push('psa23.4');
    if (this.freedNow.length) fit.push('heb12.1');
    if (this.towerDawns > 0) fit.push('1pe2.9');
    if (this.floorsDone >= 3) fit.push('php3.14');
    if (this.freed > 0) fit.push('luk15.4-6');
    if (this.guardsBeaten.length) fit.push('rom12.21');
    if (this.falls > 0) fit.push('mic7.8');
    else if (this.minOil < 0.2) fit.push('isa42.3');
    if (this.dawns > 0) fit.push('jhn1.5');
    if (this.doubles >= 5 && (this.levels > 0 || this.floorsDone > 0)) fit.push('hab3.19');
    if (this.maxHold >= RULES.longHold) fit.push('psa119.105');
    if (this.passedPushes >= 2 && this.falls === 0) fit.push('jhn8.12');
    if (this.passedRests > 0) fit.push('psa23.1-3');
    fit.push('psa139.12');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    for (const id of this.freedNow) add(0, t('hl.found', { name: compName(id) }));
    if (this.guardsBeaten.length) add(1, t('hl.guards', { list: this.guardsBeaten.map(guardName).join(', ') }));
    if (this.tower && this.floorsDone) add(2, t('hl.floors', { n: this.floorsDone, time: this.clock }));
    if (this.levels) add(2, t('hl.levels', { n: this.levels, stars: this.stars }));
    for (const c of this.chestsNow) add(3, chestLine(c.drop, c.gear));
    if (this.lookUp >= 0) add(3, t('hl.look', { name: lookName(this.lookUp) }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(4, t('hl.record', { n: fmtNum(this.score) }));
    else if (this.bestBefore !== null && this.bestBefore - this.score <= 120 && this.score > 0) add(4, t('hl.near', { n: fmtNum(this.bestBefore - this.score) }));
    if (this.towerOpened) add(2, t('hl.towerOpen'));
    if (this.missionsNow.length) add(5, t('hl.missions', { n: this.missionsNow.length }));
    if (this.freed) add(6, t('hl.lambs', { n: this.freed }));
    if (this.dawns) add(6, t('hl.dawns', { n: this.dawns }));
    if (this.blindShare >= 0) add(7, t('hl.blind', { n: this.blindShare }));
    if (this.dayGiftNow) add(8, t('hl.dayGift', { sparks: sparksText(this.dayGiftNow) }));
    const out = notes.sort((a, b) => a.rank - b.rank).slice(0, 4).map(n => n.text);
    // the story's closing line, in Ćma's words
    out.push(t(this.freedNow.length ? 'close.found' : this.tower && this.floorsDone ? 'close.tower'
      : this.guardsBeaten.length ? 'close.guard' : this.levels ? 'close.level' : this.started && this.t > 20 ? 'close.walk' : 'close.short'));
    return out;
  }

  /** Stars already won on the level he is on (the score corner shows the best). */
  get levelBestStars(): number { return starsOf(this.p, this.level); }

  /** For the view: the floor's era name (in the tower, the floor's trial). */
  get eraLabel(): string { return this.tower ? floorName(this.floorKind) : eraName(this.era); }
}

/** A chest's content in a line ("Skrzynia: Płaszcz · mistrzowski"). */
export function chestLine(d: ChestDrop, g: GearResult | null): string {
  if (d.kind === 'gear') {
    const tier = g ? g.tier : d.tier;
    return g && g.merged ? t('chest.merged', { gear: gearName(d.slot), tier: tierName(tier) })
      : g && g.before >= d.tier ? t('chest.shards', { gear: gearName(d.slot), n: d.tier })
        : t('chest.gear', { gear: gearName(d.slot), tier: tierName(tier) });
  }
  if (d.kind === 'bond') return t('chest.bond', { name: compName(d.comp), n: d.n });
  return t('chest.buff', { name: t(`buff.${d.buff}`), n: d.runs });
}

/** A moment of the companion (re-exported for the tests). */
export type { Moment };
