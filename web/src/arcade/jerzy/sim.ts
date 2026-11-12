/**
 * Jerzy i smok's rules without a screen: a survivors-like on the dragon's lands.  The knight walks
 * an endless field (a joystick: drag anywhere, or WASD); his weapons strike by themselves; the
 * dragon's brood closes in, in growing waves, and dissolves into smoke when beaten, leaving scales;
 * scales fill the level, every level is a choice of one of three cards (a new weapon or gear, a
 * level more, a companion's level — the numbers on the card; Linda may reshuffle them); a weapon at
 * its top with its pair at its top evolves from the next chest or card, two weapons that belong
 * together form a duet; elites leave chests (a level, an evolution or a treasure of the hoard),
 * apples heal.  On Tarcza blocks the land's dragon comes (every other one, once the run is old
 * enough): telegraphed attacks marked on the ground, then a dizzy window to strike — and each dragon
 * has its own **fatal flaw**, a longer, harder-hitting window the player learns to bring about (the
 * Green Dragon chokes on the steam of a breath the shield puts out, the Marsh Dragon sticks in the
 * mud when his dive misses, the Winged Dragon crashes when his swoop misses, the Three-Headed's necks
 * tangle after a round of three, the Ember Dragon collapses when the aura touches him while he
 * cools, the Golden Dragon stops to gobble scales left near him).  At the block's end he flies off
 * for a nap, keeping his wounds.  A land is fought on four roads, each harder.
 *
 * The band is the shield's aura (Ephesians 6:16): in a sighted Tarcza past its lead-in its radius
 * follows the level (the threshold is a dotted ring on it); it beats and throws the brood back, and
 * fire inside it goes out — quenched fire and a held focus charge the Miecz światła, a tap's
 * screen-wide light; a big aura puts out a whole ring of fire.  In a Postój the dragon and the brood
 * nap, calm brings hearts back, and the block's end gives a free card (golden, two levels, after a
 * calm one).  A run ends when the hearts are gone and Linda's apple is spent: a tally (with what each
 * weapon did), and a new run starts; the session's scales stay.
 *
 * No DOM: the view and the sound read the state and the event queue (`take()`).
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  BROOD, BROOD_KINDS, DRAGONS, DUETS, GEAR, GEAR_IDS, LINES, TIPS, TREASURES, TREASURE_ON, WEAPONS, WEAPON_IDS,
  armourName, dragonName, duetName, evoName, flawName, isWeapon, itemName, palName, quiverOf, roadName, townName, treasureName,
  type ArmourId, type BroodKind, type BroodSpec, type CompanionId, type DragonKind, type DragonSpec, type DuetId, type FlawKind,
  type GearId, type ItemId, type Pattern, type TreasureId, type WeaponId,
} from './content';
import { t, unit, scales as scalesText } from './i18n';
import { RULES, span } from './rules';
import {
  affordable, bestFor, clearFight, earnArmour, earnCompanions, fightOf, findTreasure, forgeLevel, hasArmour, hpOf, lenKey, road,
  slots, woundKey, woundsOf, type JerzyProgress,
} from './meta';
import { Talk } from './talk';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';
export type AuraLook = 'base' | 'live' | 'wait' | 'grey' | 'smoke';
export type BossState = 'away' | 'arrive' | 'move' | 'tele' | 'act' | 'flaw' | 'roar' | 'leave';
export type Coach =
  | 'move' | 'scales' | 'choose' | 'aura' | 'quench' | 'sword' | 'rest' | 'boss' | 'evolve' | 'chest'
  | 'reroll' | 'pal' | 'treasure' | 'duet' | 'fatal' | 'ring';

export interface Knight {
  x: number; y: number;
  /** the walk this frame (−1..1 each), the facing (rad) */
  mx: number; my: number; face: number;
  hearts: number; max: number;
  safe: number; down: number; hit: number;
  /** seconds walked, all session (the first coach mark waits for some) */
  walked: number;
}

export interface Creature {
  id: number; kind: BroodKind; spec: BroodSpec;
  x: number; y: number; kx: number; ky: number;
  hp: number; max: number; r: number; speed: number;
  elite: boolean; hit: number; touchT: number; spitT: number;
  /** seconds since it came; `hatch`: it crawled out of a burrow in sight (the view shows the dust) */
  age: number; hatch: boolean;
  /** the last bite of a falcon, of the hedgehog, of the palisade (the session clock) */
  birdT: number; hogT: number; wallT: number;
  /** standing on caltrops this frame */
  slow: boolean;
}

export interface Smoke { id: number; x: number; y: number; r: number; t: number; kind: BroodKind; elite: boolean; dir: number }
export interface Scale { id: number; x: number; y: number; v: number; life: number; pulled: boolean }
export type DropKind = 'apple' | 'gust' | 'chest' | 'bigChest';
export interface Drop { id: number; kind: DropKind; x: number; y: number; t: number; pulled: boolean; src?: 'elite' | 'roar' }
/** a spitter's fireball, or (coin) one of the Golden Dragon's hot coins */
export interface Ball { id: number; x: number; y: number; vx: number; vy: number; r: number; life: number; coin?: boolean }
export interface Flame { id: number; x: number; y: number; vx: number; vy: number; r: number; life: number }
export interface RainDrop { id: number; x: number; y: number; t: number; dur: number }
/** a telegraph on the ground; a ring of fire also has its radius now, its gap's angle and width */
export interface Zone { id: number; kind: 'cone' | 'lane' | 'circle' | 'ring'; x: number; y: number; a: number; len: number; w: number; t: number; dur: number; live: boolean; r?: number; gap?: number; gapW?: number }
export interface Lance { id: number; x: number; y: number; vx: number; vy: number; pierce: number; life: number; hit: number[]; bolt?: boolean }
export interface Splash { id: number; x: number; y: number; r: number; t: number; pool: number }
export interface Horse { id: number; x: number; y: number; dir: 1 | -1; t: number; hit: number[]; dropU: number }
export interface Sweep { a: number; arc: number; r: number; t: number; evo: boolean }
export interface Ring { r: number; t: number; kind: 'horn' | 'pulse' | 'sword' | 'roar' | 'apple' | 'burst' | 'steam' }
export interface Print { x: number; y: number; t: number; above: boolean; phase: 'focus' | 'rest' | 'free'; veiled: boolean; left: boolean }
/** a thrown hammer: out to `max` u and back to the knight */
export interface Hammer { id: number; x: number; y: number; vx: number; vy: number; out: boolean; went: number; max: number; hit: number[]; spin: number; evo: boolean }
export interface Caltrop { id: number; x: number; y: number; r: number; t: number; life: number; tick: number; dmg: number }
/** Bartek's palisade: a log wall from (x − cos a·len/2) to (x + cos a·len/2) */
export interface Wall { id: number; x: number; y: number; a: number; len: number; t: number; life: number; dmg: number }

/** a companion on the field */
export interface Pal {
  id: CompanionId; x: number; y: number; face: number;
  /** its own timers and its angle round the knight */
  t1: number; t2: number; a: number;
  /** what it is doing: following, fetching, gnawing a palisade */
  busy: 'follow' | 'fetch' | 'gnaw';
  tx: number; ty: number;
}

export interface Boss {
  land: number; tier: number; spec: DragonSpec;
  state: BossState; st: number; dur: number;
  x: number; y: number; tx: number; ty: number; face: number; air: number;
  all: number; damage: number;
  pattern: Pattern | null; aim: number; hit: number;
  /** the swoop's path */
  sx0: number; sy0: number; sx1: number; sy1: number;
  /** thirds already roared at; scales owed to the flying bits */
  roared: number; owed: number;
  visits: number;
  /** v3: the dizzy window's multiplier and whether it is his fatal flaw; under the ground (the dive) */
  k: number; fatal: boolean; under: boolean;
  /** attacks still to come in this round; the patterns of this round so far */
  round: number; used: Pattern[];
  /** flames of this breath put out; the dive's or the swoop's miss; seconds he still glows after the ring */
  breathQ: number; missed: boolean; hot: number;
  /** gobbling scales (the Golden Dragon's greed); fed: he has eaten and must attack before he eats again */
  eating: boolean; fed: boolean;
}

export type CardKind = 'new' | 'up' | 'evo' | 'apple' | 'scales' | 'pal' | 'treasure';
export interface Card { kind: CardKind; id: ItemId | null; from: number; to: number; pal?: CompanionId; tr?: TreasureId }
export type ChoiceSource = 'level' | 'rest';
export interface Choice { cards: Card[]; t: number; gold: boolean; source: ChoiceSource }

export interface Run {
  n: number; t: number; scales: number; level: number; xp: number; apples: number;
  /** the run's build: item → level (weapons 1..5, 6 evolved; gear 1..3) */
  items: Partial<Record<ItemId, number>>;
  order: ItemId[];
  driven: number;
  /** v3: the companions along and their levels, the treasures held, reshuffles left, the duets formed */
  pals: Partial<Record<CompanionId, number>>;
  treasures: TreasureId[];
  rerolls: number;
  duets: DuetId[];
  /** damage dealt by each source (a weapon, a companion, the aura's beat, the Miecz, the mirror) */
  dmg: Record<string, number>;
}

export interface Tally {
  t: number; dur: number; run: number; scales: number; time: number; level: number; best: boolean; toBest: number;
  /** the run's three strongest sources, their share of all damage (0..1) */
  top: { src: string; share: number }[];
}
export interface Story { kind: 'open' | 'land'; t: number; dur: number; from: DragonKind; to: DragonKind | null; tier: number; toTier: number; first: boolean }

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'smoke'; share: number }
  | { type: 'finale' }
  | { type: 'done' }
  | { type: 'swing'; weapon: WeaponId; x: number; y: number; a: number }
  | { type: 'hit'; x: number; y: number; dmg: number; boss: boolean; flaw: boolean; crit: boolean }
  | { type: 'gone'; x: number; y: number; kind: BroodKind; elite: boolean }
  | { type: 'scale'; v: number; x: number; y: number }
  | { type: 'level'; level: number }
  | { type: 'choice'; source: ChoiceSource; gold: boolean }
  | { type: 'pick'; card: Card; gold: boolean }
  | { type: 'reroll'; left: number }
  | { type: 'chest'; x: number; y: number; ups: Card[]; big: boolean }
  | { type: 'evolve'; id: WeaponId }
  | { type: 'duet'; id: DuetId; first: boolean }
  | { type: 'treasure'; id: TreasureId; first: boolean; x: number; y: number }
  | { type: 'quench'; x: number; y: number; big: boolean }
  | { type: 'spark'; x0: number; y0: number; x1: number; y1: number; from: 'mirror' | 'iskierka' }
  | { type: 'pulse'; r: number; n: number }
  | { type: 'swordReady' }
  | { type: 'sword'; n: number }
  | { type: 'hurt'; x: number; y: number }
  | { type: 'down' }
  | { type: 'apple'; x: number; y: number; revive: boolean }
  | { type: 'gust' }
  | { type: 'runEnd'; tally: Tally }
  | { type: 'newRun'; n: number }
  | { type: 'wave'; n: number }
  | { type: 'elite'; x: number; y: number }
  | { type: 'boss'; kind: DragonKind; tier: number }
  | { type: 'bossTele'; pattern: Pattern }
  | { type: 'bossAct'; pattern: Pattern }
  | { type: 'flaw' }
  | { type: 'fatal'; kind: DragonKind; flaw: FlawKind; first: boolean }
  | { type: 'ringOut'; x: number; y: number; r: number }
  | { type: 'block'; x: number; y: number }
  | { type: 'roar' }
  | { type: 'nap' }
  | { type: 'driven'; kind: DragonKind; next: DragonKind; tier: number }
  | { type: 'pal'; id: CompanionId; what: 'eat' | 'fetch' | 'wall' | 'bite' | 'roll'; x: number; y: number }
  | { type: 'heal'; v: number }
  | { type: 'coach'; what: Coach; x: number; y: number }
  | { type: 'armour'; id: ArmourId }
  | { type: 'companion'; id: CompanionId };

const NO_EVENTS: readonly SimEvent[] = [];
const TAU = Math.PI * 2;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);
const turn = (a: number, b: number): number => ((((b - a) % TAU) + TAU * 1.5) % TAU) - Math.PI;
/** the patterns that end a round with their own check (a fatal flaw may come of them) */
const CLOSERS: Readonly<Partial<Record<DragonKind, Pattern>>> = { zielony: 'breath', bagienny: 'dive', skrzydlaty: 'swoop', zarowy: 'ring' };

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
 * The session's blocks.  A first-ever session opens with the warm-up (30 s in 5 and 10 min, 20 s in
 * 3, 6 s in a 40 s test); then Tarcza / Postój pairs (26 ± 4 s and 22 ± 3 s, scaled to end on time,
 * jittered only when there is room) ending with a Postój, leaving the last stretch at the end.  No
 * block under 12 s.
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

/** The aura's radius for a level (u): the band can only add to the base. */
export const auraFor = (level: number, base: number = RULES.shieldBase): number => base + clamp(level) * RULES.shieldExtra;

/** Scales to the next level from level L (1-based). */
export const xpNeed = (level: number): number => {
  const k = Math.max(0, level - 1);
  return Math.round(RULES.xpBase + RULES.xpStep * k + RULES.xpSq * k * k);
};

/** The duets two builds form (both weapons held). */
export const duetsOf = (items: Partial<Record<ItemId, number>>): DuetId[] => DUETS.filter(d => (items[d.a] ?? 0) > 0 && (items[d.b] ?? 0) > 0).map(d => d.id);

/** A run's numbers from its gear, its treasures, its duets, the forge and the armoury. */
export interface Stats {
  dmg: number; cd: number; speed: number; pick: number; base: number; pulseDmg: number; armour: number; xp: number; hearts: number;
  /** v3: the weapons' reach and size (×), extra projectiles, the chance of a critical blow */
  area: number; amount: number; crit: number;
}

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: JerzyProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

export class JerzySim {
  readonly p: JerzyProgress;
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
  tally: Tally | null = null;
  choice: Choice | null = null;
  private readonly queued: { source: ChoiceSource; gold: boolean }[] = [];

  // the field
  viewHW: number = RULES.viewHalf[0];
  viewHH: number = RULES.viewHalf[1];
  readonly knight: Knight;
  linda = { x: 0, y: 0, face: 1, walking: 0 };
  readonly brood: Creature[] = [];
  readonly smokes: Smoke[] = [];
  readonly scales: Scale[] = [];
  readonly drops: Drop[] = [];
  readonly balls: Ball[] = [];
  readonly flames: Flame[] = [];
  readonly rain: RainDrop[] = [];
  readonly zones: Zone[] = [];
  readonly lances: Lance[] = [];
  readonly splashes: Splash[] = [];
  readonly horses: Horse[] = [];
  readonly sweeps: Sweep[] = [];
  readonly rings: Ring[] = [];
  readonly prints: Print[] = [];
  readonly hammers: Hammer[] = [];
  readonly caltrops: Caltrop[] = [];
  readonly walls: Wall[] = [];
  readonly pals: Pal[] = [];
  boss: Boss;
  private nextId = 1;
  /** hit-stop (s left) */
  stop = 0;
  /** world time this frame / real time (0 while a card, a choice or a hit-stop holds the world) */
  timeScale = 1;
  /** the joystick (−1..1 each) and the keys held */
  private stick = { x: 0, y: 0 };
  private readonly held = new Set<string>();

  // the band
  reliable = false;
  level = 0;
  calm = 0;
  calmShown = 0;
  /** the aura's radius now (u) and how it looks; the Miecz światła's charge (0..1) and whether it is ready */
  auraR: number = RULES.shieldBase;
  auraLook: AuraLook = 'base';
  charge = 0;
  swordReady = false;
  private readyT = 0;
  private pulseT = 0;
  maxHold = 0;
  private goodT = 0;
  private goodSaid = false;
  private relSec = 0;
  private stepD = 0;
  private stepT = 0;
  private lastPx = 0;
  private lastPy = 0;

  // the run and its timers
  run: Run;
  private spawnAcc = 0;
  private waveT = 0;
  private eliteT = 0;
  private wave = 0;
  private cool: Partial<Record<WeaponId, number>> = {};
  /** the falcons' angle (rad) */
  birdA = 0;
  /** the next sweep goes all round (a horn blast with the Pobudka duet) */
  private fullSweep = false;
  private mirrorT = -1;

  // the session's numbers
  score = 0;
  runs = 0;
  bestRunNow = 0;
  topLevel = 0;
  swords = 0;
  quenched = 0;
  passedRests = 0;
  chestsNow = 0;
  evolved: WeaponId[] = [];
  drivenNow: DragonKind[] = [];
  armourNow: ArmourId[] = [];
  companionsNow: CompanionId[] = [];
  /** v3: fatal flaws found for the first time, treasures found for the first time, duets formed for the first time, roads cleared */
  flawsNow: DragonKind[] = [];
  treasuresNow: TreasureId[] = [];
  duetsNow: DuetId[] = [];
  roadsNow: { kind: DragonKind; tier: number }[] = [];
  fatalsNow = 0;
  /** the highest road fought this session (its treasury bonus) */
  topTier = 0;
  /** damage by source over the whole session, and on the dragons alone */
  readonly sessionDmg: Record<string, number> = {};
  readonly bossDmg: Record<string, number> = {};
  blindShare = -1;
  private settled = false;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  private readonly bestBefore: number | null;
  private readonly bestRunBefore: number;
  private readonly bankBefore: number;

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
    this.bestRunBefore = p.bestRun;
    this.bankBefore = p.bank;
    this.session = p.sessions + 1;
    this.pushesBase = p.pushes;
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng);
    this.talk = new Talk(LINES, init.rng);
    this.knight = { x: 0, y: 0, mx: 0, my: 0, face: -Math.PI / 2, hearts: RULES.hearts, max: RULES.hearts, safe: 0, down: 0, hit: 0, walked: 0 };
    this.linda = { x: -1, y: 0.25, face: 1, walking: 0 };
    const f = fightOf(p);
    this.boss = this.makeBoss(f.land, f.tier, woundsOf(p, f.land, f.tier));
    this.topTier = f.tier;
    this.run = this.freshRun(1);
  }

  // ── views of the state ──────────────────────────────────────────
  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.phase === 'play'; }
  get pushBlock(): boolean { return this.block?.kind === 'push' && this.phase === 'play'; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.phase === 'play'; }
  get warmBlock(): boolean { return this.block?.kind === 'warmup' && this.phase === 'play'; }
  /** a sighted Tarcza past its lead-in: the aura answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get leadIn(): number { return this.lead; }
  /** the world is held (a card, a choice, the tally) */
  get frozen(): boolean { return !!(this.story || this.choice || this.tally); }
  get bossOn(): boolean { return this.boss.state !== 'away'; }
  get bossPresent(): boolean { return ['move', 'tele', 'act', 'flaw', 'roar'].includes(this.boss.state); }
  get dragon(): { kind: DragonKind; land: DragonSpec; tier: number } { return { kind: this.boss.spec.kind, land: this.boss.spec, tier: this.boss.tier }; }
  /** a treasure held in this run */
  has(id: TreasureId): boolean { return this.run.treasures.includes(id); }
  /** a duet formed in this run */
  duet(id: DuetId): boolean { return this.run.duets.includes(id); }
  /** a companion along in this run (its level, 0: not along) */
  palLevel(id: CompanionId): number { return this.run.pals[id] ?? 0; }
  /** the run's numbers, cached until the build changes */
  get stats(): Stats {
    const r = this.run;
    if (!this.statCache || this.statKey.items !== r.items || this.statKey.tr !== r.treasures.length || this.statKey.duets !== r.duets.length) {
      this.statCache = this.computeStats();
      this.statKey = { items: r.items, tr: r.treasures.length, duets: r.duets.length };
    }
    return this.statCache;
  }

  private statCache: Stats | null = null;
  private statKey: { items: unknown; tr: number; duets: number } = { items: null, tr: -1, duets: -1 };

  private computeStats(): Stats {
    const it = this.run.items, p = this.p;
    const g = (id: GearId) => it[id] ?? 0;
    const arm = (id: ArmourId) => (hasArmour(p, id) ? 1 : 0);
    return {
      dmg: (1 + GEAR.sztandar.per * g('sztandar')) * (1 + 0.08 * forgeLevel(p, 'sila')) * (1 + 0.1 * arm('wieniec')),
      cd: 1 - GEAR.rekawice.per * g('rekawice'),
      speed: (1 + GEAR.buty.per * g('buty')) * (1 + 0.05 * forgeLevel(p, 'krok') + 0.08 * arm('ostrogi')),
      pick: (1 + GEAR.sakwa.per * g('sakwa')) * (1 + 0.15 * forgeLevel(p, 'magnes') + 0.2 * arm('pas')) * (this.has('kompas') ? 1.4 : 1),
      base: RULES.shieldBase + GEAR.tarcza.per * g('tarcza') + 0.12 * forgeLevel(p, 'oslona') + 0.2 * arm('slonce'),
      pulseDmg: RULES.pulseDmg + g('tarcza'),
      armour: 1 - GEAR.zbroja.per * g('zbroja'),
      xp: 1 + 0.1 * forgeLevel(p, 'nauka'),
      hearts: RULES.hearts + forgeLevel(p, 'serce') + arm('helm'),
      area: 1 + GEAR.plaszcz.per * g('plaszcz'),
      amount: quiverOf(g('kolczan')),
      crit: RULES.crit + GEAR.pierscien.per * g('pierscien') + 0.05 * arm('karwasz'),
    };
  }
  /** the aura's radius at the threshold (the dotted ring) */
  get auraMark(): number { return auraFor(0.5, this.stats.base); }
  get levelProgress(): number { return clamp(this.run.xp / xpNeed(this.run.level)); }

  private makeBoss(land: number, tier: number, damage: number): Boss {
    const spec = DRAGONS[Math.max(0, Math.min(DRAGONS.length - 1, land))];
    const all = hpOf(spec, tier);
    const dmg = clamp(damage, 0, all - 1);
    return {
      land, tier, spec, state: 'away', st: 0, dur: 0, x: 0, y: -20, tx: 0, ty: 0, face: 0, air: 1, all, damage: dmg,
      pattern: null, aim: 0, hit: 0, sx0: 0, sy0: 0, sx1: 0, sy1: 0, roared: Math.floor((3 * dmg) / all), owed: 0, visits: 0,
      k: 1, fatal: false, under: false, round: 0, used: [], breathQ: 0, missed: false, hot: 0, eating: false, fed: false,
    };
  }

  private freshRun(n: number): Run {
    const items: Partial<Record<ItemId, number>> = { miecz: 1 };
    const order: ItemId[] = ['miecz'];
    if (hasArmour(this.p, 'proporzec')) { items.sztandar = 1; order.push('sztandar'); }
    const pals: Partial<Record<CompanionId, number>> = {};
    const start = Math.min(RULES.palMax, 1 + forgeLevel(this.p, 'druh'));
    for (const id of this.p.party) pals[id as CompanionId] = start;
    this.pals.length = 0;
    for (const id of Object.keys(pals) as CompanionId[]) {
      this.pals.push({ id, x: this.knight.x + 0.8 * (this.pals.length ? -1 : 1), y: this.knight.y + 0.6, face: 1, t1: 0.5, t2: 0.5, a: this.rng() * TAU, busy: 'follow', tx: 0, ty: 0 });
    }
    this.statCache = null;
    return {
      n, t: 0, scales: 0, level: 1, xp: 0, apples: hasArmour(this.p, 'kosz') ? 2 : 1, items, order, driven: 0,
      pals, treasures: [], rerolls: RULES.rerolls + forgeLevel(this.p, 'los'), duets: [], dmg: {},
    };
  }

  // ── input ───────────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.knight.max = this.knight.hearts = this.stats.hearts;
    if (this.session === 1) this.story = { kind: 'open', t: 0, dur: RULES.openSec, from: this.boss.spec.kind, to: null, tier: 0, toTier: 0, first: false };
    this.startBlock(0);
    this.seedBrood();
    this.talk.ask('open', 3, 10);
    if (this.pals.length) {
      this.coach('pal', this.pals[0].x, this.pals[0].y);
      this.talk.ask(`pal_${this.pals[0].id}`, 2, 14);
    }
  }

  /** A run opens with a few chicks hatching around the knight. */
  private seedBrood(): void {
    for (let i = 0; i < RULES.seed; i++) this.spawn('piskle', (i / RULES.seed) * TAU + this.rng(), false, RULES.hatchK);
  }

  /** The view's size in u (the brood comes in from beyond it) and how far up from the knight the runner's HUD begins (u). */
  setView(halfW: number, halfH: number, up = halfH): void {
    if (halfW > 1 && halfH > 1) {
      this.viewHW = halfW;
      this.viewHH = halfH;
      this.viewUp = Math.max(2.5, up);
    }
  }

  /** the room above the knight before the runner's HUD (u): the dragon keeps his body below it */
  private viewUp = 5;
  private bossY(y: number): number { return Math.max(y, this.knight.y - this.viewUp + 2.9); }

  /** The joystick: a direction with a strength (each −1..1, length ≤ 1). */
  steer(x: number, y: number): void {
    const l = Math.hypot(x, y);
    this.stick = l > 1 ? { x: x / l, y: y / l } : { x, y };
  }

  /**
   * A tap (or Space): closes a card that has been read, picks a card in a choice (`card`, or the
   * first), releases a ready Miecz światła.  Anything else: nothing (a tap never hurts).
   */
  tap(card = -1): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= 0.6) this.closeStory();
      return true;
    }
    if (this.tally) {
      if (this.tally.t >= RULES.tallyMin) this.newRun();
      return true;
    }
    if (this.choice) {
      if (this.choice.t >= 0.25) this.pick(card >= 0 ? card : 0);
      return true;
    }
    if (this.swordReady && this.knight.down <= 0) {
      this.releaseSword();
      return true;
    }
    return false;
  }

  /** Arrows and WASD walk, Space and Enter tap, 1–3 pick a card, R reshuffles. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const dirs = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'];
    const kk = k.toLowerCase();
    if (dirs.includes(kk)) {
      if (down) this.held.add(kk); else this.held.delete(kk);
      return true;
    }
    if (!down) return k === ' ' || k === 'Enter';
    if (k === ' ' || k === 'Enter' || k === 'Spacebar') {
      this.tap();
      return true;
    }
    if (this.choice && (k === '1' || k === '2' || k === '3')) {
      this.tap(Number(k) - 1);
      return true;
    }
    if (this.choice && k === 'r') return this.reroll();
    return false;
  }

  /** Let go of everything (pause). */
  release(): void {
    this.held.clear();
    this.stick = { x: 0, y: 0 };
  }

  private closeStory(): void {
    this.story = null;
  }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.stop = Math.max(0, this.stop - dt);
    this.timeScale = this.frozen || this.stop > 0 ? 0 : 1;
    const w = dt * this.timeScale;
    if (this.story) {
      this.story.t += dt;
      if (this.story.t >= this.story.dur) this.closeStory();
    } else if (this.tally) {
      this.tally.t += dt;
      if (this.tally.t >= this.tally.dur) this.newRun();
    } else if (this.choice) {
      this.choice.t += dt;
      if (this.choice.t >= RULES.choiceSec) this.pick(0);
    }
    this.brain(dt, w, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.endFinale();
    // a choice that waited for the block banner opens once it is gone
    if (!this.choice && !this.tally && this.queued.length && !this.bannerUp && this.phase !== 'done') {
      const nx = this.queued.shift()!;
      this.offerChoice(nx.source, nx.gold);
    }
    if (w > 0 && this.phase !== 'done') {
      this.run.t += w;
      this.moveKnight(w);
      this.director(w);
      this.moveBrood(w);
      this.weapons(w);
      this.companions(w);
      this.bossAI(w);
      this.fire(w);
      this.pickups(w);
    }
    this.fx(dt);
    this.quiet = Math.max(0, this.quiet - dt);
    this.talk.update(dt, t, this.talkBlocked);
  }

  get talkBlocked(): boolean {
    const b = this.block;
    const tele = this.phase === 'play' && b && this.blockT >= b.dur - RULES.telegraph;
    return !!(tele || this.bannerUp || this.story || this.tally || this.quiet > 0 || (this.boss.state === 'tele'));
  }

  /** The runner's block banner covers the screen's upper half for the first seconds of a block (Linda and the cards wait). */
  get bannerUp(): boolean {
    return this.phase === 'play' && this.blockT < RULES.bannerSec && this.blockIndex > 0;
  }

  /** seconds Linda keeps quiet: the runner's coach mark is on the field (the index sets it) */
  quiet = 0;

  /** The band's slow quantities: the aura, the Miecz from the hold, hearts from calm; the footprints. */
  private brain(dt: number, w: number, f: FocusFrame): void {
    const R = RULES, b = this.block;
    const play = this.phase === 'play';
    this.reliable = f.reliable;
    this.level = f.reliable ? f.level : 0;
    this.calm = f.reliable ? f.calm : 0;
    this.calmShown = approach(this.calmShown, this.calm, dt, 0.6);
    if (play && f.reliable) this.relSec += dt;
    const base = this.stats.base;
    const live = this.sighted && f.reliable;
    const want = live ? auraFor(f.level, base) : base;
    this.auraR = approach(this.auraR, want, dt, R.shieldTau);
    this.auraLook = !play || b.kind !== 'push' ? 'base' : b.blind ? 'smoke' : this.blockT < this.lead ? 'wait' : f.reliable ? 'live' : 'grey';
    if (live) this.maxHold = Math.max(this.maxHold, f.hold);
    if (live && f.hold >= this.holdNeed) this.addCharge(R.holdRate * (this.has('krzesiwo') ? 1.3 : 1) * dt);
    if (live && f.level >= 0.5) this.goodT += dt;
    else this.goodT = 0;
    if (this.goodT >= R.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 4);
    }
    if (live && this.blockT >= this.lead + 0.5) this.coach('aura', this.knight.x, this.knight.y);
    // the Postój: calm brings hearts back
    if (play && b.kind === 'rest' && this.blockT >= this.restLead && f.reliable && this.knight.down <= 0 && !this.tally) {
      const k = this.knight, before = k.hearts;
      k.hearts = Math.min(k.max, k.hearts + R.heal * f.calm * dt);
      if (Math.floor(k.hearts * 2) > Math.floor(before * 2)) this.emit({ type: 'heal', v: k.hearts });
    }
    // the sword waits for a tap; after a while it goes by itself
    if (this.swordReady && w > 0) {
      this.readyT += w;
      if (this.readyT >= R.swordAuto) this.releaseSword();
    }
    // footprints: the band's history on the ground
    const k = this.knight;
    this.stepD += dist(k.x, k.y, this.lastPx, this.lastPy);
    this.lastPx = k.x;
    this.lastPy = k.y;
    this.stepT += w;
    if (w > 0 && (this.stepD >= R.stepU || this.stepT >= R.stepSec)) {
      this.stepD = 0;
      this.stepT = 0;
      const phase = !play ? 'free' : b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
      const above = f.reliable && (phase === 'rest' ? f.calm >= 0.5 && !f.focused : f.level >= 0.5) && (phase !== 'focus' || this.blockT >= this.lead);
      const side = this.prints.length % 2 === 0;
      const a = k.face + Math.PI / 2;
      this.prints.push({ x: k.x + Math.cos(a) * (side ? 0.12 : -0.12), y: k.y + Math.sin(a) * (side ? 0.12 : -0.12), t: this.t, above, phase, veiled: this.blind, left: side });
    }
    while (this.prints.length && this.t - this.prints[0].t > R.stepKeep) this.prints.shift();
  }

  private addCharge(v: number): void {
    if (this.swordReady || !(v > 0)) return;
    this.charge = Math.min(1, this.charge + v);
    if (this.charge >= 1 - 1e-9) {
      this.charge = 1;
      this.swordReady = true;
      this.readyT = 0;
      this.emit({ type: 'swordReady' });
      this.talk.ask('swordReady', 3, 4);
      this.coach('sword', this.knight.x, this.knight.y - 1);
    }
  }

  /** The Miecz światła: light over the whole screen; the brood dissolves, the dragon loses a bite of scales. */
  releaseSword(): void {
    if (!this.swordReady) return;
    this.swordReady = false;
    this.charge = 0;
    this.readyT = 0;
    this.swords++;
    const k = this.knight, s = this.stats;
    const reach = Math.hypot(this.viewHW, this.viewHH) + 0.5;
    let n = 0;
    for (const c of [...this.brood]) {
      if (dist(c.x, c.y, k.x, k.y) > reach) continue;
      this.damage(c, RULES.swordDmg * s.dmg, k.x, k.y, 4, 'sword');
      n++;
    }
    for (const b of this.balls) this.emit({ type: 'quench', x: b.x, y: b.y, big: false });
    this.balls.length = 0;
    this.flames.length = 0;
    if (this.bossPresent && this.boss.state !== 'roar') {
      const bite = Math.min(RULES.swordBossMax, Math.round(this.boss.all * RULES.swordBoss));
      this.hurtBoss(bite, 'sword', false);
    }
    this.rings.push({ r: reach, t: 0, kind: 'sword' });
    this.stop = Math.max(this.stop, RULES.stopSword);
    this.emit({ type: 'sword', n });
    this.talk.ask('sword', 3, 4);
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
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('rest', this.knight.x, this.knight.y);
    // the Tarcza's peak: as the aura wakes, spitters hatch around the knight — fire for the shield to put out
    if (b.kind === 'push' && this.blockT >= this.lead && this.blockT - dt < this.lead && !this.tally) {
      const a0 = this.rng() * TAU;
      for (let i = 0; i < R.pushSpitters; i++) this.spawn('plujka', a0 + (i * TAU) / R.pushSpitters, false, 0.9);
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
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.goodT = 0;
      this.goodSaid = false;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
      // the land's dragon comes on every other Tarcza of the session (the 2nd, the 4th…)
      if (this.pushesBegun % RULES.bossEvery === 0 && this.t >= RULES.bossFrom && !this.tally) this.bossArrive();
    } else if (b.kind === 'rest') {
      this.talk.ask('rest', 2, 12);
    } else {
      this.talk.ask('warm', 1, 8);
      this.coach('move', this.knight.x, this.knight.y);
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

  /** The block's end: its verdict and what it pays — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0, need = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push') {
        if (this.bossPresent || this.boss.state === 'arrive') this.bossNap();
        if (b.blind) {
          const s = this.judge.measured > 0 ? share : 0;
          this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
          for (const pr of this.prints) pr.veiled = false;
          this.addCharge(s);
          this.emit({ type: 'smoke', share: s });
        }
      } else {
        if (verdict) this.passedRests++;
        // the Postój's gift: a free card (golden after a calm one) — it opens once the next block's banner is gone
        this.queued.push({ source: 'rest', gold: verdict === true });
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  // ── the knight ──────────────────────────────────────────────────
  private moveKnight(w: number): void {
    const k = this.knight;
    k.safe = Math.max(0, k.safe - w);
    k.hit = Math.max(0, k.hit - w);
    if (k.down > 0) {
      k.down -= w;
      if (k.down <= 0) this.getUp();
      return;
    }
    let mx = this.stick.x, my = this.stick.y;
    const h = this.held;
    const kx = (h.has('arrowright') || h.has('d') ? 1 : 0) - (h.has('arrowleft') || h.has('a') ? 1 : 0);
    const ky = (h.has('arrowdown') || h.has('s') ? 1 : 0) - (h.has('arrowup') || h.has('w') ? 1 : 0);
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      mx = kx / l;
      my = ky / l;
    }
    k.mx = mx;
    k.my = my;
    const m = Math.hypot(mx, my);
    if (m > 0.05) {
      const sp = RULES.walk * this.stats.speed;
      k.x += mx * sp * w;
      k.y += my * sp * w;
      k.face = Math.atan2(my, mx);
      k.walked += w;
    }
    // Linda trots after him, a step behind the way he walks (beside him, to his left, when he stands)
    const L = this.linda;
    if (m > 0.05) this.walkDir = Math.atan2(my, mx);
    const lx = m > 0.05 ? k.x - Math.cos(this.walkDir) * 1.2 : k.x - 1.0;
    const ly = m > 0.05 ? k.y - Math.sin(this.walkDir) * 1.2 + 0.2 : k.y + 0.25;
    const d = dist(L.x, L.y, lx, ly);
    L.walking = d > 0.2 ? 1 : 0;
    if (d > 0.05) {
      const sp = Math.min(d, (RULES.walk * 1.1 + d) * w);
      L.x += ((lx - L.x) / d) * sp;
      L.y += ((ly - L.y) / d) * sp;
      if (Math.abs(lx - L.x) > 0.05) L.face = lx > L.x ? 1 : -1;
    }
    if (d > 6) {
      L.x = lx;
      L.y = ly;
    }
  }

  private walkDir = -Math.PI / 2;

  /** The knight loses hearts (unless safe); at none he goes down. */
  private hurt(v: number, x: number, y: number): void {
    const k = this.knight;
    if (k.safe > 0 || k.down > 0 || this.tally || !(v > 0)) return;
    k.hearts = Math.max(0, k.hearts - v * this.stats.armour);
    k.safe = RULES.safe;
    k.hit = 0.25;
    this.emit({ type: 'hurt', x, y });
    if (k.hearts <= 0) {
      k.down = RULES.downSec;
      this.emit({ type: 'down' });
      this.talk.ask(this.run.apples > 0 ? 'down' : 'runEnd', 4, 3);
    } else if (k.hearts <= 1.5) this.talk.ask('near', 1, 3);
  }

  /** Up again: Linda's apple, or the run ends. */
  private getUp(): void {
    const k = this.knight;
    k.down = 0;
    if (this.run.apples > 0) {
      this.run.apples--;
      k.hearts = Math.max(1, k.max * RULES.appleBack);
      k.safe = 2;
      for (const c of this.brood) {
        const d = dist(c.x, c.y, k.x, k.y);
        if (d < RULES.appleClear) {
          const a = Math.atan2(c.y - k.y, c.x - k.x);
          c.kx += Math.cos(a) * RULES.pulsePush * 1.4;
          c.ky += Math.sin(a) * RULES.pulsePush * 1.4;
        }
      }
      this.balls.length = 0;
      this.rings.push({ r: RULES.appleClear, t: 0, kind: 'apple' });
      this.emit({ type: 'apple', x: this.linda.x, y: this.linda.y, revive: true });
      this.talk.ask('apple', 4, 3);
      return;
    }
    this.endRun();
  }

  /** The run's three strongest sources and their shares. */
  topSources(dmg: Record<string, number> = this.run.dmg, n = 3): { src: string; share: number }[] {
    const all = Object.values(dmg).reduce((s, v) => s + v, 0);
    if (!(all > 0)) return [];
    return Object.entries(dmg).sort((a, b) => b[1] - a[1]).slice(0, n).map(([src, v]) => ({ src, share: v / all }));
  }

  /** The run's tally (the world holds); a tap or its time starts a new run. */
  private endRun(): void {
    const r = this.run;
    this.runs++;
    this.bestRunNow = Math.max(this.bestRunNow, r.scales);
    const before = Math.max(this.bestRunBefore, ...this.runScores);
    this.runScores.push(r.scales);
    this.p.bestRun = Math.max(this.p.bestRun, r.scales);
    this.p.bestTime = Math.max(this.p.bestTime, Math.round(r.t));
    this.tally = {
      t: 0, dur: RULES.tallySec, run: r.n, scales: r.scales, time: r.t, level: r.level,
      best: r.scales > before && before > 0, toBest: Math.max(0, before - r.scales), top: this.topSources(),
    };
    this.emit({ type: 'runEnd', tally: this.tally });
  }

  private readonly runScores: number[] = [];

  private newRun(): void {
    if (!this.tally) return;
    this.tally = null;
    this.run = this.freshRun(this.run.n + 1);
    const k = this.knight;
    k.max = k.hearts = this.stats.hearts;
    k.safe = 1.5;
    k.down = 0;
    this.brood.length = 0;
    this.scales.length = 0;
    this.drops.length = 0;
    this.balls.length = 0;
    this.flames.length = 0;
    this.rain.length = 0;
    this.zones.length = 0;
    this.lances.length = 0;
    this.splashes.length = 0;
    this.horses.length = 0;
    this.hammers.length = 0;
    this.caltrops.length = 0;
    this.walls.length = 0;
    this.cool = {};
    this.spawnAcc = 0;
    this.waveT = 0;
    this.eliteT = 0;
    this.wave = 0;
    this.fullSweep = false;
    this.queued.length = 0;
    this.choice = null;
    if (this.bossOn) this.boss.state = 'away';
    this.seedBrood();
    this.emit({ type: 'newRun', n: this.run.n });
    this.talk.ask('newRun', 3, 5);
  }

  // ── the brood ───────────────────────────────────────────────────
  /** the wave's ring: just beyond the nearer edge of sight */
  private get ringR(): number { return Math.min(this.viewHW, this.viewHH) + RULES.spawnOut; }
  /** beyond this a creature is brought round to the other side */
  private get farR(): number { return Math.hypot(this.viewHW, this.viewHH) * RULES.farK; }

  private get mood(): number {
    if (this.warmBlock) return RULES.warmSpawn;
    let m = 1;
    if (this.restBlock) m *= RULES.restSpawn;
    else if (this.pushBlock) m *= RULES.pushSpawn;
    if (this.bossPresent) m *= RULES.bossSpawn;
    return m;
  }

  /** The waves: a steady stream that thickens with the run, a ring closing in every half minute, an elite now and then. */
  private director(w: number): void {
    const R = RULES, rt = this.run.t;
    const rate = Math.min(R.spawnMax, R.spawnBase + R.spawnPerSec * rt) * this.mood;
    this.spawnAcc += rate * w;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.brood.length < R.cap) this.spawnPick(rt);
    }
    if (!this.warmBlock && !this.restBlock) {
      this.waveT += w;
      if (rt >= R.waveFrom && this.waveT >= R.waveSec) {
        this.waveT = 0;
        this.wave++;
        this.ringWave(Math.round(R.waveBase + rt / R.wavePer));
      }
      this.eliteT += w;
      if (rt >= R.eliteFrom && this.eliteT >= R.eliteSec && !this.bossPresent) {
        this.eliteT = 0;
        const kinds = BROOD_KINDS.filter(k => BROOD[k].from <= rt);
        const c = this.spawn(kinds[Math.floor(this.rng() * kinds.length)], this.rng() * TAU, true);
        if (c) {
          this.emit({ type: 'elite', x: c.x, y: c.y });
          this.talk.ask('elite', 2, 4);
        }
      }
    }
  }

  private spawnPick(rt: number): void {
    const kinds = BROOD_KINDS.filter(k => BROOD[k].from <= rt && (!this.warmBlock || k === 'piskle'));
    const ws = kinds.map(k => BROOD[k].weight * (k === 'plujka' && this.pushBlock ? 3.5 : 1));
    let r = this.rng() * ws.reduce((s, v) => s + v, 0);
    let kind = kinds[0];
    for (let i = 0; i < kinds.length; i++) if ((r -= ws[i]) <= 0) { kind = kinds[i]; break; }
    const a = this.rng() * TAU, n = BROOD[kind].pack ?? 1;
    // the first seconds of a run: the brood hatches from burrows within sight, so the sword has work at once
    const ringK = rt < RULES.hatchSec ? RULES.hatchK : 1;
    for (let i = 0; i < n && this.brood.length < RULES.cap; i++) this.spawn(kind, a + (i - n / 2) * 0.08, false, ringK);
  }

  private ringWave(n: number): void {
    const kinds = BROOD_KINDS.filter(k => BROOD[k].from <= this.run.t && k !== 'plujka');
    const kind = kinds[this.wave % kinds.length];
    for (let i = 0; i < n && this.brood.length < RULES.cap + 20; i++) this.spawn(kind, (i / n) * TAU, false, 0.999);
    this.emit({ type: 'wave', n: this.wave });
    if (this.wave % 2 === 1) this.talk.ask('wave', 1, 4);
  }

  /** A creature at angle `a` round the knight, beyond the edge of sight (or nearer, `ringK` < 1, or at a point). */
  private spawn(kind: BroodKind, a: number, elite = false, ringK = 1, at?: { x: number; y: number }): Creature | null {
    const spec = BROOD[kind], k = this.knight, R = RULES;
    const grow = (1 + this.run.t / R.hpGrow) * road(this.boss.tier).brood * (1 + 0.06 * this.boss.land);
    const hp = Math.round(spec.hp * grow * (elite ? R.eliteHp : 1) * 10) / 10;
    // on the edge of sight (a box around the view, one step beyond it), or nearer when they hatch
    const ca = Math.cos(a), sa = Math.sin(a);
    const edge = Math.min((this.viewHW + R.spawnOut) / Math.max(1e-6, Math.abs(ca)), (this.viewHH + R.spawnOut) / Math.max(1e-6, Math.abs(sa)));
    const rr = ringK < 1 ? Math.min(edge, this.ringR) * ringK : edge;
    const c: Creature = {
      id: this.nextId++, kind, spec, x: at ? at.x + ca * 0.5 : k.x + ca * rr, y: at ? at.y + sa * 0.5 : k.y + sa * rr, kx: 0, ky: 0,
      hp, max: hp, r: spec.r * (elite ? R.eliteR : 1), speed: spec.speed * (0.9 + 0.2 * this.rng()) * (elite ? 0.85 : 1),
      elite, hit: 0, touchT: 0, spitT: (spec.spit ?? 3) * (0.5 + this.rng()), birdT: -9, hogT: -9, wallT: -9, slow: false, age: 0, hatch: ringK < 1 || !!at,
    };
    this.brood.push(c);
    return c;
  }

  private moveBrood(w: number): void {
    const k = this.knight, R = RULES;
    const drowsy = this.restBlock ? R.restSlow : 1;
    const far = this.farR;
    const cells = new Map<number, Creature[]>();
    for (const c of this.brood) {
      c.age += w;
      c.hit = Math.max(0, c.hit - w);
      c.touchT = Math.max(0, c.touchT - w);
      const dx = k.x - c.x, dy = k.y - c.y, d = Math.hypot(dx, dy) || 1e-6;
      if (d > far) {
        // too far behind: it comes round from the other side
        const a = Math.atan2(dy, dx) + (this.rng() - 0.5) * 0.8;
        const edge = Math.min((this.viewHW + R.spawnOut) / Math.max(1e-6, Math.abs(Math.cos(a))), (this.viewHH + R.spawnOut) / Math.max(1e-6, Math.abs(Math.sin(a))));
        c.x = k.x + Math.cos(a) * edge;
        c.y = k.y + Math.sin(a) * edge;
        continue;
      }
      let sp = c.speed * drowsy * (c.slow ? R.caltropSlow : 1);
      if (c.spec.keep && d < c.spec.keep) sp = d < c.spec.keep - 0.8 ? -sp * 0.6 : 0;
      if (k.down > 0 || this.tally) sp *= 0.3;
      c.x += (dx / d) * sp * w + c.kx * w;
      c.y += (dy / d) * sp * w + c.ky * w;
      const drag = Math.exp(-R.knockDrag * w);
      c.kx *= drag;
      c.ky *= drag;
      // the spitter spits
      if (c.spec.spit && d < c.spec.keep! + 2.5) {
        c.spitT -= w * drowsy;
        if (c.spitT <= 0) {
          c.spitT = c.spec.spit * (0.8 + 0.4 * this.rng());
          this.balls.push({ id: this.nextId++, x: c.x, y: c.y, vx: (dx / d) * R.ballSpeed, vy: (dy / d) * R.ballSpeed, r: R.ballR, life: R.ballLife });
          if (!this.p.seen.includes('quench') && this.pushBlock) this.coach('quench', c.x, c.y);
        }
      }
      // touching the knight
      if (d < R.knightR + c.r && c.touchT <= 0 && k.down <= 0) {
        c.touchT = R.touchSec;
        this.hurt(R.hurt.touch * (c.elite ? 2 : 1) * (this.has('ogniwo') ? 0.6 : 1), c.x, c.y);
      }
      const key = (Math.floor(c.x) & 0xffff) * 65536 + (Math.floor(c.y) & 0xffff);
      const cell = cells.get(key);
      if (cell) cell.push(c); else cells.set(key, [c]);
    }
    // they push one another apart (no stacks)
    for (const c of this.brood) {
      const cx = Math.floor(c.x), cy = Math.floor(c.y);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const cell = cells.get((((cx + ox) & 0xffff) * 65536) + ((cy + oy) & 0xffff));
        if (!cell) continue;
        for (const o of cell) {
          if (o.id <= c.id) continue;
          const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy), min = (c.r + o.r) * 0.9;
          if (d >= min || d < 1e-6) continue;
          const push = (min - d) * 0.5;
          c.x -= (dx / d) * push;
          c.y -= (dy / d) * push;
          o.x += (dx / d) * push;
          o.y += (dy / d) * push;
        }
      }
    }
    // Bartek's palisades hold them back
    for (const wl of this.walls) {
      const ca = Math.cos(wl.a), sa = Math.sin(wl.a);
      for (const c of [...this.brood]) {
        const rx = c.x - wl.x, ry = c.y - wl.y;
        const along = rx * ca + ry * sa, across = -rx * sa + ry * ca;
        if (Math.abs(along) > wl.len / 2 + c.r || Math.abs(across) > c.r + 0.18) continue;
        const side = across >= 0 ? 1 : -1, need = c.r + 0.18 - Math.abs(across);
        c.x += -sa * side * need;
        c.y += ca * side * need;
        c.kx *= 0.5;
        c.ky *= 0.5;
        if (this.t - c.wallT >= 0.5) {
          c.wallT = this.t;
          this.damage(c, wl.dmg * this.stats.dmg, wl.x, wl.y, 0, 'bobr');
        }
      }
    }
    // the aura beats: the brood inside it is thrown out
    this.pulseT += w;
    if (this.pulseT >= R.pulseSec) {
      this.pulseT = 0;
      const s = this.stats;
      let n = 0;
      const beat = s.pulseDmg * s.dmg * (1 + R.pulseGrow * clamp((this.auraR - s.base) / R.shieldExtra));
      for (const c of [...this.brood]) {
        const d = dist(c.x, c.y, k.x, k.y);
        if (d > this.auraR + c.r) continue;
        const a = Math.atan2(c.y - k.y, c.x - k.x);
        const kb = R.pulsePush * (c.elite ? 0.4 : 1) * (c.kind === 'pancernik' ? 0.5 : 1);
        c.kx += Math.cos(a) * kb;
        c.ky += Math.sin(a) * kb;
        n++;
        this.damage(c, beat, k.x, k.y, 0, 'pulse');
      }
      if (this.bossHittable && dist(this.boss.x, this.boss.y, k.x, k.y) < this.auraR + R.bossR) this.hurtBoss(beat * R.pulseBoss, 'pulse', false);
      this.rings.push({ r: this.auraR, t: 0, kind: 'pulse' });
      this.emit({ type: 'pulse', r: this.auraR, n });
    }
  }

  /** Whether a blow is critical (the ring, the vambraces, the Kuźnia duet for the sword). */
  private critRoll(src: string): boolean {
    const extra = src === 'miecz' && this.duet('kuznia') ? 0.15 : 0;
    return this.rng() < this.stats.crit + extra;
  }

  /** A blow on a creature (knockback away from (fx, fy)); at no hp it dissolves into smoke and leaves a scale. */
  private damage(c: Creature, dmg: number, fx: number, fy: number, kb = 1, src = 'miecz'): void {
    if (!(dmg > 0) || c.hp <= 0) return;
    const crit = src !== 'sword' && src !== 'pulse' && this.critRoll(src);
    const v = dmg * (crit ? RULES.critK : 1);
    const dealt = Math.min(v, c.hp);
    this.run.dmg[src] = (this.run.dmg[src] ?? 0) + dealt;
    this.sessionDmg[src] = (this.sessionDmg[src] ?? 0) + dealt;
    c.hp -= v;
    c.hit = 0.12;
    if (kb > 0) {
      const a = Math.atan2(c.y - fy, c.x - fx);
      const k = RULES.knock * kb * (c.elite ? 0.3 : 1) * (c.kind === 'pancernik' ? 0.4 : 1);
      c.kx += Math.cos(a) * k;
      c.ky += Math.sin(a) * k;
    }
    this.emit({ type: 'hit', x: c.x, y: c.y, dmg: v, boss: false, flaw: false, crit });
    if (c.hp <= 0) this.dissolve(c);
  }

  private dissolve(c: Creature): void {
    const i = this.brood.indexOf(c);
    if (i < 0) return;
    this.brood.splice(i, 1);
    const k = this.knight;
    this.smokes.push({ id: c.id, x: c.x, y: c.y, r: c.r, t: 0, kind: c.kind, elite: c.elite, dir: Math.atan2(c.y - k.y, c.x - k.x) });
    if (this.smokes.length > 60) this.smokes.shift();
    this.emit({ type: 'gone', x: c.x, y: c.y, kind: c.kind, elite: c.elite });
    const v = this.has('mapa') && !c.elite && this.rng() < 0.04 ? 10 : c.spec.xp;
    if (this.scales.length < RULES.scaleCap) this.scales.push({ id: this.nextId++, x: c.x, y: c.y, v, life: RULES.scaleLife, pulled: false });
    else this.collect(v, c.x, c.y);
    if (!this.p.seen.includes('scales')) this.coach('scales', c.x, c.y);
    if (c.elite) {
      this.drops.push({ id: this.nextId++, kind: 'chest', x: c.x, y: c.y, t: 0, pulled: false, src: 'elite' });
      this.stop = Math.max(this.stop, RULES.stopElite);
      this.coach('chest', c.x, c.y);
    } else {
      const r = this.rng(), apple = RULES.appleChance * (this.has('jablon') ? 2 : 1);
      if (r < apple) this.drops.push({ id: this.nextId++, kind: 'apple', x: c.x, y: c.y, t: 0, pulled: false });
      else if (r < apple + RULES.gustChance) this.drops.push({ id: this.nextId++, kind: 'gust', x: c.x, y: c.y, t: 0, pulled: false });
    }
  }

  // ── the weapons (they strike by themselves) ─────────────────────
  /** The nearest target within `range` (u) of (x, y): a creature, or the dragon when he can be struck. */
  private nearest(x: number, y: number, range: number): { x: number; y: number; c: Creature | null; d: number } | null {
    let best: Creature | null = null, bd = range;
    for (const c of this.brood) {
      const d = dist(c.x, c.y, x, y) - c.r;
      if (d < bd) { bd = d; best = c; }
    }
    if (this.bossHittable) {
      const d = dist(this.boss.x, this.boss.y, x, y) - RULES.bossR;
      if (d < bd) return { x: this.boss.x, y: this.boss.y, c: null, d };
    }
    return best ? { x: best.x, y: best.y, c: best, d: bd } : null;
  }

  /** The strongest target within `range` (u): the dragon first, then the creature with the most hp (an elite). */
  private strongest(x: number, y: number, range: number): { x: number; y: number; c: Creature | null } | null {
    if (this.bossHittable && dist(this.boss.x, this.boss.y, x, y) - RULES.bossR < range) return { x: this.boss.x, y: this.boss.y, c: null };
    let best: Creature | null = null;
    for (const c of this.brood) if (dist(c.x, c.y, x, y) - c.r < range && (!best || c.hp > best.hp)) best = c;
    return best ? { x: best.x, y: best.y, c: best } : null;
  }

  get bossHittable(): boolean { return ['move', 'tele', 'act', 'flaw'].includes(this.boss.state) && this.boss.air < 0.5 && !this.boss.under; }

  private lv(id: ItemId): number { return this.run.items[id] ?? 0; }

  /** A weapon's damage now: its level's, the banner and the forge, its treasure and its duets. */
  private weaponDmg(id: WeaponId, base: number): number {
    let d = base * this.stats.dmg;
    if (id === 'miecz' && this.has('oselka')) d += 2;
    if (id === 'sokol' && this.has('pioro')) d += 2;
    if (id === 'kon' && this.duet('turniej')) d *= 1.6;
    if (id === 'kusza' && this.duet('lowy')) d *= 1.25;
    if ((id === 'miecz' || id === 'mlot') && this.duet('kuznia')) d *= 1.1;
    return d;
  }

  private weapons(w: number): void {
    const k = this.knight, s = this.stats;
    if (k.down > 0) return;
    for (const id of WEAPON_IDS) {
      const L = this.lv(id);
      if (!L) continue;
      const spec = WEAPONS[id], i = Math.min(5, L - 1);
      if (id === 'sokol') continue;
      this.cool[id] = (this.cool[id] ?? 0) - w;
      if ((this.cool[id] ?? 0) > 0) continue;
      const dmg = this.weaponDmg(id, spec.dmg[i]);
      let used = false;
      switch (id) {
        case 'miecz': {
          const reach = spec.area[i] * s.area * (this.has('oselka') ? 1.25 : 1);
          const tg = this.nearest(k.x, k.y, reach + 0.3);
          if (!tg) break;
          const a = Math.atan2(tg.y - k.y, tg.x - k.x), half = this.fullSweep ? Math.PI : (spec.n[i] / 10) * Math.PI;
          this.fullSweep = false;
          for (const c of [...this.brood]) {
            const d = dist(c.x, c.y, k.x, k.y);
            if (d - c.r > reach) continue;
            if (Math.abs(turn(a, Math.atan2(c.y - k.y, c.x - k.x))) > half + 0.15) continue;
            this.damage(c, dmg, k.x, k.y, 1, 'miecz');
          }
          if (this.bossHittable && dist(this.boss.x, this.boss.y, k.x, k.y) - RULES.bossR <= reach
            && Math.abs(turn(a, Math.atan2(this.boss.y - k.y, this.boss.x - k.x))) <= half + 0.3) this.hurtBoss(dmg, 'miecz');
          this.sweeps.push({ a, arc: half, r: reach, t: 0, evo: L >= 6 });
          if (!tg.c || Math.abs(Math.cos(a)) > 0.2) k.face = a;
          this.emit({ type: 'swing', weapon: id, x: k.x, y: k.y, a });
          used = true;
          break;
        }
        case 'kopia': {
          const tg = this.nearest(k.x, k.y, 9);
          if (!tg) break;
          const a0 = Math.atan2(tg.y - k.y, tg.x - k.x), n = spec.n[i] + s.amount;
          for (let j = 0; j < n; j++) {
            const a = a0 + (j - (n - 1) / 2) * (L >= 6 ? 0.32 : 0.16);
            this.lances.push({ id: this.nextId++, x: k.x, y: k.y, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, pierce: spec.area[i], life: 1.0, hit: [] });
          }
          this.emit({ type: 'swing', weapon: id, x: k.x, y: k.y, a: a0 });
          used = true;
          break;
        }
        case 'kusza': {
          const tg = this.strongest(k.x, k.y, 8);
          if (!tg) break;
          const a0 = Math.atan2(tg.y - k.y, tg.x - k.x), n = spec.n[i] + s.amount;
          for (let j = 0; j < n; j++) {
            const a = a0 + (j - (n - 1) / 2) * 0.09;
            this.lances.push({ id: this.nextId++, x: k.x, y: k.y, vx: Math.cos(a) * RULES.boltSpeed, vy: Math.sin(a) * RULES.boltSpeed, pierce: spec.area[i], life: RULES.boltLife, hit: [], bolt: true });
          }
          this.emit({ type: 'swing', weapon: id, x: k.x, y: k.y, a: a0 });
          used = true;
          break;
        }
        case 'mlot': {
          const range = spec.area[i] * s.area;
          const tg = this.nearest(k.x, k.y, range);
          if (!tg) break;
          const a0 = Math.atan2(tg.y - k.y, tg.x - k.x), n = spec.n[i] + s.amount;
          for (let j = 0; j < n; j++) {
            const a = a0 + (j - (n - 1) / 2) * 0.55;
            this.hammers.push({ id: this.nextId++, x: k.x, y: k.y, vx: Math.cos(a) * RULES.hammerOut, vy: Math.sin(a) * RULES.hammerOut, out: true, went: 0, max: range, hit: [], spin: 0, evo: L >= 6 });
          }
          this.emit({ type: 'swing', weapon: id, x: k.x, y: k.y, a: a0 });
          used = true;
          break;
        }
        case 'kolce': {
          const n = spec.n[i] + s.amount;
          for (let j = 0; j < n; j++) {
            const a = this.rng() * TAU, r = j === 0 ? 0.15 : 0.35 + this.rng() * 0.55;
            this.dropCaltrop(k.x + Math.cos(a) * r, k.y + Math.sin(a) * r, spec.area[i] * s.area, dmg, L >= 6 ? 2 : 1);
          }
          used = true;
          break;
        }
        case 'wiadra': {
          const near = this.brood.filter(c => dist(c.x, c.y, k.x, k.y) < 6.5);
          if (!near.length && !this.bossHittable) break;
          const r = spec.area[i] * s.area * (this.has('dzban') ? 1.3 : 1);
          for (let j = 0; j < spec.n[i]; j++) {
            const c = near.length ? near[Math.floor(this.rng() * near.length)] : null;
            const x = c ? c.x : this.boss.x, y = c ? c.y : this.boss.y;
            this.splashAt(x, y, r, dmg, L >= 6 ? 3 : this.has('dzban') ? 2 : 0);
          }
          this.emit({ type: 'swing', weapon: id, x: k.x, y: k.y, a: 0 });
          used = true;
          break;
        }
        case 'rog': {
          const r = spec.area[i] * s.area;
          if (!this.brood.some(c => dist(c.x, c.y, k.x, k.y) < r) && !this.bossHittable) break;
          for (const c of [...this.brood]) if (dist(c.x, c.y, k.x, k.y) - c.r < r) this.damage(c, dmg, k.x, k.y, L >= 6 ? 2.2 : 1.6, 'rog');
          if (this.bossHittable && dist(this.boss.x, this.boss.y, k.x, k.y) - RULES.bossR < r) this.hurtBoss(dmg, 'rog');
          if (this.duet('pobudka')) this.fullSweep = true;
          if (this.duet('ulewa')) this.quenchIn(k.x, k.y, r, 'rog');
          this.rings.push({ r, t: 0, kind: 'horn' });
          this.emit({ type: 'swing', weapon: id, x: k.x, y: k.y, a: 0 });
          used = true;
          break;
        }
        case 'kon': {
          if (!this.brood.length && !this.bossHittable) break;
          const n = spec.n[i] + (this.has('podkowa') ? 1 : 0);
          for (let j = 0; j < n; j++) {
            const dir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;
            const y = k.y + (j - (n - 1) / 2) * 1.6 + (this.rng() - 0.5) * 1.2;
            this.horses.push({ id: this.nextId++, x: k.x - dir * (this.viewHW + 2), y, dir, t: 0, hit: [], dropU: 0 });
          }
          this.emit({ type: 'swing', weapon: id, x: k.x, y: k.y, a: 0 });
          used = true;
          break;
        }
      }
      const cd = spec.cd[i] * s.cd * (id === 'kon' && this.has('podkowa') ? 0.8 : 1);
      this.cool[id] = used ? cd : 0.15;
    }
    // the falcons circle and bite
    const Ls = this.lv('sokol');
    if (Ls) {
      const spec = WEAPONS.sokol, i = Math.min(5, Ls - 1);
      this.birdA += (TAU / (spec.cd[i] * s.cd)) * (this.has('pioro') ? 1.3 : 1) * w;
      const n = this.birdCount, r = spec.area[i];
      const dmg = this.weaponDmg('sokol', spec.dmg[i]);
      for (let j = 0; j < n; j++) {
        const a = this.birdA + (j / n) * TAU, bx = k.x + Math.cos(a) * r, by = k.y + Math.sin(a) * r;
        for (const c of [...this.brood]) {
          if (dist(c.x, c.y, bx, by) > c.r + 0.35 || this.t - c.birdT < 0.45) continue;
          c.birdT = this.t;
          this.damage(c, dmg, bx, by, 0.6, 'sokol');
        }
        if (this.bossHittable && dist(this.boss.x, this.boss.y, bx, by) < RULES.bossR + 0.35 && this.t - this.bossBirdT > 0.45) {
          this.bossBirdT = this.t;
          this.hurtBoss(dmg, 'sokol');
        }
      }
    }
    // lances and bolts fly
    for (let j = this.lances.length - 1; j >= 0; j--) {
      const l = this.lances[j];
      l.x += l.vx * w;
      l.y += l.vy * w;
      l.life -= w;
      const src: WeaponId = l.bolt ? 'kusza' : 'kopia';
      const dmg = this.weaponDmg(src, WEAPONS[src].dmg[Math.min(5, Math.max(1, this.lv(src)) - 1)]);
      for (const c of [...this.brood]) {
        if (l.pierce <= 0 || l.hit.includes(c.id) || dist(c.x, c.y, l.x, l.y) > c.r + 0.25) continue;
        l.hit.push(c.id);
        l.pierce--;
        this.damage(c, dmg, l.x - l.vx, l.y - l.vy, l.bolt ? 0.4 : 1, src);
      }
      if (l.pierce > 0 && this.bossHittable && !l.hit.includes(-1) && dist(this.boss.x, this.boss.y, l.x, l.y) < RULES.bossR + 0.2) {
        l.hit.push(-1);
        l.pierce--;
        this.hurtBoss(dmg, src);
      }
      if (l.life <= 0 || l.pierce <= 0) this.lances.splice(j, 1);
    }
    // hammers fly out and back
    for (let j = this.hammers.length - 1; j >= 0; j--) {
      const hm = this.hammers[j];
      hm.spin += w * 16;
      if (hm.out) {
        hm.x += hm.vx * w;
        hm.y += hm.vy * w;
        hm.went += RULES.hammerOut * w;
        if (hm.went >= hm.max) {
          hm.out = false;
          hm.hit.length = 0;
        }
      } else {
        const d = dist(hm.x, hm.y, k.x, k.y);
        if (d < 0.5) { this.hammers.splice(j, 1); continue; }
        const step = Math.min(d, RULES.hammerBack * w);
        hm.x += ((k.x - hm.x) / d) * step;
        hm.y += ((k.y - hm.y) / d) * step;
      }
      const dmg = this.weaponDmg('mlot', WEAPONS.mlot.dmg[Math.min(5, Math.max(1, this.lv('mlot')) - 1)]);
      for (const c of [...this.brood]) {
        if (hm.hit.includes(c.id) || dist(c.x, c.y, hm.x, hm.y) > c.r + (hm.evo ? 0.6 : 0.42)) continue;
        hm.hit.push(c.id);
        this.damage(c, dmg, hm.x, hm.y, 1.2, 'mlot');
      }
      if (this.bossHittable && !hm.hit.includes(-1) && dist(this.boss.x, this.boss.y, hm.x, hm.y) < RULES.bossR + 0.4) {
        hm.hit.push(-1);
        this.hurtBoss(dmg, 'mlot');
      }
    }
    // the white horse gallops through
    for (let j = this.horses.length - 1; j >= 0; j--) {
      const h = this.horses[j], i = Math.min(5, Math.max(1, this.lv('kon')) - 1);
      h.t += w;
      h.x += h.dir * 13 * w;
      h.dropU += 13 * w;
      const half = (WEAPONS.kon.area[i] * s.area) / 2 + 0.2;
      const dmg = this.weaponDmg('kon', WEAPONS.kon.dmg[i]);
      for (const c of [...this.brood]) {
        if (h.hit.includes(c.id) || Math.abs(c.y - h.y) > half + c.r || Math.abs(c.x - h.x) > 0.8) continue;
        h.hit.push(c.id);
        this.damage(c, dmg, h.x - h.dir, c.y, 1.6, 'kon');
      }
      if (this.bossHittable && !h.hit.includes(-1) && Math.abs(this.boss.y - h.y) < half + RULES.bossR && Math.abs(this.boss.x - h.x) < 1) {
        h.hit.push(-1);
        this.hurtBoss(dmg, 'kon');
      }
      if (this.lv('kon') >= 6) for (const sc of this.scales) if (Math.abs(sc.y - h.y) < 1.5 && Math.abs(sc.x - h.x) < 1) sc.pulled = true;
      // the Zasadzka duet: caltrops along the lane, within sight
      if (this.duet('zasadzka') && h.dropU >= 1.3 && Math.abs(h.x - k.x) < this.viewHW) {
        h.dropU = 0;
        const Lc = Math.min(5, Math.max(1, this.lv('kolce')) - 1);
        this.dropCaltrop(h.x, h.y, WEAPONS.kolce.area[Lc] * s.area, this.weaponDmg('kolce', WEAPONS.kolce.dmg[Lc]), 1);
      }
      if (h.t > (2 * this.viewHW + 4) / 13) this.horses.splice(j, 1);
    }
    // the evolved spring's pools
    for (let j = this.splashes.length - 1; j >= 0; j--) {
      const sp = this.splashes[j];
      sp.t += w;
      if (sp.pool > 0 && sp.t < sp.pool && Math.floor(sp.t / 0.5) !== Math.floor((sp.t - w) / 0.5)) {
        const i = Math.min(5, this.lv('wiadra') - 1);
        for (const c of [...this.brood]) if (dist(c.x, c.y, sp.x, sp.y) < sp.r + c.r) this.damage(c, WEAPONS.wiadra.dmg[Math.max(0, i)] * 0.4 * s.dmg, sp.x, sp.y, 0, 'wiadra');
        this.quenchIn(sp.x, sp.y, sp.r, 'wiadra');
      }
      if (sp.t > Math.max(0.6, sp.pool)) this.splashes.splice(j, 1);
    }
    // the caltrops bite and slow
    for (const c of this.brood) c.slow = false;
    for (let j = this.caltrops.length - 1; j >= 0; j--) {
      const ct = this.caltrops[j];
      ct.t += w;
      ct.tick -= w;
      const bite = ct.tick <= 0;
      if (bite) ct.tick = RULES.caltropTick;
      for (const c of [...this.brood]) {
        if (dist(c.x, c.y, ct.x, ct.y) > ct.r + c.r) continue;
        c.slow = true;
        if (bite) this.damage(c, ct.dmg, ct.x, ct.y, 0, 'kolce');
      }
      if (bite && this.bossHittable && dist(this.boss.x, this.boss.y, ct.x, ct.y) < ct.r + RULES.bossR) this.hurtBoss(ct.dmg, 'kolce');
      if (ct.t >= ct.life) this.caltrops.splice(j, 1);
    }
  }

  /** the falcons in the air now: their level's, the quiver's, the Łowy duet's */
  get birdCount(): number {
    const Ls = this.lv('sokol');
    if (!Ls) return 0;
    return WEAPONS.sokol.n[Math.min(5, Ls - 1)] + this.stats.amount + (this.duet('lowy') ? 1 : 0);
  }

  private dropCaltrop(x: number, y: number, r: number, dmg: number, lifeK: number): void {
    if (this.caltrops.length > 60) this.caltrops.shift();
    this.caltrops.push({ id: this.nextId++, x, y, r, t: 0, life: RULES.caltropLife * lifeK, tick: 0.1, dmg });
  }

  private bossBirdT = 0;

  private splashAt(x: number, y: number, r: number, dmg: number, pool: number): void {
    for (const c of [...this.brood]) if (dist(c.x, c.y, x, y) < r + c.r) this.damage(c, dmg, x, y, 0.8, 'wiadra');
    if (this.bossHittable && dist(this.boss.x, this.boss.y, x, y) < r + RULES.bossR) {
      this.hurtBoss(dmg, 'wiadra');
      // water on the Ember Dragon while he glows: he steams and collapses
      if (this.boss.hot > 0) this.fatal();
    }
    this.quenchIn(x, y, r, 'wiadra');
    this.splashes.push({ id: this.nextId++, x, y, r, t: 0, pool });
  }

  /** Water puts out fire too: the squire's buckets (and the Ulewa duet's horn) charge the Miecz światła like the shield. */
  private quenchIn(x: number, y: number, r: number, src: string): void {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (!b || dist(b.x, b.y, x, y) > r + b.r) continue;
      this.balls.splice(i, 1);
      this.quenchOne(b.x, b.y, true, src);
    }
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i];
      if (!f || dist(f.x, f.y, x, y) > r + f.r) continue;
      this.flames.splice(i, 1);
      this.quenchOne(f.x, f.y, false, src);
    }
  }

  /** Fire put out (a fireball `big`, else a flame): the Miecz charges; the breath counts its steam; the mirror throws light. */
  private quenchOne(x: number, y: number, big: boolean, src = 'aura'): void {
    this.quenched++;
    this.addCharge((big ? RULES.quenchBall * (this.has('krzesiwo') ? 1.3 : 1) : RULES.quenchFlame));
    this.emit({ type: 'quench', x, y, big });
    const b = this.boss;
    if (!big && b.state === 'act' && b.pattern === 'breath') b.breathQ++;
    if (big && this.rng() < 0.25) this.talk.ask('quench', 1, 3);
    if (this.has('lustro') && this.t - this.mirrorT >= 0.08) {
      const tg = this.nearest(x, y, RULES.mirrorReach);
      if (tg) {
        this.mirrorT = this.t;
        const d = (big ? RULES.mirrorDmg : RULES.mirrorFlame) * this.stats.dmg;
        if (tg.c) this.damage(tg.c, d, x, y, 0.3, 'mirror');
        else this.hurtBoss(d, 'mirror');
        this.emit({ type: 'spark', x0: x, y0: y, x1: tg.x, y1: tg.y, from: 'mirror' });
      }
    }
    void src;
  }

  // ── fire: the spitters' balls, the hot coins, the breath's flames, the rain, the lanes ──
  private fire(w: number): void {
    const k = this.knight, R = RULES, aura = this.auraR;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (!b) continue;
      b.x += b.vx * w;
      b.y += b.vy * w;
      b.life -= w;
      const d = dist(b.x, b.y, k.x, k.y);
      if (d < aura) {
        this.balls.splice(i, 1);
        this.quenchOne(b.x, b.y, true);
      } else if (d < R.knightR + b.r) {
        this.balls.splice(i, 1);
        this.hurt(b.coin ? R.hurt.coin : R.hurt.ball, b.x, b.y);
      } else if (this.wallStops(b.x, b.y, b.r)) {
        this.balls.splice(i, 1);
        this.emit({ type: 'block', x: b.x, y: b.y });
      } else if (b.life <= 0) {
        this.balls.splice(i, 1);
        // a hot coin that missed cools into a scale where it lies
        if (b.coin && this.scales.length < RULES.scaleCap) this.scales.push({ id: this.nextId++, x: b.x, y: b.y, v: 1, life: RULES.scaleLife, pulled: false });
      }
    }
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i];
      if (!f) continue;
      f.x += f.vx * w;
      f.y += f.vy * w;
      f.life -= w;
      const d = dist(f.x, f.y, k.x, k.y);
      if (d < aura) {
        this.flames.splice(i, 1);
        this.quenchOne(f.x, f.y, false);
      } else if (d < R.knightR + f.r) {
        this.flames.splice(i, 1);
        this.hurt(R.hurt.flame, f.x, f.y);
      } else if (f.life <= 0) this.flames.splice(i, 1);
    }
    for (let i = this.rain.length - 1; i >= 0; i--) {
      const r = this.rain[i];
      if (!r) continue;
      r.t += w;
      if (r.t < r.dur) continue;
      this.rain.splice(i, 1);
      const d = dist(r.x, r.y, k.x, k.y);
      if (d < aura) this.quenchOne(r.x, r.y, true);
      else if (d < R.rainR + R.knightR * 0.5) this.hurt(R.hurt.rain, r.x, r.y);
      else this.emit({ type: 'quench', x: r.x, y: r.y, big: true });
    }
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (!z) continue;
      z.t += w;
      if (z.t >= z.dur) this.zones.splice(i, 1);
    }
    for (let i = this.walls.length - 1; i >= 0; i--) if ((this.walls[i].t += w) >= this.walls[i].life) this.walls.splice(i, 1);
  }

  /** A palisade stops what flies into it. */
  private wallStops(x: number, y: number, r: number): boolean {
    for (const wl of this.walls) {
      const rx = x - wl.x, ry = y - wl.y, ca = Math.cos(wl.a), sa = Math.sin(wl.a);
      if (Math.abs(rx * ca + ry * sa) <= wl.len / 2 && Math.abs(-rx * sa + ry * ca) <= r + 0.15) return true;
    }
    return false;
  }

  // ── pickups ─────────────────────────────────────────────────────
  private pickups(w: number): void {
    const k = this.knight, R = RULES, s = this.stats;
    const pr = R.pickR * s.pick;
    for (let i = this.scales.length - 1; i >= 0; i--) {
      const sc = this.scales[i];
      const d = dist(sc.x, sc.y, k.x, k.y);
      if (d < pr) sc.pulled = true;
      // a scale left lying a while creeps toward him (walking there is quicker)
      if (!sc.pulled && k.down <= 0 && RULES.scaleLife - sc.life > RULES.creepAfter && d > 1e-6) {
        const step = Math.min(d, RULES.creep * w);
        sc.x += ((k.x - sc.x) / d) * step;
        sc.y += ((k.y - sc.y) / d) * step;
      }
      if (sc.pulled && k.down <= 0) {
        const step = Math.min(d, (R.pull + d * 2) * w);
        if (d > 1e-6) {
          sc.x += ((k.x - sc.x) / d) * step;
          sc.y += ((k.y - sc.y) / d) * step;
        }
        if (d - step < R.knightR + 0.15) {
          this.scales.splice(i, 1);
          this.collect(sc.v, sc.x, sc.y);
          continue;
        }
      }
      sc.life -= w;
      if (sc.life <= 0) this.scales.splice(i, 1);
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const dr = this.drops[i];
      dr.t += w;
      const d = dist(dr.x, dr.y, k.x, k.y);
      // a chest left lying slides to the knight after a while (grace; at once with the compass)
      const chest = dr.kind === 'chest' || dr.kind === 'bigChest';
      if (d < pr * 1.1 || (chest && (dr.t > 14 || (this.has('kompas') && dr.t > 0.6)))) dr.pulled = true;
      if (dr.pulled && k.down <= 0) {
        const step = Math.min(d, (R.pull * 0.7 + d) * w);
        if (d > 1e-6) {
          dr.x += ((k.x - dr.x) / d) * step;
          dr.y += ((k.y - dr.y) / d) * step;
        }
        if (d - step < R.knightR + 0.25) {
          this.drops.splice(i, 1);
          this.open(dr);
        }
      } else if (!chest && dr.t > 40) this.drops.splice(i, 1);
    }
  }

  /** A scale: the session's score and the run's experience. */
  private collect(v: number, x: number, y: number): void {
    this.score += v;
    this.run.scales += v;
    this.run.xp += v * this.stats.xp;
    this.emit({ type: 'scale', v, x, y });
    let up = 0;
    while (this.run.xp >= xpNeed(this.run.level)) {
      this.run.xp -= xpNeed(this.run.level);
      this.run.level++;
      up++;
    }
    if (up) {
      this.topLevel = Math.max(this.topLevel, this.run.level);
      for (let i = 0; i < up; i++) this.offerChoice('level', false);
      this.emit({ type: 'level', level: this.run.level });
    }
  }

  private open(dr: Drop): void {
    const k = this.knight;
    if (dr.kind === 'apple') {
      k.hearts = Math.min(k.max, k.hearts + RULES.appleHeal + (this.has('jablon') ? 0.5 : 0));
      this.emit({ type: 'apple', x: dr.x, y: dr.y, revive: false });
      return;
    }
    if (dr.kind === 'gust') {
      for (const s of this.scales) s.pulled = true;
      this.emit({ type: 'gust' });
      return;
    }
    // a chest: a treasure of the hoard, or the evolution when a pair is ready, else levels for what he carries
    this.chestsNow++;
    const big = dr.kind === 'bigChest';
    const ups: Card[] = [];
    if (big) {
      const own = this.lastDriven;
      const tr = own && !this.has(own) ? own : this.drawTreasure();
      if (tr) this.addTreasure(tr, dr.x, dr.y);
    } else {
      const chance = dr.src === 'roar' ? RULES.treasureRoar : RULES.treasureElite;
      const tr = this.run.treasures.length < RULES.treasureMax && this.rng() < chance ? this.drawTreasure() : null;
      if (tr) {
        this.addTreasure(tr, dr.x, dr.y);
        this.emit({ type: 'chest', x: dr.x, y: dr.y, ups: [{ kind: 'treasure', id: null, from: 0, to: 0, tr }], big: false });
        this.talk.ask('treasure', 3, 4);
        return;
      }
    }
    const n = (big ? 2 : 1) + (this.has('mapa') ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const evo = this.evoReady();
      let card: Card | null = evo ? { kind: 'evo', id: evo, from: 5, to: 6 } : null;
      if (!card) {
        const owned = this.run.order.filter(id => this.lv(id) < (isWeapon(id) ? RULES.weaponMax : RULES.gearMax));
        if (owned.length) {
          const id = owned[Math.floor(this.rng() * owned.length)];
          card = { kind: 'up', id, from: this.lv(id), to: this.lv(id) + 1 };
        } else card = { kind: 'apple', id: null, from: 0, to: 0 };
      }
      this.apply(card, false);
      ups.push(card);
    }
    this.emit({ type: 'chest', x: dr.x, y: dr.y, ups, big });
    this.talk.ask(ups.some(c => c.kind === 'evo') ? 'evolve' : 'chest', 3, 4);
  }

  /** the hoard treasure of the dragon last driven off, for its big chest */
  private lastDriven: TreasureId | null = null;

  /** A treasure this run does not hold yet (the ones never found weigh double, so the collection grows); null when all are held. */
  private drawTreasure(): TreasureId | null {
    const pool = TREASURES.filter(id => !this.has(id));
    if (!pool.length) return null;
    const ws = pool.map(id => (this.p.treasures.includes(id) ? 1 : 2));
    let r = this.rng() * ws.reduce((s, v) => s + v, 0);
    for (let i = 0; i < pool.length; i++) if ((r -= ws[i]) <= 0) return pool[i];
    return pool[pool.length - 1];
  }

  private addTreasure(id: TreasureId, x: number, y: number): void {
    if (this.has(id)) return;
    this.run.treasures.push(id);
    this.statCache = null;
    const first = findTreasure(this.p, id);
    if (first) this.treasuresNow.push(id);
    this.emit({ type: 'treasure', id, first, x, y });
    this.coach('treasure', x, y);
  }

  // ── level-ups: one of three cards ───────────────────────────────
  /** A weapon at its top whose pair is at its top (at 2 with the anvil), not yet evolved (the first in the build's order). */
  evoReady(): WeaponId | null {
    const need = this.has('kowadlo') ? 2 : RULES.gearMax;
    for (const id of this.run.order) {
      if (!isWeapon(id)) continue;
      if (this.lv(id) === RULES.weaponMax && this.lv(WEAPONS[id].pair) >= need) return id;
    }
    return null;
  }

  /** Three different cards: the evolution first when one is ready, then levels, new things and the companions' levels; apples and scales fill in. */
  cardsFor(gold: boolean, source: ChoiceSource = 'level'): Card[] {
    const R = RULES, add = gold ? 2 : 1;
    const out: Card[] = [];
    const evo = this.evoReady();
    if (evo) out.push({ kind: 'evo', id: evo, from: 5, to: 6 });
    const weapons = this.run.order.filter(isWeapon).length, gear = this.run.order.length - weapons;
    const pool: { card: Card; w: number }[] = [];
    for (const id of WEAPON_IDS) {
      const L = this.lv(id);
      if (L === 0 && weapons < R.slotsWeapon) pool.push({ card: { kind: 'new', id, from: 0, to: Math.min(R.weaponMax, add) }, w: 1 });
      else if (L > 0 && L < R.weaponMax) pool.push({ card: { kind: 'up', id, from: L, to: Math.min(R.weaponMax, L + add) }, w: 1.4 });
    }
    for (const id of GEAR_IDS) {
      const L = this.lv(id);
      if (L === 0 && gear < R.slotsGear) pool.push({ card: { kind: 'new', id, from: 0, to: Math.min(R.gearMax, add) }, w: 0.8 });
      else if (L > 0 && L < R.gearMax) pool.push({ card: { kind: 'up', id, from: L, to: Math.min(R.gearMax, L + add) }, w: 1.1 });
    }
    for (const id of Object.keys(this.run.pals) as CompanionId[]) {
      const L = this.palLevel(id);
      if (L > 0 && L < R.palMax) pool.push({ card: { kind: 'pal', id: null, pal: id, from: L, to: Math.min(R.palMax, L + add) }, w: 0.9 });
    }
    // a calm Postój's golden choice may hold a treasure of the hoard
    if (source === 'rest' && gold && this.run.treasures.length < R.treasureMax && this.rng() < 0.4) {
      const tr = this.drawTreasure();
      if (tr) out.push({ kind: 'treasure', id: null, from: 0, to: 0, tr });
    }
    while (out.length < 3 && pool.length) {
      let r = this.rng() * pool.reduce((s, p) => s + p.w, 0), j = 0;
      for (; j < pool.length - 1; j++) if ((r -= pool[j].w) <= 0) break;
      out.push(pool.splice(j, 1)[0].card);
    }
    if (out.length < 3) out.push({ kind: 'apple', id: null, from: 0, to: 0 });
    if (out.length < 3) out.push({ kind: 'scales', id: null, from: 0, to: 0 });
    return out.slice(0, 3);
  }

  private offerChoice(source: ChoiceSource, gold: boolean): void {
    if (this.phase === 'done') return;
    // one at a time; and none under the runner's block banner (on a phone it would hide the cards): they wait
    if (this.choice || this.tally || this.bannerUp) {
      if (!this.tally) this.queued.push({ source, gold });
      return;
    }
    this.choice = { cards: this.cardsFor(gold, source), t: 0, gold, source };
    this.emit({ type: 'choice', source, gold });
    this.talk.ask(this.choice.cards[0].kind === 'evo' ? 'evolve' : 'level', 1, 3);
    this.coach(this.choice.cards[0].kind === 'evo' ? 'evolve' : 'choose', this.knight.x, this.knight.y);
    if (this.p.seen.includes('choose') && this.run.rerolls > 0) this.coach('reroll', this.knight.x, this.knight.y);
  }

  /** Linda reshuffles the cards (R, or the button under them): new cards, one reshuffle fewer. */
  reroll(): boolean {
    const ch = this.choice;
    if (!ch || this.run.rerolls <= 0 || ch.t < 0.25) return false;
    const before = ch.cards.map(c => `${c.kind}:${c.id ?? c.pal ?? c.tr ?? ''}`).join('|');
    let cards = this.cardsFor(ch.gold, ch.source);
    for (let i = 0; i < 4 && cards.map(c => `${c.kind}:${c.id ?? c.pal ?? c.tr ?? ''}`).join('|') === before; i++) cards = this.cardsFor(ch.gold, ch.source);
    ch.cards = cards;
    ch.t = 0.25;
    this.run.rerolls--;
    this.emit({ type: 'reroll', left: this.run.rerolls });
    this.talk.ask('reroll', 2, 3);
    return true;
  }

  /** Take card `i` of the choice. */
  pick(i: number): boolean {
    const ch = this.choice;
    if (!ch) return false;
    const card = ch.cards[Math.max(0, Math.min(ch.cards.length - 1, Math.floor(i)))];
    this.choice = null;
    this.apply(card, ch.gold);
    this.emit({ type: 'pick', card, gold: ch.gold });
    const nx = this.queued.shift();
    if (nx) this.offerChoice(nx.source, nx.gold);
    return true;
  }

  private apply(card: Card, gold: boolean): void {
    const k = this.knight;
    this.statCache = null;
    if (card.kind === 'apple') {
      k.hearts = Math.min(k.max, k.hearts + (gold ? 3 : 2));
      return;
    }
    if (card.kind === 'scales') {
      this.collect(gold ? 20 : 10, k.x, k.y);
      return;
    }
    if (card.kind === 'pal' && card.pal) {
      this.run.pals[card.pal] = card.to;
      return;
    }
    if (card.kind === 'treasure' && card.tr) {
      this.addTreasure(card.tr, k.x, k.y);
      this.talk.ask('treasure', 3, 4);
      return;
    }
    const id = card.id!;
    if (!this.run.items[id]) this.run.order.push(id);
    this.run.items[id] = card.to;
    if (card.kind === 'evo' && isWeapon(id)) {
      this.evolved.push(id);
      this.p.evolutions++;
      this.emit({ type: 'evolve', id });
    }
    // a duet: two weapons that belong together
    for (const d of duetsOf(this.run.items)) {
      if (this.run.duets.includes(d)) continue;
      this.run.duets.push(d);
      const first = !this.p.duets.includes(d);
      if (first) {
        this.p.duets.push(d);
        this.duetsNow.push(d);
      }
      this.emit({ type: 'duet', id: d, first });
      this.talk.ask('duet', 3, 4);
      this.coach('duet', k.x, k.y);
    }
  }

  /** What a card would add (the view): the duet it forms, the treasure that works on its weapon. */
  cardNotes(c: Card): { duet: DuetId | null; treasure: TreasureId | null } {
    if (!c.id || !isWeapon(c.id) || c.kind !== 'new') {
      const tr = c.id && isWeapon(c.id) ? (Object.keys(TREASURE_ON) as TreasureId[]).find(t => TREASURE_ON[t] === c.id && this.has(t)) ?? null : null;
      return { duet: null, treasure: tr };
    }
    const items = { ...this.run.items, [c.id]: 1 };
    const duet = duetsOf(items).find(d => !this.run.duets.includes(d)) ?? null;
    const tr = (Object.keys(TREASURE_ON) as TreasureId[]).find(t => TREASURE_ON[t] === c.id && this.has(t)) ?? null;
    return { duet, treasure: tr };
  }

  // ── the companions ──────────────────────────────────────────────
  private companions(w: number): void {
    const k = this.knight;
    if (!this.pals.length) return;
    for (const pl of this.pals) {
      const L = this.palLevel(pl.id);
      if (!L) continue;
      pl.t1 -= w;
      pl.t2 -= w;
      switch (pl.id) {
        case 'pies': this.dog(pl, L, w); break;
        case 'iskierka': this.hatchling(pl, L, w); break;
        case 'jez': this.hedgehog(pl, L, w); break;
        case 'bobr': this.beaver(pl, L, w); break;
      }
      // never lost: far behind, he comes back at a run
      if (dist(pl.x, pl.y, k.x, k.y) > 9) {
        pl.x = k.x - 0.8;
        pl.y = k.y + 0.6;
      }
    }
  }

  private moveTo(pl: Pal, x: number, y: number, speed: number, w: number): number {
    const d = dist(pl.x, pl.y, x, y);
    if (d > 1e-3) {
      const s = Math.min(d, speed * w);
      pl.x += ((x - pl.x) / d) * s;
      pl.y += ((y - pl.y) / d) * s;
      if (Math.abs(x - pl.x) > 0.05) pl.face = x > pl.x ? 1 : -1;
    }
    return d;
  }

  /** Burek fetches what lies beyond the knight's reach and bites what comes near him. */
  private dog(pl: Pal, L: number, w: number): void {
    const k = this.knight, R = RULES, pr = R.pickR * this.stats.pick;
    const reach = R.dogFetch + (L - 1);
    let tx = 0, ty = 0, best = Infinity, target: Scale | Drop | null = null;
    for (const sc of this.scales) {
      if (sc.pulled) continue;
      const dk = dist(sc.x, sc.y, k.x, k.y);
      if (dk < pr || dk > reach) continue;
      const d = dist(sc.x, sc.y, pl.x, pl.y);
      if (d < best) { best = d; target = sc; tx = sc.x; ty = sc.y; }
    }
    for (const dr of this.drops) {
      if (dr.pulled || dist(dr.x, dr.y, k.x, k.y) > reach + 2) continue;
      const d = dist(dr.x, dr.y, pl.x, pl.y) * 0.6;
      if (d < best) { best = d; target = dr; tx = dr.x; ty = dr.y; }
    }
    const speed = R.dogSpeed + 0.4 * (L - 1);
    if (target) {
      pl.busy = 'fetch';
      if (this.moveTo(pl, tx, ty, speed, w) < 0.45) {
        target.pulled = true;
        if ('kind' in target) {
          this.emit({ type: 'pal', id: 'pies', what: 'fetch', x: tx, y: ty });
          if (target.kind === 'chest' || target.kind === 'bigChest') this.talk.ask('pal_pies', 1, 3);
        }
      }
    } else {
      pl.busy = 'follow';
      const a = this.walkDir + Math.PI * 0.75;
      const fx = k.x + Math.cos(a) * 1.2, fy = k.y + Math.sin(a) * 1.0;
      if (dist(pl.x, pl.y, fx, fy) > 0.4) this.moveTo(pl, fx, fy, speed * 0.8, w);
    }
    if (pl.t1 <= 0) {
      const dmg = (3 + 1.5 * (L - 1)) * this.stats.dmg;
      let bit = false;
      for (const c of this.brood) {
        if (dist(c.x, c.y, pl.x, pl.y) > R.dogBiteR + c.r) continue;
        this.damage(c, dmg, pl.x, pl.y, 0.8, 'pies');
        bit = true;
        break;
      }
      if (!bit && this.bossHittable && dist(this.boss.x, this.boss.y, pl.x, pl.y) < R.dogBiteR + RULES.bossR) {
        this.hurtBoss(dmg, 'pies');
        bit = true;
      }
      pl.t1 = bit ? R.dogBite : 0.15;
      if (bit) this.emit({ type: 'pal', id: 'pies', what: 'bite', x: pl.x, y: pl.y });
    }
  }

  /** Iskierka hovers round the knight, eats fire near her (it charges the Miecz) and spits sparks at the brood. */
  private hatchling(pl: Pal, L: number, w: number): void {
    const k = this.knight, R = RULES;
    pl.a += w * 2.2;
    const hx = k.x + Math.cos(pl.a) * R.sparkOrbit, hy = k.y + Math.sin(pl.a) * R.sparkOrbit * 0.8;
    this.moveTo(pl, hx, hy, 9, w);
    pl.face = Math.cos(pl.a + Math.PI / 2) >= 0 ? 1 : -1;
    if (pl.t1 <= 0) {
      const reach = R.sparkEatR + 0.4 * (L - 1);
      let bi = -1, fi = -1, bd = reach;
      this.balls.forEach((b, i) => { const d = dist(b.x, b.y, pl.x, pl.y); if (d < bd) { bd = d; bi = i; fi = -1; } });
      this.flames.forEach((f, i) => { const d = dist(f.x, f.y, pl.x, pl.y); if (d < bd) { bd = d; fi = i; bi = -1; } });
      if (bi >= 0 || fi >= 0) {
        const o = bi >= 0 ? this.balls.splice(bi, 1)[0] : this.flames.splice(fi, 1)[0];
        this.quenchOne(o.x, o.y, bi >= 0, 'iskierka');
        this.emit({ type: 'pal', id: 'iskierka', what: 'eat', x: o.x, y: o.y });
        if (this.rng() < 0.2) this.talk.ask('pal_iskierka', 1, 3);
        pl.t1 = Math.max(0.6, R.sparkEat - 0.3 * (L - 1));
      } else pl.t1 = 0.12;
    }
    if (pl.t2 <= 0) {
      const tg = this.nearest(pl.x, pl.y, R.sparkReach);
      if (tg) {
        const dmg = (4 + 2 * (L - 1)) * this.stats.dmg;
        if (tg.c) this.damage(tg.c, dmg, pl.x, pl.y, 0.5, 'iskierka');
        else this.hurtBoss(dmg, 'iskierka');
        this.emit({ type: 'spark', x0: pl.x, y0: pl.y, x1: tg.x, y1: tg.y, from: 'iskierka' });
        pl.t2 = R.sparkSpit;
      } else pl.t2 = 0.2;
    }
  }

  /** Kolczak rolls round the knight in a ball of spikes: it bites what it rolls through and brings the scales it picks up. */
  private hedgehog(pl: Pal, L: number, w: number): void {
    const k = this.knight, R = RULES;
    const lap = Math.max(1.4, R.hogLap - 0.2 * (L - 1)), r = R.hogR + 0.2 * (L - 1);
    pl.a += (TAU / lap) * w;
    pl.x = k.x + Math.cos(pl.a) * r;
    pl.y = k.y + Math.sin(pl.a) * r * 0.9;
    pl.face = Math.cos(pl.a + Math.PI / 2) >= 0 ? 1 : -1;
    const dmg = (3 + 1.5 * (L - 1)) * this.stats.dmg;
    for (const c of [...this.brood]) {
      if (dist(c.x, c.y, pl.x, pl.y) > c.r + 0.45 || this.t - c.hogT < 0.5) continue;
      c.hogT = this.t;
      this.damage(c, dmg, pl.x, pl.y, 0.8, 'jez');
    }
    if (this.bossHittable && dist(this.boss.x, this.boss.y, pl.x, pl.y) < RULES.bossR + 0.4 && this.t - this.hogBossT > 0.6) {
      this.hogBossT = this.t;
      this.hurtBoss(dmg, 'jez');
    }
    for (const sc of this.scales) if (!sc.pulled && dist(sc.x, sc.y, pl.x, pl.y) < 0.6) sc.pulled = true;
  }

  private hogBossT = 0;

  /** Bartek gnaws a palisade between the knight and the thickest of the brood. */
  private beaver(pl: Pal, L: number, w: number): void {
    const k = this.knight, R = RULES;
    if (pl.busy === 'gnaw') {
      if (this.moveTo(pl, pl.tx, pl.ty, 7, w) < 0.3 && pl.t2 <= 0) pl.busy = 'follow';
      return;
    }
    const a = this.walkDir - Math.PI * 0.75;
    const fx = k.x + Math.cos(a) * 1.1, fy = k.y + Math.sin(a) * 1.0;
    if (dist(pl.x, pl.y, fx, fy) > 0.4) this.moveTo(pl, fx, fy, 5.2, w);
    if (pl.t1 > 0) return;
    let n = 0, sx = 0, sy = 0;
    for (const c of this.brood) {
      if (dist(c.x, c.y, k.x, k.y) > R.wallNear) continue;
      n++;
      sx += c.x;
      sy += c.y;
    }
    if (n < R.wallNeed) {
      pl.t1 = 0.5;
      return;
    }
    const dir = Math.atan2(sy / n - k.y, sx / n - k.x);
    const x = k.x + Math.cos(dir) * 1.9, y = k.y + Math.sin(dir) * 1.9;
    this.walls.push({ id: this.nextId++, x, y, a: dir + Math.PI / 2, len: R.wallLen + 0.5 * (L - 1), t: 0, life: R.wallLife, dmg: 2 + (L - 1) });
    pl.busy = 'gnaw';
    pl.tx = x;
    pl.ty = y;
    pl.t2 = 0.6;
    pl.t1 = Math.max(4, R.wallEvery - (L - 1));
    this.emit({ type: 'pal', id: 'bobr', what: 'wall', x, y });
    if (this.rng() < 0.3) this.talk.ask('pal_bobr', 1, 3);
  }

  // ── the land's dragon ───────────────────────────────────────────
  private setBoss(state: BossState, dur = 0): void {
    this.boss.state = state;
    this.boss.st = 0;
    this.boss.dur = dur;
  }

  private bossArrive(): void {
    const b = this.boss, k = this.knight;
    if (b.state !== 'away') return;
    b.visits++;
    const a = -Math.PI / 2 + (this.rng() - 0.5) * 1.2;
    b.x = k.x + Math.cos(a) * (this.viewHW + 3);
    b.y = k.y + Math.sin(a) * (this.viewHH + 3);
    b.tx = k.x + Math.cos(a) * 3.4;
    b.ty = this.bossY(k.y + Math.sin(a) * 3.4);
    b.air = 1;
    b.under = false;
    b.hot = 0;
    b.round = 0;
    b.used = [];
    this.setBoss('arrive', 1.6);
    this.emit({ type: 'boss', kind: b.spec.kind, tier: b.tier });
    // Linda hints at his weakness until it is found
    if (!this.p.flaws.includes(b.spec.kind)) this.talk.ask(`hint_${b.spec.kind}`, 4, 8);
    else this.talk.ask('boss', 4, 6);
    if (b.tier > 0 && b.visits === 1) this.talk.ask('road', 2, 8);
    this.coach('boss', b.tx, b.ty);
  }

  /** The push block ends: he flies off for a nap, his wounds kept. */
  private bossNap(): void {
    const b = this.boss;
    if (b.state === 'away' || b.state === 'leave') return;
    this.zones.length = 0;
    this.rain.length = 0;
    b.pattern = null;
    b.under = false;
    b.hot = 0;
    b.eating = false;
    b.fed = false;
    b.tx = b.x + (this.rng() - 0.5) * 6;
    b.ty = b.y - (this.viewHH + 5);
    this.setBoss('leave', 1.6);
    this.emit({ type: 'nap' });
    this.talk.ask('nap', 3, 6);
  }

  private hurtBoss(dmg: number, src: string, weapon = true): void {
    const b = this.boss;
    if (!(dmg > 0) || b.state === 'roar' || b.state === 'leave' || b.state === 'away' || b.state === 'arrive' || b.under) return;
    const flaw = b.state === 'flaw';
    const crit = weapon && src !== 'sword' && this.critRoll(src);
    const v = dmg * (flaw ? b.k : 1) * (crit ? RULES.critK : 1);
    const dealt = Math.min(v, b.all - b.damage);
    this.bossDmg[src] = (this.bossDmg[src] ?? 0) + dealt;
    this.run.dmg[src] = (this.run.dmg[src] ?? 0) + dealt;
    this.sessionDmg[src] = (this.sessionDmg[src] ?? 0) + dealt;
    b.damage = Math.min(b.all, b.damage + v);
    b.hit = 0.12;
    b.owed += v;
    this.emit({ type: 'hit', x: b.x, y: b.y - 0.6, dmg: v, boss: true, flaw, crit });
    // knocked-off scales fly to the knight
    while (b.owed >= RULES.owedPer) {
      b.owed -= RULES.owedPer;
      const a = this.rng() * TAU;
      this.scales.push({ id: this.nextId++, x: b.x + Math.cos(a) * 0.8, y: b.y + Math.sin(a) * 0.6, v: 3, life: RULES.scaleLife, pulled: true });
    }
    if (b.damage >= b.all) {
      this.driveOff();
      return;
    }
    const third = Math.floor((3 * b.damage) / b.all);
    if (third > b.roared) {
      b.roared = third;
      this.zones.length = 0;
      this.flames.length = 0;
      b.hot = 0;
      b.eating = false;
      this.setBoss('roar', RULES.roarSec);
      const k = this.knight, a = Math.atan2(k.y - b.y, k.x - b.x);
      k.x += Math.cos(a) * RULES.roarPush * 0.5;
      k.y += Math.sin(a) * RULES.roarPush * 0.5;
      this.rings.push({ r: 3, t: 0, kind: 'roar' });
      this.drops.push({ id: this.nextId++, kind: 'chest', x: b.x, y: b.y + 0.8, t: 0, pulled: false, src: 'roar' });
      this.emit({ type: 'roar' });
    }
  }

  private driveOff(): void {
    const b = this.boss, kind = b.spec.kind;
    this.drivenNow.push(kind);
    this.roadsNow.push({ kind, tier: b.tier });
    this.run.driven++;
    this.zones.length = 0;
    this.flames.length = 0;
    this.rain.length = 0;
    this.lastDriven = b.spec.hoard;
    this.drops.push({ id: this.nextId++, kind: 'bigChest', x: b.x, y: b.y + 0.6, t: 0, pulled: false });
    const gold = Math.round(RULES.drivenGold * (1 + road(b.tier).bank));
    for (let i = 0; i < gold; i++) {
      const a = (i / gold) * TAU;
      this.scales.push({ id: this.nextId++, x: b.x + Math.cos(a) * 1.2, y: b.y + Math.sin(a) * 1.2, v: 10, life: RULES.scaleLife, pulled: true });
    }
    // the road is cleared on the map; the next fight is the frontier
    const firstLand = b.land === 0 && b.tier === 0;
    clearFight(this.p, b.land, b.tier);
    const f = fightOf(this.p);
    const nb = this.makeBoss(f.land, f.tier, woundsOf(this.p, f.land, f.tier));
    this.topTier = Math.max(this.topTier, f.tier);
    nb.x = b.x;
    nb.y = b.y;
    b.tx = b.x + 4;
    b.ty = b.y - (this.viewHH + 6);
    this.setBoss('leave', 2.2);
    this.leaving = { x: b.x, y: b.y, tx: b.tx, ty: b.ty, t: 0, kind, spec: b.spec };
    this.boss = nb;
    this.stop = Math.max(this.stop, RULES.stopDriven);
    this.story = { kind: 'land', t: -1.2, dur: RULES.storySec + 1.2, from: kind, to: nb.spec.kind, tier: b.tier, toTier: nb.tier, first: firstLand };
    this.emit({ type: 'driven', kind, next: nb.spec.kind, tier: b.tier });
    this.talk.ask('driven', 5, 8);
  }

  /** the dragon just driven off, flying over the hills (for the view) */
  leaving: { x: number; y: number; tx: number; ty: number; t: number; kind: DragonKind; spec: DragonSpec } | null = null;

  /** His patterns now (the road adds one); the Three-Headed never repeats one in a round. */
  private choosePattern(): Pattern {
    const b = this.boss;
    let ps: (readonly [Pattern, number])[] = [...b.spec.patterns];
    if (b.tier >= 1) ps.push(b.spec.extra);
    if (b.spec.kind === 'trzyglowy') {
      const fresh = ps.filter(([p]) => !b.used.includes(p));
      if (fresh.length) ps = fresh;
    } else if (this.patHist.length >= 2 && this.patHist[0] === this.patHist[1]) {
      // never the same attack three times running
      const same = this.patHist[0];
      const other = ps.filter(([p]) => p !== same);
      if (other.length) ps = other;
    }
    let r = this.rng() * ps.reduce((s, p) => s + p[1], 0);
    for (const [p, wt] of ps) if ((r -= wt) <= 0) return p;
    return ps[0][0];
  }

  /** his last two attacks (across rounds) */
  private readonly patHist: Pattern[] = [];

  private zone(z: Omit<Zone, 'id' | 't' | 'live'>): void {
    this.zones.push({ ...z, id: this.nextId++, t: 0, live: false });
  }

  private bossAI(w: number): void {
    const b = this.boss, k = this.knight, R = RULES;
    b.hit = Math.max(0, b.hit - w);
    if (this.leaving) {
      const L = this.leaving;
      L.t += w;
      if (L.t > 2.4) this.leaving = null;
    }
    if (b.state === 'away') return;
    b.st += w;
    const fast = (b.roared > 0 ? R.teleFast ** b.roared : 1) * road(b.tier).tele;
    const pace = b.spec.pace;
    const toward = (tx: number, ty: number, sp: number) => {
      const d = dist(b.x, b.y, tx, ty);
      if (d < 1e-3) return;
      const s = Math.min(d, sp * w);
      b.x += ((tx - b.x) / d) * s;
      b.y += ((ty - b.y) / d) * s;
      if (Math.abs(tx - b.x) > 0.05) b.face = tx > b.x ? 1 : -1;
    };
    switch (b.state) {
      case 'arrive':
        toward(b.tx, b.ty, 7);
        b.air = clamp(1 - b.st / b.dur);
        if (b.st >= b.dur) {
          b.air = 0;
          this.startMove();
        }
        break;
      case 'leave':
        toward(b.tx, b.ty, 7);
        b.air = clamp(b.st / 0.6);
        if (b.st >= b.dur) {
          b.state = 'away';
          b.pattern = null;
        }
        break;
      case 'move': {
        toward(b.tx, b.ty, R.bossSpeed * pace);
        const d = dist(b.x, b.y, k.x, k.y);
        if (d < R.bossR + R.knightR && k.down <= 0) this.hurt(R.hurt.touch * 2, b.x, b.y);
        if (this.greedy()) break;
        if (b.st >= b.dur) this.telegraph(this.choosePattern(), fast);
        break;
      }
      case 'tele':
        if (b.pattern === 'breath') b.face = Math.cos(b.aim) >= 0 ? 1 : -1;
        if (b.pattern === 'dive') {
          // under the ground toward the mark
          const T = clamp(b.st / Math.max(0.01, b.dur));
          b.x = b.sx0 + (b.sx1 - b.sx0) * T;
          b.y = b.sy0 + (b.sy1 - b.sy0) * T;
        }
        if (b.st >= b.dur) this.attack();
        break;
      case 'act':
        this.act(w);
        break;
      case 'flaw':
        if (b.eating) {
          // gobbling: the scales near him go into his mouth one by one
          for (let i = this.scales.length - 1; i >= 0; i--) {
            const sc = this.scales[i];
            if (sc.pulled || dist(sc.x, sc.y, b.x, b.y) > R.greedNear) continue;
            const d = dist(sc.x, sc.y, b.x, b.y);
            const step = Math.min(d, 6 * w);
            if (d > 0.4) {
              sc.x += ((b.x - sc.x) / d) * step;
              sc.y += ((b.y - sc.y) / d) * step;
            } else this.scales.splice(i, 1);
          }
        }
        if (b.hot > 0) {
          b.hot -= w;
          // the aura touching him while he glows: he steams and collapses (the Ember Dragon's flaw)
          if (dist(k.x, k.y, b.x, b.y) < this.auraR + R.bossR + 0.05) this.fatal();
        }
        if (b.st >= b.dur) {
          b.hot = 0;
          b.eating = false;
          this.startMove();
        }
        break;
      case 'roar':
        if (b.st >= b.dur) this.startMove();
        break;
    }
  }

  /** The Golden Dragon cannot pass scales lying near him: he stops to gobble them (his fatal flaw). */
  private greedy(): boolean {
    const b = this.boss, R = RULES;
    if (b.spec.flaw !== 'greed' || b.fed) return false;
    let n = 0;
    for (const sc of this.scales) if (!sc.pulled && dist(sc.x, sc.y, b.x, b.y) < R.greedNear) n++;
    if (n < R.greedN) return false;
    b.eating = true;
    b.fed = true;
    this.fatal(Math.min(R.greedMax, n * R.greedEach), R.greedK);
    return true;
  }

  private startMove(): void {
    const b = this.boss, k = this.knight, R = RULES;
    const a = Math.atan2(b.y - k.y, b.x - k.x) + (this.rng() - 0.5) * 1.6;
    const keep = span(R.bossKeep, this.rng());
    b.tx = k.x + Math.cos(a) * keep;
    b.ty = this.bossY(k.y + Math.sin(a) * keep);
    b.pattern = null;
    b.under = false;
    b.k = 1;
    b.fatal = false;
    // a new round: the Three-Headed's three heads, or a hard road's combo
    b.round = b.spec.kind === 'trzyglowy' ? RULES.tangleRound - 1 : road(b.tier).combo;
    b.used = [];
    this.setBoss('move', span(R.bossRest, this.rng()) / b.spec.pace);
  }

  private telegraph(p: Pattern, fast: number): void {
    const b = this.boss, k = this.knight, R = RULES;
    b.pattern = p;
    b.breathQ = 0;
    b.missed = false;
    const bark = this.palLevel('pies') > 0 ? R.dogBark : 0;
    const dur = R.tele[p] * fast * (this.session === 1 && b.visits <= 1 ? 1.25 : 1) + bark;
    if (p === 'breath') {
      b.aim = Math.atan2(k.y - b.y, k.x - b.x);
      this.zone({ kind: 'cone', x: b.x, y: b.y, a: b.aim, len: R.coneLen, w: R.coneHalf, dur: dur + R.breathSec });
    } else if (p === 'lanes') {
      const a = this.rng() < 0.5 ? 0 : Math.PI / 2;
      const nx = -Math.sin(a), ny = Math.cos(a);
      for (let i = 0; i < R.lanes; i++) {
        const off = (i - (R.lanes - 1) / 2) * 2.3 + (this.rng() - 0.5) * 0.6;
        this.zone({ kind: 'lane', x: k.x + nx * off - Math.cos(a) * R.laneLen / 2, y: k.y + ny * off - Math.sin(a) * R.laneLen / 2, a, len: R.laneLen, w: R.laneW, dur: dur + 0.6 });
      }
    } else if (p === 'rain') {
      for (let i = 0; i < R.rainN; i++) {
        const a = this.rng() * TAU, r = i === 0 ? 0 : 0.8 + this.rng() * R.rainScatter;
        const x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r;
        this.zone({ kind: 'circle', x, y, a: 0, len: 0, w: R.rainR, dur: dur + 0.1 });
        this.rain.push({ id: this.nextId++, x, y, t: -(dur - R.rainFall), dur: R.rainFall });
      }
    } else if (p === 'swoop') {
      const a = Math.atan2(k.y - b.y, k.x - b.x);
      b.sx0 = b.x;
      b.sy0 = b.y;
      b.sx1 = k.x + Math.cos(a) * 3.5;
      b.sy1 = k.y + Math.sin(a) * 3.5;
      b.aim = a;
      this.zone({ kind: 'lane', x: b.sx0, y: b.sy0, a, len: dist(b.sx0, b.sy0, b.sx1, b.sy1), w: R.swoopW, dur: dur + 0.8 });
    } else if (p === 'dive') {
      // he plunges under the ground and comes up under the mark
      b.under = true;
      b.sx0 = b.x;
      b.sy0 = b.y;
      b.sx1 = k.x;
      b.sy1 = k.y;
      this.zone({ kind: 'circle', x: k.x, y: k.y, a: 0, len: 0, w: R.diveR, dur: dur + 0.35 });
    } else if (p === 'ring') {
      const gap = this.rng() * TAU;
      this.zone({ kind: 'ring', x: k.x, y: k.y, a: 0, len: 0, w: R.ringBand, dur: dur + R.ringSec, r: R.ringFrom, gap, gapW: R.ringGap });
      this.coach('ring', k.x, k.y);
    } else if (p === 'embers') {
      for (let i = 0; i < R.emberPacks; i++) {
        const a = this.rng() * TAU, r = 2.6 + this.rng() * 1.2;
        this.zone({ kind: 'circle', x: k.x + Math.cos(a) * r, y: k.y + Math.sin(a) * r, a: 0, len: 0, w: 0.9, dur: dur + 0.2 });
      }
    } else if (p === 'coins') {
      b.aim = Math.atan2(k.y - b.y, k.x - b.x);
      this.zone({ kind: 'cone', x: b.x, y: b.y, a: b.aim, len: 6, w: R.coinFan / 2, dur: dur + 0.25 });
    } else {
      // the tail sweep: a ring around him
      this.zone({ kind: 'circle', x: b.x, y: b.y, a: 0, len: 0, w: R.sweepR, dur: dur + 0.3 });
    }
    this.setBoss('tele', dur);
    this.emit({ type: 'bossTele', pattern: p });
  }

  private attack(): void {
    const b = this.boss, R = RULES, p = b.pattern!, k = this.knight;
    b.fed = false;
    for (const z of this.zones) z.live = true;
    let dur: number;
    switch (p) {
      case 'breath': dur = R.breathSec; break;
      case 'lanes': dur = 0.6; break;
      case 'rain': dur = 0.15; break;
      case 'swoop': dur = dist(b.sx0, b.sy0, b.sx1, b.sy1) / R.swoopSpeed; break;
      case 'dive': {
        // the burst
        b.under = false;
        b.x = b.sx1;
        b.y = b.sy1;
        const hitK = dist(k.x, k.y, b.x, b.y) < R.diveR + R.knightR * 0.5;
        if (hitK) this.hurt(R.hurt.dive, b.x, b.y);
        b.missed = !hitK;
        for (const c of this.brood) if (dist(c.x, c.y, b.x, b.y) < R.diveR + 0.6) { c.kx += (c.x - b.x) * 4; c.ky += (c.y - b.y) * 4; }
        this.rings.push({ r: R.diveR, t: 0, kind: 'burst' });
        dur = 0.35;
        break;
      }
      case 'ring': dur = R.ringSec; break;
      case 'embers': {
        for (const z of this.zones) {
          if (z.kind !== 'circle') continue;
          for (let i = 0; i < 5; i++) this.spawn('ognik', (i / 5) * TAU, false, 1, { x: z.x, y: z.y });
        }
        dur = 0.3;
        break;
      }
      case 'coins': {
        for (let i = 0; i < R.coins; i++) {
          const a = b.aim + (i / (R.coins - 1) - 0.5) * R.coinFan, sp = R.coinSpeed * (0.85 + 0.3 * this.rng());
          this.balls.push({ id: this.nextId++, x: b.x + Math.cos(a) * 0.8, y: b.y - 0.2 + Math.sin(a) * 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 0.17, life: R.coinLife * (0.8 + 0.4 * this.rng()), coin: true });
        }
        dur = 0.25;
        break;
      }
      default: {
        // the tail sweep
        if (dist(k.x, k.y, b.x, b.y) < R.sweepR + R.knightR * 0.5) this.hurt(R.hurt.sweep, b.x, b.y);
        for (const c of this.brood) if (dist(c.x, c.y, b.x, b.y) < R.sweepR + c.r) { c.kx += (c.x - b.x) * 3; c.ky += (c.y - b.y) * 3; }
        // the Golden Dragon's tail knocks scales out of his hoard around him
        if (b.spec.kind === 'zloty') {
          for (let i = 0; i < 6; i++) {
            const a = this.rng() * TAU, r = 1.6 + this.rng() * 1.6;
            if (this.scales.length < RULES.scaleCap) this.scales.push({ id: this.nextId++, x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r, v: 1, life: RULES.scaleLife, pulled: false });
          }
        }
        this.rings.push({ r: R.sweepR, t: 0, kind: 'burst' });
        dur = 0.3;
      }
    }
    this.setBoss('act', dur);
    this.flameAcc = 0;
    this.laneHit = false;
    this.emit({ type: 'bossAct', pattern: p });
  }

  private flameAcc = 0;
  private laneHit = false;

  private act(w: number): void {
    const b = this.boss, k = this.knight, R = RULES;
    const p = b.pattern;
    if (p === 'breath') {
      this.flameAcc += R.flameRate * w;
      while (this.flameAcc >= 1) {
        this.flameAcc -= 1;
        const a = b.aim + (this.rng() * 2 - 1) * R.coneHalf, sp = R.flameSpeed * (0.85 + 0.3 * this.rng());
        this.flames.push({ id: this.nextId++, x: b.x + Math.cos(b.aim) * 0.9, y: b.y - 0.3 + Math.sin(b.aim) * 0.9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: R.flameR, life: R.coneLen / sp });
      }
    } else if (p === 'lanes') {
      if (!this.laneHit) {
        for (const z of this.zones) {
          if (z.kind !== 'lane' || !this.inLane(z, k.x, k.y)) continue;
          this.laneHit = true;
          // the shield above the threshold takes the fire under it
          if (this.auraR >= this.auraMark - 0.05) this.quenchOne(k.x, k.y, true);
          else this.hurt(R.hurt.lane, k.x, k.y);
          break;
        }
      }
    } else if (p === 'swoop') {
      const T = b.dur > 0 ? clamp(b.st / b.dur) : 1;
      b.x = b.sx0 + (b.sx1 - b.sx0) * T;
      b.y = b.sy0 + (b.sy1 - b.sy0) * T;
      b.air = Math.sin(T * Math.PI) * 0.6;
      b.face = b.sx1 > b.sx0 ? 1 : -1;
      if (!this.laneHit && dist(b.x, b.y, k.x, k.y) < R.bossR + R.knightR + 0.2) {
        this.laneHit = true;
        this.hurt(R.hurt.swoop, b.x, b.y);
      }
      for (const c of [...this.brood]) if (dist(c.x, c.y, b.x, b.y) < R.bossR + c.r) { c.kx += (c.x - b.x) * 3; c.ky += (c.y - b.y) * 3; }
      b.missed = !this.laneHit;
    } else if (p === 'ring') {
      const z = this.zones.find(zz => zz.kind === 'ring');
      if (z) {
        const T = clamp(b.st / Math.max(0.01, b.dur));
        z.r = R.ringFrom + (R.ringTo - R.ringFrom) * T;
        const d = dist(k.x, k.y, z.x, z.y);
        const inGap = Math.abs(turn(z.gap ?? 0, Math.atan2(k.y - z.y, k.x - z.x))) < (z.gapW ?? 0) / 2;
        // a shield above the threshold, reaching the ring of fire, puts it all out
        if (Math.abs(d - z.r) < this.auraR + R.ringBand / 2 && this.auraR >= this.auraMark - 0.05 && this.auraLook === 'live') {
          this.emit({ type: 'ringOut', x: z.x, y: z.y, r: z.r });
          this.rings.push({ r: z.r, t: 0, kind: 'steam' });
          for (let i = 0; i < 8; i++) this.quenchOne(z.x + Math.cos((i / 8) * TAU) * z.r, z.y + Math.sin((i / 8) * TAU) * z.r, false);
          this.addCharge(0.12);
          this.zones.length = 0;
          b.st = b.dur;
        } else if (!this.laneHit && !inGap && Math.abs(d - z.r) < R.ringBand / 2 + R.knightR * 0.5) {
          this.laneHit = true;
          this.hurt(R.hurt.ring, k.x, k.y);
        }
      }
    }
    if (b.st >= b.dur) this.endAttack();
  }

  /** An attack is over: the round goes on, or he is dizzy — or his fatal flaw opens. */
  private endAttack(): void {
    const b = this.boss, R = RULES, p = b.pattern!;
    b.air = 0;
    b.under = false;
    this.zones.length = 0;
    b.used.push(p);
    this.patHist.push(p);
    if (this.patHist.length > 2) this.patHist.shift();
    const kind = b.spec.kind;
    // the fatal flaws a pattern brings about
    if (kind === 'zielony' && p === 'breath' && b.breathQ >= R.steamNeed) return this.fatal();
    if (kind === 'bagienny' && p === 'dive' && b.missed) return this.fatal();
    if (kind === 'skrzydlaty' && p === 'swoop' && b.missed) return this.fatal();
    if (kind === 'trzyglowy' && b.round <= 0 && new Set(b.used).size >= R.tangleRound) return this.fatal();
    if (kind === 'zarowy' && p === 'ring') {
      // he glows and must cool: a dizzy window in which the aura or water brings him down
      b.round = 0;
      this.flawWindow();
      b.hot = R.heatSec;
      return;
    }
    if (b.round > 0 && CLOSERS[kind] !== p) {
      // straight on to the next attack of the round
      b.round--;
      b.pattern = null;
      this.setBoss('move', R.comboGap);
      return;
    }
    this.flawWindow();
  }

  /** The dizzy window after an attack: ×2. */
  private flawWindow(): void {
    const b = this.boss, R = RULES;
    b.k = R.flawK;
    b.fatal = false;
    this.setBoss('flaw', R.flawSec * (this.has('klepsydra') ? 1.5 : 1));
    this.emit({ type: 'flaw' });
    this.talk.ask('flaw', 2, 2.5);
  }

  /** His fatal flaw opens: a longer window, ×3 (×2.5 while the Golden One gobbles); the first time, it goes into the chronicle. */
  private fatal(dur: number = RULES.fatalSec, k: number = RULES.fatalK): void {
    const b = this.boss, kind = b.spec.kind;
    if (b.fatal && b.state === 'flaw') return;
    b.hot = 0;
    b.k = k;
    b.fatal = true;
    b.round = 0;
    this.zones.length = 0;
    this.setBoss('flaw', dur * (this.has('klepsydra') ? 1.5 : 1));
    this.fatalsNow++;
    const first = !this.p.flaws.includes(kind);
    if (first) {
      this.p.flaws.push(kind);
      this.flawsNow.push(kind);
      // the hint came true: Linda stops hinting and cheers instead
      this.talk.drop(m => m.startsWith('hint_'));
    }
    this.rings.push({ r: 2.2, t: 0, kind: 'steam' });
    this.emit({ type: 'fatal', kind, flaw: b.spec.flaw, first });
    this.talk.ask('fatal', first ? 5 : 3, 3);
    this.coach('fatal', b.x, b.y);
  }

  inLane(z: Zone, x: number, y: number): boolean {
    const dx = x - z.x, dy = y - z.y;
    const along = dx * Math.cos(z.a) + dy * Math.sin(z.a), across = -dx * Math.sin(z.a) + dy * Math.cos(z.a);
    return along >= -0.2 && along <= z.len + 0.2 && Math.abs(across) <= z.w / 2 + RULES.knightR * 0.5;
  }

  // ── effects that only age ───────────────────────────────────────
  private fx(dt: number): void {
    for (let i = this.smokes.length - 1; i >= 0; i--) if ((this.smokes[i].t += dt) > 0.9) this.smokes.splice(i, 1);
    for (let i = this.sweeps.length - 1; i >= 0; i--) if ((this.sweeps[i].t += dt) > 0.22) this.sweeps.splice(i, 1);
    for (let i = this.rings.length - 1; i >= 0; i--) if ((this.rings[i].t += dt) > 0.6) this.rings.splice(i, 1);
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
    if (this.bossOn && this.boss.state !== 'leave') this.bossNap();
    this.choice = null;
    this.queued.length = 0;
    this.phase = 'done';
    this.talk.clear();
    this.talk.ask('end', 5, 8);
    this.emit({ type: 'done' });
    this.settle();
  }

  /** The session is settled once — at its end, or when it ends early: the map and the counters reach the progress. */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p, b = this.boss;
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushesBase + this.pushesBegun);
    p.total += this.score;
    p.bank += this.score + this.bankBonus;
    if (b.damage > 0) p.wounds[woundKey(b.land, b.tier)] = Math.floor(Math.min(b.damage, b.all - 1));
    const slotsBefore = slots(p);
    p.driven += this.drivenNow.length;
    p.swords += this.swords;
    p.quenched += this.quenched;
    p.chests += this.chestsNow;
    // the run still going counts as a run
    if (!this.tally) {
      p.runs += this.runs + 1;
      p.bestRun = Math.max(p.bestRun, this.run.scales);
      p.bestTime = Math.max(p.bestTime, Math.round(this.run.t));
    } else p.runs += this.runs;
    p.bestLevel = Math.max(p.bestLevel, this.topLevel, this.run.level);
    p.lastLen = this.plannedSec;
    this.armourNow = earnArmour(p);
    for (const id of this.armourNow) this.emit({ type: 'armour', id });
    this.companionsNow = earnCompanions(p);
    // a second place opened: the next companion earned comes along by itself (a choice made in the lobby stays)
    if (slots(p) > slotsBefore) {
      for (const id of p.companions) if (p.party.length < slots(p) && !p.party.includes(id)) p.party.push(id);
    }
    for (const id of this.companionsNow) this.emit({ type: 'companion', id });
  }

  /** The treasury's bonus for the road fought (a share of the session's scales, paid into the bank). */
  get bankBonus(): number { return Math.round(this.score * road(this.topTier).bank); }

  /** The session ends before its own end: settle as the end would. */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') this.endBlock();
    this.choice = null;
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

  /** The panel's gauge: the aura in a sighted Tarcza, calm in a Postój; null blind, without signal, in the lead-in or outside the blocks (nothing is driven there). */
  meter(): number | null {
    if (!this.started || !this.reliable) return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp((this.auraR - this.stats.base) / RULES.shieldExtra);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  /** The pad follows the aura in a sighted Tarcza, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp((this.auraR - this.stats.base) / RULES.shieldExtra);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The dragon's scales still on him, of all. */
  get dragonLeft(): { left: number; all: number } {
    const b = this.boss;
    return { left: Math.round(b.all - b.damage), all: b.all };
  }

  /** The best run this session so far (the one going on counts). */
  get bestRunSoFar(): number { return Math.max(this.bestRunNow, this.run.scales); }

  /** A damage source's name (a weapon, a companion, the shield, the sword of light, the mirror). */
  sourceName(src: string): string {
    if (src === 'pulse') return t('src.pulse');
    if (src === 'sword') return t('src.sword');
    if (src === 'mirror') return treasureName('lustro');
    if (src === 'pies' || src === 'iskierka' || src === 'jez' || src === 'bobr') return palName(src);
    return itemName(src as ItemId);
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
      p.bestLevel = Math.max(p.bestLevel, this.topLevel, this.run.level);
      p.bestRun = Math.max(p.bestRun, this.run.scales, this.bestRunNow);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const dl = this.dragonLeft;
    const top = this.topSources(this.sessionDmg, 1)[0];
    const stats: [string, string][] = [
      [t('stat.runs'), String(this.runs + (this.tally ? 0 : 1))],
      [t('stat.bestRun'), scalesText(this.bestRunSoFar)],
      [t('stat.level'), String(Math.max(this.topLevel, this.run.level))],
      [t('stat.quenched'), fmtNum(this.quenched)],
      [t('stat.swords'), String(this.swords)],
      [t('stat.dragonLeft', { name: cap(dragonName(this.boss.spec.kind)), road: roadName(this.boss.tier) }), t('pct', { n: Math.round(((dl.all - dl.left) / Math.max(1, dl.all)) * 100) })],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    if (top) stats.splice(5, 0, [t('stat.top'), this.sourceName(top.src)]);
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: the first
   * session, a dragon driven off, a weakness found, a Miecz światła, many fires quenched, a new piece
   * of armour, a long stand, a calm Postój; else Ephesians 6:16.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('jos1.9');
    if (this.drivenNow.length) fit.push('psa91.13');
    if (this.flawsNow.length) fit.push('jas1.5');
    if (this.swords > 0) fit.push('eph6.17');
    if (this.quenched >= RULES.manyQuench) fit.push('eph6.16');
    if (this.armourNow.length || this.evolved.length) fit.push('eph6.10-11');
    if (this.plannedSec >= 300 || this.maxHold >= RULES.longHold) fit.push('2ti4.7');
    if (this.passedRests > 0) fit.push('1co16.13');
    fit.push('eph6.16');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    const b = this.boss;
    if (this.drivenNow.length) add(0, t('hl.close.driven', { town: townName(this.drivenNow[this.drivenNow.length - 1]) }));
    else if (this.started && b.damage <= 0) add(0, t('hl.close.none', { scales: scalesText(this.score) }));
    else if (this.started) add(0, t('hl.close.fight', { dragon: cap(dragonName(b.spec.kind)), pct: Math.round((b.damage / Math.max(1, b.all)) * 100) }));
    for (const r of this.roadsNow) add(1, t('hl.road', { name: cap(dragonName(r.kind)), road: roadName(r.tier) }));
    for (const k of this.flawsNow) add(1, t('hl.fatal', { name: cap(dragonName(k)), flaw: flawName(this.flawOf(k)) }));
    for (const id of this.companionsNow) add(2, t('hl.pal', { name: palName(id) }));
    for (const id of this.treasuresNow) add(2, t('hl.treasure', { name: treasureName(id) }));
    for (const id of this.armourNow) add(2, t('hl.armour', { name: armourName(id) }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(3, t('hl.record', { scales: scalesText(this.score) }));
    const bestRun = this.bestRunSoFar;
    if (this.bestRunBefore > 0 && bestRun > this.bestRunBefore) add(4, t('hl.bestRun', { scales: scalesText(bestRun) }));
    else if (this.bestRunBefore > 0 && bestRun > 0) add(4, t('hl.toBest', { scales: scalesText(this.bestRunBefore - bestRun) }));
    for (const id of this.duetsNow) add(5, t('hl.duet', { name: duetName(id) }));
    for (const id of [...new Set(this.evolved)]) add(5, t('hl.evolved', { name: evoName(id) }));
    if (this.swords) add(6, t('hl.swords', { n: this.swords }));
    if (this.quenched >= 10) add(7, t('hl.quenched', { n: this.quenched }));
    if (this.blindShare >= 0) add(8, t('hl.blind', { n: this.blindShare }));
    if (this.settled && this.bankBonus > 0) add(8, t('hl.bonus', { scales: scalesText(this.bankBonus), road: roadName(this.topTier) }));
    if (this.settled && affordable(this.p) && this.p.bank > this.bankBefore) add(9, t('hl.forge'));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }

  private flawOf(k: DragonKind): FlawKind {
    return (DRAGONS.find(d => d.kind === k) ?? DRAGONS[0]).flaw;
  }

  /** For the view: an item's level in this run. */
  itemLevel(id: ItemId): number { return this.lv(id); }
  /** For the view's chips. */
  get build(): { id: ItemId; level: number }[] { return this.run.order.map(id => ({ id, level: this.lv(id) })); }
  /** words for a card (the view) */
  cardTitle(c: Card): string {
    if (c.kind === 'evo') return evoName(c.id as WeaponId);
    if (c.kind === 'apple') return t('card.apple');
    if (c.kind === 'scales') return t('card.scales');
    if (c.kind === 'pal' && c.pal) return palName(c.pal);
    if (c.kind === 'treasure' && c.tr) return treasureName(c.tr);
    return itemName(c.id!);
  }
}
