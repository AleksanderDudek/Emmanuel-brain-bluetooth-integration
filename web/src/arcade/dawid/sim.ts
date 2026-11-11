/**
 * Dawid's rules without a screen: an open-world action RPG after XP Hero.  David walks the map of a
 * land (a joystick: drag anywhere, or WASD); a tap sends him hunting by himself (or walking where it
 * points); his sling throws by itself at the nearest beast, his staff, bow and javelin join as he forges
 * them, and his companions' kit skills fire on their own.  Beasts live in camps (dens) and come back
 * after a while; struck, they lose heart and run off into the hills, dropping silver; silver, brushwood
 * and stone go into the shepherd's bag, which holds only so much — the camp empties it into the
 * treasury, and by the camp's fire silver buys the ability ladder, the buildings and the forge.  XP
 * makes levels (a chest every fifth).  Each land has a chain of quests from the people of the story and
 * a guardian at its gate (the lion, the she-bear, Goliath…): telegraphed attacks on the ground, a daze to
 * strike in, its wounds kept from visit to visit; driven off (Goliath falls flat), the gate opens to the
 * next land.  A golden jackal runs off with loot now and then, Jesse sends bundles, and the cave of
 * Adullam is a tower of 30-second floors.
 *
 * The band is the sling's whirl (Proca): in a sighted push past its lead-in, the level whirls the stone
 * and sets the multiplier on damage and XP (×1 below the threshold, ×2 at it, ×4 high above it); a held
 * focus polishes the great stone from the brook (a tap throws it at the strongest target).  In a rest
 * (Harfa) David sits by a fire and plays: every beast dozes, calm heals the party and fills rested XP
 * (the next XP counts double), the night refills the dens, and a calm rest ends with the fire's gift.
 * Blind pushes are moonless nights, revealed at dawn.  A stumble wakes David at the camp's fire, bag and
 * all; the session's XP never goes back.
 *
 * No DOM: the view and the sound read the state and the event queue (`take()`).
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  ABILITIES, BEASTS, BEAST_KINDS, BONDS, BUILDINGS, COMPANIONS, CRAFT, FOLD_INCOME, GUARDS, LINES, QUESTS, STORE_K, TAUNTS, TIPS, WEAPONS,
  WEAPON_IDS, WELL_K, ability, abilityName, beastCount, buildingName, circleQuests, companionName, companionSpec, guardName, kitName,
  landName, landStory, weaponName,
  type AbilityId, type BeastKind, type BeastSpec, type BuildingId, type CompanionId, type GuardKind, type GuardSpec, type Kit, type LandSpec,
  type NodeKind, type Pattern, type QuestSpec, type Spot, type WeaponId,
} from './content';
import { count, silverText, t, xpText, type Key } from './i18n';
import {
  abilityCost, abilityLevel, abilityWhy, bagCap, baseDmg, baseHp, bestFor, build, buildingCost, buildingLevel, buildingWhy, buyAbility, fillParty,
  forge, guardHp, join, landAt, landK, lenKey, partyNow, partySlots, reached, stars, tierOf, toggleParty, weaponCap, weaponCost, weaponK,
  weaponLevel, weaponWhy, xpNeed, anyAffordable, hasJoined, type BuyWhy, type DawidProgress,
} from './meta';
import { RULES } from './rules';
import { Talk } from './talk';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';
export type Coach = 'move' | 'hunt' | 'coins' | 'bag' | 'camp' | 'quest' | 'sling' | 'stone' | 'harp' | 'guard' | 'bearer' | 'thief' | 'level' | 'gate' | 'cave';
/** how the sling's ring looks: dim at its base, live in a sighted push, waiting in the lead-in, grey without signal, a dark ember on a moonless night, put away by the fire */
export type RingLook = 'base' | 'live' | 'wait' | 'grey' | 'night' | 'rest';
export type Mode = 'none' | 'hunt' | 'go' | 'home';
export type CampTab = 'ab' | 'bd' | 'wp' | 'party';
export type CoinKind = 'silver' | 'wood' | 'stone';
export type ShotKind = 'stone' | 'great' | 'arrow' | 'javelin' | 'volley';
export type BeastState = 'idle' | 'chase' | 'tele' | 'dash' | 'flee' | 'doze' | 'home' | 'stun' | 'back';
export type GuardState = 'sleep' | 'wake' | 'move' | 'tele' | 'act' | 'daze' | 'home' | 'driven' | 'gone';

export interface David {
  x: number; y: number; mx: number; my: number; face: number;
  hp: number; max: number; safe: number; down: number; hit: number;
  /** 0..1 sitting by the fire */
  sit: number;
  walked: number;
  /** seconds slowed by a taunt, wearing Saul's armour */
  slow: number;
  armour: number;
  unhurt: number;
}
export interface Lamb { x: number; y: number; face: number; walking: number }
export interface Mate { id: CompanionId; kit: Kit; x: number; y: number; face: number; cd: number; act: number; walking: number; tx: number; ty: number }
export interface Beast {
  id: number; kind: BeastKind; spec: BeastSpec; den: number;
  x: number; y: number; kx: number; ky: number; hx: number; hy: number;
  hp: number; max: number; atk: number; xp: number; silver: number; speed: number; r: number;
  state: BeastState; st: number; bite: number; cd: number; ax: number; ay: number; hit: number;
  /** a viper still hidden in the grass; a flyer's height (u); drawn to Shammah (s) */
  hidden: boolean; air: number; taunt: number; age: number; face: number; flee: number; fx: number; fy: number;
}
export interface Den { kind: BeastKind; x: number; y: number; n: number; k: number; wait: number[] }
export interface Coin { id: number; kind: CoinKind; v: number; x: number; y: number; vx: number; vy: number; z: number; vz: number; t: number; pulled: boolean }
export interface Shot {
  id: number; kind: ShotKind; x: number; y: number; vx: number; vy: number; speed: number;
  /** a homing stone's target: a beast id, -1 the guardian, -2 the thief */
  target: number; dmg: number; mult: number; gold: boolean; crit: boolean; pierce: number; life: number; hit: number[]; tx: number; ty: number; z: number;
}
export interface Node { kind: NodeKind; x: number; y: number; back: number }
export type ChestKind = 'land' | 'reward' | 'gift' | 'guard' | 'floor';
export interface Chest { id: number; kind: ChestKind; x: number; y: number; t: number; life: number; silver: number; wood: number; stone: number; xp: number }
export interface Zone { id: number; kind: 'lane' | 'cone' | 'ring' | 'circle'; x: number; y: number; a: number; len: number; w: number; t: number; dur: number; live: boolean; small: boolean }
export interface Guard {
  kind: GuardKind; spec: GuardSpec; name: string;
  state: GuardState; st: number; dur: number;
  x: number; y: number; hx: number; hy: number; face: number; r: number;
  hp: number; max: number; atk: number; xp: number;
  pattern: Pattern | null; zone: Zone | null; ax: number; ay: number; x0: number; y0: number;
  hit: number; bearerA: number; bite: number; fall: number; taunt: string; tauntT: number;
}
export interface Thief { x: number; y: number; t: number; hp: number; max: number; dir: number; zig: number; hit: number }
export interface Print { x: number; y: number; t: number; above: boolean; phase: 'focus' | 'rest' | 'free'; veiled: boolean; left: boolean }
export interface Puff { x: number; y: number; t: number; kind: BeastKind | 'thief' | 'dust'; dir: number; air: number }
export interface Ring { x: number; y: number; r: number; t: number; dur: number; kind: 'great' | 'roar' | 'level' | 'stomp' | 'shield' | 'heal' | 'sweep' | 'dash' | 'gate' }
export interface Note { x: number; y: number; t: number; n: number }
export interface Story { kind: 'open' | 'land' | 'guard' | 'visit' | 'circle'; t: number; dur: number; title: string; text: string; verse?: PassageId; then?: 'armour' | 'land' }
export interface Cave { floor: number; t: number; state: 'fight' | 'clear'; clearT: number; best: number }
export interface Tile { kind: 'ab' | 'bd' | 'wp' | 'mate' | 'cave'; id: string; title: string; lv: number; fx: string; cost: string; why: BuyWhy | 'in' | 'out' | 'later'; price?: readonly [number, number, number] }

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'finale' }
  | { type: 'done' }
  | { type: 'throw'; kind: ShotKind; x: number; y: number; gold: boolean }
  | { type: 'hit'; x: number; y: number; dmg: number; gold: boolean; crit: boolean; guard: boolean }
  | { type: 'blocked'; x: number; y: number }
  | { type: 'driven'; x: number; y: number; kind: BeastKind; xp: number; mult: number }
  | { type: 'xp'; v: number; x: number; y: number }
  | { type: 'coin'; kind: CoinKind; v: number }
  | { type: 'bagFull' }
  | { type: 'deliver'; silver: number; wood: number; stone: number }
  | { type: 'level'; level: number; dmg: number; hp: number }
  | { type: 'stoneReady' }
  | { type: 'stoneHit'; x: number; y: number; n: number; guard: boolean }
  | { type: 'sweep'; x: number; y: number; r: number }
  | { type: 'kit'; id: CompanionId; x: number; y: number }
  | { type: 'star'; id: CompanionId; stars: number }
  | { type: 'hurt'; x: number; y: number }
  | { type: 'down' }
  | { type: 'wake' }
  | { type: 'guardWake'; kind: GuardKind }
  | { type: 'guardTele'; pattern: Pattern }
  | { type: 'guardAct'; pattern: Pattern }
  | { type: 'daze' }
  | { type: 'taunt'; text: string }
  | { type: 'guardDriven'; kind: GuardKind; giant: boolean; x: number; y: number }
  | { type: 'gate' }
  | { type: 'land'; idx: number; circle: number }
  | { type: 'quest'; index: number }
  | { type: 'questDone'; xp: number; silver: number }
  | { type: 'buy'; id: AbilityId }
  | { type: 'build'; id: BuildingId; level: number }
  | { type: 'forge'; id: WeaponId; level: number; evolved: boolean }
  | { type: 'joined'; id: CompanionId }
  | { type: 'chest'; x: number; y: number; kind: ChestKind }
  | { type: 'gift'; x: number; y: number }
  | { type: 'node'; x: number; y: number; kind: NodeKind }
  | { type: 'thief'; x: number; y: number }
  | { type: 'thiefCaught'; x: number; y: number }
  | { type: 'thiefGone'; x: number; y: number }
  | { type: 'dawn'; share: number; xp: number }
  | { type: 'restGift' }
  | { type: 'heal'; v: number }
  | { type: 'note' }
  | { type: 'armour' }
  | { type: 'cave'; floor: number }
  | { type: 'floor'; floor: number }
  | { type: 'caveOut'; floor: number }
  | { type: 'story' }
  | { type: 'coach'; what: Coach; x: number; y: number };

const NO_EVENTS: readonly SimEvent[] = [];
const TAU = Math.PI * 2;
const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);
const turn = (a: number, b: number): number => ((((b - a) % TAU) + TAU * 1.5) % TAU) - Math.PI;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** the guardian's XP at land strength 1: half while it is struck, half when it is driven off */
const GUARD_XP = 300;
/** the cave's arena (u) and its mouth */
const CAVE_W = 22;
const CAVE_H = 15;
const CAVE_MOUTH: readonly [number, number] = [CAVE_W / 2, 1.2];
const CAVE_REWARD = [1, 1, 1.5, 2] as const;

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
 * 3, 6 s in a 40 s test); then Proca / Harfa pairs (26 ± 4 s and 22 ± 3 s, scaled to end on time,
 * jittered only when there is room) ending with a Harfa, leaving the last stretch at the end.  No
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

/** The sling's multiplier for a level: ×1 below the threshold (never less), ×2 at it, up to ×4, in halves. */
export function multFor(level: number): number {
  if (!(level >= 0.5)) return 1;
  const m = RULES.multAt + (RULES.multMax - RULES.multAt) * clamp((level - 0.5) / 0.5);
  return Math.round(m * 2) / 2;
}

/** The whirl's speed (turns per second) for a level. */
export const spinFor = (level: number): number => RULES.spinBase + RULES.spinExtra * clamp(level);

/** A land's quest chain (the story's in the first circle; a short one later). */
export const questsOf = (landIdx: number): readonly QuestSpec[] => {
  const { spec, circle } = landAt(landIdx);
  return circle === 0 ? QUESTS[spec.id] : circleQuests(spec);
};

/** David's numbers from his level, the abilities, the weapons and the party. */
export interface Stats { dmg: number; hp: number; cdK: number; speed: number; crit: number; double: number; triple: number; regen: number }

export function statsOf(p: DawidProgress, party: readonly CompanionId[]): Stats {
  const lv = (id: AbilityId) => abilityLevel(p, id);
  let bond = 0;
  for (const b of BONDS) if (b.members.every(m => party.includes(m))) bond += b.dmg;
  return {
    dmg: baseDmg(p.level) * (1 + ability('sila').per * lv('sila')) * (1 + bond),
    hp: Math.round(baseHp(p.level) * (1 + ability('zdrowie').per * lv('zdrowie'))),
    cdK: 1 - ability('tempo').per * lv('tempo'),
    speed: RULES.walk * (1 + ability('krok').per * lv('krok')),
    crit: RULES.crit + ability('celnosc').per * lv('celnosc'),
    double: ability('podwojny').per * lv('podwojny'),
    triple: ability('potrojny').per * lv('potrojny'),
    regen: RULES.regenPer * lv('oddech'),
  };
}

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: DawidProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

export class DawidSim {
  readonly p: DawidProgress;
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
  private storyQueue: Story[] = [];

  // the world
  land: LandSpec;
  landIdx: number;
  circle: number;
  k: number;
  bounds = { x0: 0, y0: 0, x1: 64, y1: 42 };
  viewHW: number = RULES.viewHalf[0];
  viewHH: number = RULES.viewHalf[1];
  readonly david: David;
  readonly lamb: Lamb;
  readonly mates: Mate[] = [];
  readonly beasts: Beast[] = [];
  dens: Den[] = [];
  readonly coins: Coin[] = [];
  readonly shots: Shot[] = [];
  nodes: Node[] = [];
  readonly chests: Chest[] = [];
  readonly zones: Zone[] = [];
  readonly prints: Print[] = [];
  readonly puffs: Puff[] = [];
  readonly rings: Ring[] = [];
  readonly notes: Note[] = [];
  guard: Guard;
  thief: Thief | null = null;
  cave: Cave | null = null;
  private stash: { coins: Coin[] } | null = null;

  // input and motion
  mode: Mode = 'none';
  goal = { x: 0, y: 0 };
  private stick = { x: 0, y: 0 };
  private readonly held = new Set<string>();
  private walkDir = 0;
  inCamp = false;
  campTab: CampTab = 'ab';

  // the band
  reliable = false;
  level = 0;
  calm = 0;
  calmShown = 0;
  /** the drawn whirl's level (smoothed), its angle, the multiplier now */
  whirl = 0;
  spinA = 0;
  mult = 1;
  ringLook: RingLook = 'base';
  charge = 0;
  stoneReady = false;
  private readyT = 0;
  private stonesBlock = 0;
  private goodT = 0;
  private goodSaid = false;
  private gold4Said = false;
  maxHold = 0;
  private relSec = 0;
  private blockXp = 0;

  // the bag and timers
  bag = { silver: 0, wood: 0, stone: 0 };
  private bagFullSaid = false;
  private slingT = 0;
  private extra: { at: number }[] = [];
  private weaponT: Partial<Record<WeaponId, number>> = {};
  private chestT = 0;
  private thiefT: number = RULES.thiefFirst;
  private giftT: number = RULES.giftFirst;
  private foldAcc = 0;
  private stepD = 0;
  private stepT = 0;
  private lastPx = 0;
  private lastPy = 0;
  private noteT = 0;
  private nearSaid = 0;
  shieldT = 0;
  stop = 0;
  timeScale = 1;
  private uid = 1;
  stats: Stats;

  // the session's tallies
  score = 0;
  driven = 0;
  stones = 0;
  questsDone = 0;
  silverIn = 0;
  passedRests = 0;
  blindShare = -1;
  thieves = 0;
  guardsNow: GuardKind[] = [];
  fellNow: GuardKind[] = [];
  joinedNow: CompanionId[] = [];
  landsNow: number[] = [];
  floorsNow = 0;
  private tensSaid = false;
  private settled = false;
  private readonly levelBefore: number;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  private readonly bestBefore: number | null;

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
    this.levelBefore = p.level;
    this.session = p.sessions + 1;
    this.pushesBase = p.pushes;
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng);
    this.talk = new Talk(LINES, init.rng);
    fillParty(p);
    this.stats = statsOf(p, partyNow(p));
    const L = landAt(p.land);
    this.land = L.spec;
    this.landIdx = L.idx;
    this.circle = L.circle;
    this.k = landK(p.land);
    this.david = { x: 0, y: 0, mx: 0, my: 0, face: 0, hp: this.stats.hp, max: this.stats.hp, safe: 0, down: 0, hit: 0, sit: 0, walked: 0, slow: 0, armour: 0, unhurt: 0 };
    this.lamb = { x: 0, y: 0, face: 1, walking: 0 };
    this.guard = this.makeGuard();
    this.setupLand();
  }

  // ── views of the state ──────────────────────────────────────────
  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.phase === 'play'; }
  get pushBlock(): boolean { return this.block?.kind === 'push' && this.phase === 'play'; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.phase === 'play'; }
  get warmBlock(): boolean { return this.block?.kind === 'warmup' && this.phase === 'play'; }
  /** a sighted push past its lead-in: the whirl answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get leadIn(): number { return this.lead; }
  /** the world is held (a story card on screen; one still waiting to show lets the world run — a giant's fall plays first) */
  get frozen(): boolean { return !!this.story && this.story.t >= 0; }
  /** David sits by the fire (a rest block): no walking, no throwing */
  get sitting(): boolean { return this.restBlock && this.blockT >= RULES.sitDelay; }
  get quests(): readonly QuestSpec[] { return questsOf(this.p.land); }
  get quest(): QuestSpec | null { return this.quests[this.p.quest] ?? null; }
  get bagLoad(): number { return this.bag.silver + (this.bag.wood + this.bag.stone) * RULES.matWeight; }
  get bagCap(): number { return bagCap(this.p); }
  get bagFull(): boolean { return this.bagLoad >= this.bagCap - 0.5; }
  get levelProgress(): number { return clamp(this.p.xp / xpNeed(this.p.level)); }
  get restedShare(): number { return clamp(this.p.rested / xpNeed(this.p.level), 0, RULES.restedCap); }
  get guardActive(): boolean { return this.quest?.kind === 'guard' && !this.cave; }
  get gateOpen(): boolean { return this.quest?.kind === 'gate'; }
  get guardFighting(): boolean { return ['wake', 'move', 'tele', 'act', 'daze'].includes(this.guard.state) && !this.cave; }
  get campX(): number { return this.cave ? CAVE_MOUTH[0] : this.land.camp[0]; }
  get campY(): number { return this.cave ? CAVE_MOUTH[1] : this.land.camp[1]; }
  get inCave(): boolean { return !!this.cave; }

  private makeGuard(): Guard {
    const spec = GUARDS[this.land.guard];
    const max = guardHp(this.p.land);
    const xp = Math.round(GUARD_XP * this.k);
    const [hx, hy] = this.land.lair;
    const qs = this.quests, gi = qs.findIndex(q => q.kind === 'guard');
    const gone = gi >= 0 && this.p.quest > gi;
    return {
      kind: spec.kind, spec, name: guardName(spec.kind, this.circle), state: gone ? 'gone' : 'sleep', st: 0, dur: 0,
      x: hx, y: hy, hx, hy, face: Math.PI, r: spec.r, hp: Math.max(1, max - this.p.wounds), max, atk: spec.atk * this.k, xp,
      pattern: null, zone: null, ax: 0, ay: 0, x0: 0, y0: 0, hit: 0, bearerA: Math.PI, bite: 0, fall: 0, taunt: '', tauntT: 0,
    };
  }

  /** The land's map comes alive: dens full of beasts, heaps, the chest; David just outside the camp. */
  private setupLand(): void {
    const L = this.land;
    this.bounds = { x0: 0.6, y0: 0.6, x1: L.w - 0.6, y1: L.h - 0.6 };
    this.beasts.length = 0;
    this.coins.length = 0;
    this.shots.length = 0;
    this.zones.length = 0;
    this.chests.length = 0;
    this.thief = null;
    this.dens = L.camps.map(([kind, x, y, n]) => ({
      kind, x, y, n, k: this.k * (1 + dist(x, y, L.camp[0], L.camp[1]) / RULES.campDist), wait: [] as number[],
    }));
    this.dens.forEach((d, i) => { for (let j = 0; j < d.n; j++) this.spawnBeast(i, false); });
    this.nodes = L.nodes.map(([kind, x, y]) => ({ kind, x, y, back: 0 }));
    this.chests.push(this.landChest());
    const d = this.david;
    d.x = L.camp[0] + RULES.campR + 0.8;
    d.y = L.camp[1] + 0.4;
    d.face = 0;
    this.lastPx = d.x;
    this.lastPy = d.y;
    this.lamb.x = d.x - 1;
    this.lamb.y = d.y + 0.3;
    this.placeMates();
    this.inCamp = false;
    this.mode = 'none';
  }

  private placeMates(): void {
    this.mates.length = 0;
    partyNow(this.p).forEach((id, i) => {
      const s = companionSpec(id), a = Math.PI * (0.6 + 0.4 * i);
      this.mates.push({ id, kit: s.kit, x: this.david.x + Math.cos(a) * 1.5, y: this.david.y + Math.sin(a) * 1.1, face: 1, cd: s.cd * 0.5 + i, act: 0, walking: 0, tx: 0, ty: 0 });
    });
  }

  private landChest(): Chest {
    const [x, y] = this.land.chest;
    return { id: this.uid++, kind: 'land', x, y, t: 0, life: Infinity, silver: Math.round(25 * this.k * (1 + this.circle)), wood: 3, stone: 3, xp: Math.round(10 * this.k) };
  }

  private spawnBeast(den: number, fresh = true, cave?: { kind: BeastKind; x: number; y: number; k: number }): Beast {
    const d = this.dens[den];
    const kind = cave ? cave.kind : d.kind;
    const spec = BEASTS[kind];
    const k = cave ? cave.k : d.k;
    const a = this.rng() * TAU, rr = this.rng() * 1.4;
    const hx = cave ? cave.x : d.x + Math.cos(a) * rr, hy = cave ? cave.y : d.y + Math.sin(a) * rr * 0.8;
    const b: Beast = {
      id: this.uid++, kind, spec, den: cave ? -1 : den, x: hx, y: hy, kx: 0, ky: 0, hx, hy,
      hp: spec.hp * k, max: spec.hp * k, atk: spec.atk * k, xp: spec.xp * k, silver: spec.silver * k, speed: spec.speed, r: spec.r,
      state: this.restBlock ? 'doze' : 'idle', st: this.rng() * 2, bite: 0, cd: 1 + this.rng() * 2, ax: hx, ay: hy, hit: 0,
      hidden: spec.habit === 'ambush', air: spec.flies ? 1.1 : 0, taunt: 0, age: fresh ? 0 : 1, face: this.rng() < 0.5 ? -1 : 1, flee: 0, fx: 0, fy: 0,
    };
    this.beasts.push(b);
    return b;
  }

  // ── input ───────────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.refreshStats(true);
    if (this.session === 1) this.showStory({ kind: 'open', t: 0, dur: RULES.openSec, title: t('story.open.title'), text: t('story.open.text'), verse: '1sa17.37' });
    this.startBlock(0);
    this.talk.ask('open', 3, 12);
    this.emit({ type: 'quest', index: this.p.quest });
    this.checkQuest();
  }

  /** The view's size in u (what is in sight). */
  setView(halfW: number, halfH: number): void {
    if (halfW > 1 && halfH > 1) {
      this.viewHW = halfW;
      this.viewHH = halfH;
    }
  }

  /** The joystick: a direction with a strength (each −1..1, length ≤ 1); any steering ends the hunt. */
  steer(x: number, y: number): void {
    const l = Math.hypot(x, y);
    this.stick = l > 1 ? { x: x / l, y: y / l } : { x, y };
    if (l > 0.05) this.mode = 'none';
  }

  /**
   * A tap on the field at a world point (u), or with no point: closes a story card that has been read;
   * throws a ready great stone; near David (or with no point) sends him hunting; farther, walks him there
   * (then he hunts).  While he sits by the fire, a tap does nothing.  True when it did something.
   */
  tap(wx?: number, wy?: number): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= 0.6) this.closeStory();
      return true;
    }
    if (this.david.down > 0 || this.sitting) return false;
    if (this.stoneReady && this.stoneTarget()) {
      this.throwGreat();
      return true;
    }
    const near = wx === undefined || wy === undefined || dist(wx, wy, this.david.x, this.david.y) <= RULES.tapNear;
    if (near) {
      this.mode = 'hunt';
      if (!this.p.seen.includes('hunted')) {
        this.p.seen.push('hunted');
        this.talk.ask('hunt', 2, 4);
      }
    } else {
      this.mode = 'go';
      this.goal = { x: clamp(wx!, this.bounds.x0, this.bounds.x1), y: clamp(wy!, this.bounds.y0, this.bounds.y1) };
    }
    return true;
  }

  /** The bag (or "to camp"): David walks home by himself. */
  goHome(): boolean {
    if (!this.started || this.story || this.david.down > 0 || this.sitting) return false;
    if (this.cave) { this.exitCave(); return true; }
    this.mode = 'home';
    return true;
  }

  /** Arrows and WASD walk; Space and Enter: a ready stone, else in camp the first tile you can, else the hunt. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const kk = k.toLowerCase();
    const dirs = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'];
    if (dirs.includes(kk)) {
      if (down) {
        this.held.add(kk);
        this.mode = 'none';
      } else this.held.delete(kk);
      return true;
    }
    if (!down) return k === ' ' || k === 'Enter';
    if (k === ' ' || k === 'Enter' || k === 'Spacebar') {
      if (this.story || this.stoneReady || !this.inCamp) {
        this.tap();
        return true;
      }
      const tiles = this.tiles();
      const i = tiles.findIndex(x => x.why === 'ok');
      if (i >= 0) this.campTap(i);
      else this.tap();
      return true;
    }
    if (this.inCamp && ['1', '2', '3', '4'].includes(k)) {
      this.setTab((['ab', 'bd', 'wp', 'party'] as const)[Number(k) - 1]);
      return true;
    }
    return false;
  }

  /** Let go of everything (pause). */
  release(): void {
    this.held.clear();
    this.stick = { x: 0, y: 0 };
  }

  private showStory(s: Story): void {
    if (this.story) this.storyQueue.push(s);
    else {
      this.story = s;
      this.talk.clear();
      this.emit({ type: 'story' });
    }
  }

  private closeStory(): void {
    const then = this.story?.then;
    this.story = this.storyQueue.shift() ?? null;
    if (this.story) this.emit({ type: 'story' });
    if (then === 'armour') {
      this.david.armour = 4;
      this.emit({ type: 'armour' });
    }
  }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.stop = Math.max(0, this.stop - dt);
    if (this.story) {
      this.story.t += dt;
      if (this.story.t >= this.story.dur) this.closeStory();
    }
    this.timeScale = this.frozen || this.stop > 0 ? 0 : 1;
    const w = dt * this.timeScale;
    this.brain(dt, w, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.endFinale();
    if (w > 0 && this.phase !== 'done') {
      this.moveDavid(w);
      this.moveParty(w);
      this.denLife(w);
      this.moveBeasts(w);
      this.guardAI(w);
      this.weapons(w);
      this.kits(w);
      this.moveShots(w);
      this.pickups(w);
      this.surprises(w);
      this.campLife(w);
      this.caveLife(w);
      this.checkQuest();
    }
    this.fx(dt, w);
    this.talk.update(dt, t, this.talkBlocked);
  }

  get talkBlocked(): boolean {
    const b = this.block;
    const tele = this.phase === 'play' && b && this.blockT >= b.dur - RULES.telegraph;
    const banner = this.phase === 'play' && this.blockT < RULES.bannerSec && this.blockIndex > 0;
    return !!(tele || banner || this.story || this.hush);
  }

  /** the index sets this while the runner's coach mark is on screen (the lamb waits) */
  hush = false;

  /** The band's slow quantities: the whirl and its multiplier, the great stone from the hold; calm's healing and rested XP; footprints. */
  private brain(dt: number, w: number, f: FocusFrame): void {
    const R = RULES, b = this.block;
    const play = this.phase === 'play';
    this.reliable = f.reliable;
    this.level = f.reliable ? f.level : 0;
    this.calm = f.reliable ? f.calm : 0;
    this.calmShown = approach(this.calmShown, this.calm, dt, 0.6);
    if (play && f.reliable) this.relSec += dt;
    const live = this.sighted && f.reliable;
    this.whirl = approach(this.whirl, live ? f.level : 0, dt, R.whirlTau);
    this.mult = live ? multFor(f.level) : 1;
    this.spinA += TAU * (live ? spinFor(this.whirl) : this.sitting ? 0 : R.spinBase) * w;
    this.ringLook = !play ? 'base' : b.kind === 'rest' ? 'rest' : b.kind !== 'push' ? 'base' : b.blind ? 'night' : this.blockT < this.lead ? 'wait' : f.reliable ? 'live' : 'grey';
    if (live) this.maxHold = Math.max(this.maxHold, f.hold);
    if (live && f.hold >= this.holdNeed) this.addCharge(R.holdRate * dt);
    if (live && f.level >= 0.5) this.goodT += dt;
    else this.goodT = 0;
    if (this.goodT >= R.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 4);
    }
    if (live && this.mult >= R.multMax && !this.gold4Said) {
      this.gold4Said = true;
      this.talk.ask('gold4', 2, 3);
    }
    if (live && this.blockT >= this.lead + 0.5) this.coach('sling', this.david.x, this.david.y);
    // the harp by the fire: calm heals the party and fills rested XP
    if (play && b.kind === 'rest' && this.blockT >= this.restLead && f.reliable && this.david.down <= 0) {
      const d = this.david, before = d.hp;
      d.hp = Math.min(d.max, d.hp + R.heal * WELL_K[buildingLevel(this.p, 'studnia')] * f.calm * d.max * dt);
      if (Math.floor((d.hp / d.max) * 10) > Math.floor((before / d.max) * 10)) this.emit({ type: 'heal', v: d.hp });
      const need = xpNeed(this.p.level);
      this.p.rested = Math.min(need * R.restedCap, this.p.rested + R.rested * f.calm * need * dt);
    }
    if (this.sitting) {
      this.noteT -= dt;
      if (this.noteT <= 0) {
        this.noteT = 0.55 + this.rng() * 0.35;
        this.notes.push({ x: this.david.x + 0.4, y: this.david.y - 1.2, t: 0, n: Math.floor(this.rng() * 5) });
        this.emit({ type: 'note' });
      }
    }
    // the great stone waits for a tap; after a while it goes by itself
    if (this.stoneReady && w > 0) {
      this.readyT += w;
      if (this.readyT >= R.stoneAuto && this.stoneTarget()) this.throwGreat();
    }
    // footprints: the band's history on the ground
    const d = this.david;
    this.stepD += dist(d.x, d.y, this.lastPx, this.lastPy);
    this.lastPx = d.x;
    this.lastPy = d.y;
    this.stepT += w;
    if (w > 0 && (this.stepD >= R.stepU || this.stepT >= R.stepSec)) {
      this.stepD = 0;
      this.stepT = 0;
      const phase = !play ? 'free' : b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
      const above = f.reliable && (phase === 'rest' ? f.calm >= 0.5 && !f.focused : f.level >= 0.5) && (phase !== 'focus' || this.blockT >= this.lead);
      const side = this.prints.length % 2 === 0;
      const a = d.face + Math.PI / 2;
      this.prints.push({ x: d.x + Math.cos(a) * (side ? 0.11 : -0.11), y: d.y + Math.sin(a) * (side ? 0.11 : -0.11), t: this.t, above, phase, veiled: this.blind, left: side });
    }
    while (this.prints.length && this.t - this.prints[0].t > R.stepKeep) this.prints.shift();
  }

  private addCharge(v: number): void {
    if (this.stoneReady || !(v > 0) || this.stonesBlock >= RULES.stonesPerBlock) return;
    this.charge = Math.min(1, this.charge + v);
    if (this.charge >= 1 - 1e-9) {
      this.charge = 1;
      this.stoneReady = true;
      this.readyT = 0;
      this.emit({ type: 'stoneReady' });
      this.talk.ask('stoneReady', 3, 4);
      this.coach('stone', this.david.x, this.david.y - 1);
    }
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
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('harp', this.david.x, this.david.y);
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
    this.blockXp = 0;
    this.judge.reset();
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.goodT = 0;
      this.goodSaid = false;
      this.gold4Said = false;
      this.stonesBlock = 0;
      this.wakeAll();
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
    } else if (b.kind === 'rest') {
      this.dozeAll();
      this.talk.ask('rest', 2, 12);
    } else {
      this.talk.ask('warm', 1, 8);
      this.coach('move', this.david.x, this.david.y);
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
        if (b.blind) {
          // dawn: the moonless night's share above the threshold, paid now
          const s = this.judge.measured > 0 ? share : 0;
          this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
          for (const pr of this.prints) pr.veiled = false;
          const xp = Math.round(this.blockXp * 2 * s);
          if (xp > 0) this.gainXp(xp, this.david.x, this.david.y - 1);
          this.addCharge(s);
          this.emit({ type: 'dawn', share: s, xp });
          this.talk.ask('dawn', 3, 5);
        }
      } else {
        // dawn after the harp: the beasts get up (the next block may be the finale, not a push)
        this.wakeAll();
      }
      if (b.kind === 'rest' && verdict) {
        this.passedRests++;
        const need2 = xpNeed(this.p.level);
        this.p.rested = Math.min(need2 * RULES.restedCap, this.p.rested + RULES.restGift * need2);
        this.emit({ type: 'restGift' });
        this.talk.ask('restGift', 3, 5);
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  /** The harp: every beast lies down and dozes; the night brings the missing ones back to their dens. */
  private dozeAll(): void {
    this.mode = 'none';
    for (const b of this.beasts) if (b.state !== 'flee') { b.state = 'doze'; b.st = 0; b.taunt = 0; }
    this.zones.length = 0;
    if (!this.cave) {
      this.dens.forEach((d, i) => {
        const have = this.beasts.filter(b => b.den === i && b.state !== 'flee').length;
        for (let j = have; j < d.n; j++) {
          const b = this.spawnBeast(i, true);
          b.state = 'doze';
        }
        d.wait = [];
      });
    }
    const g = this.guard;
    if (['wake', 'move', 'tele', 'act', 'daze'].includes(g.state)) {
      g.state = 'home';
      g.zone = null;
    }
    this.thief = null;
  }

  private wakeAll(): void {
    for (const b of this.beasts) if (b.state === 'doze') { b.state = 'idle'; b.st = this.rng(); }
  }

  // ── David ───────────────────────────────────────────────────────
  private moveDavid(w: number): void {
    const d = this.david, R = RULES;
    d.safe = Math.max(0, d.safe - w);
    d.hit = Math.max(0, d.hit - w);
    d.slow = Math.max(0, d.slow - w);
    d.armour = Math.max(0, d.armour - w);
    d.unhurt += w;
    this.shieldT = Math.max(0, this.shieldT - w);
    d.sit = approach(d.sit, this.sitting ? 1 : 0, w, 0.25);
    if (d.down > 0) {
      d.down -= w;
      if (d.down <= 0) this.wake();
      return;
    }
    if (this.stats.regen > 0 && d.unhurt >= R.regenAfter && d.hp < d.max) d.hp = Math.min(d.max, d.hp + this.stats.regen * d.max * w);
    if (this.sitting) {
      d.mx = d.my = 0;
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
    } else if (Math.hypot(mx, my) < 0.05 && this.mode !== 'none') {
      const auto = this.autoStep();
      mx = auto.x;
      my = auto.y;
    }
    const m = Math.hypot(mx, my);
    d.mx = mx;
    d.my = my;
    if (m > 0.05) {
      const sp = this.stats.speed * (d.slow > 0 ? R.tauntSlow : 1) * (d.armour > 0 ? 0.25 : 1);
      d.x = clamp(d.x + mx * sp * w, this.bounds.x0, this.bounds.x1);
      d.y = clamp(d.y + my * sp * w, this.bounds.y0, this.bounds.y1);
      d.face = Math.atan2(my, mx);
      d.walked += w;
      this.walkDir = d.face;
      if (!this.p.seen.includes('moved') && this.mode === 'none') {
        this.p.seen.push('moved');
        this.coach('hunt', d.x, d.y);
      }
    }
  }

  /** The auto-pilot: hunt the nearest beasts (stepping out of red shapes), walk to a point, or home. */
  private autoStep(): { x: number; y: number } {
    const d = this.david;
    const toward = (x: number, y: number, stopAt = 0.35): { x: number; y: number } => {
      const dx = x - d.x, dy = y - d.y, l = Math.hypot(dx, dy);
      return l <= stopAt ? { x: 0, y: 0 } : { x: dx / l, y: dy / l };
    };
    // first: out of any telegraphed shape
    for (const z of this.zones) {
      if (z.live || !this.inZone(z, d.x, d.y, 0.3)) continue;
      if (z.kind === 'lane') {
        const nx = -Math.sin(z.a), ny = Math.cos(z.a);
        const side = (d.x - z.x) * nx + (d.y - z.y) * ny >= 0 ? 1 : -1;
        return { x: nx * side, y: ny * side };
      }
      const dx = d.x - z.x, dy = d.y - z.y, l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    }
    if (this.mode === 'home') {
      const s = toward(this.campX, this.campY, 1);
      if (s.x === 0 && s.y === 0) this.mode = 'none';
      return s;
    }
    if (this.mode === 'go') {
      const s = toward(this.goal.x, this.goal.y);
      if (s.x === 0 && s.y === 0) this.mode = 'hunt';
      return s;
    }
    // the hunt: a fighting guardian first (keep the sling's reach, flank the shield-bearer)
    const range = WEAPONS.proca.range;
    const g = this.guard;
    if (this.guardFighting) {
      const gd = dist(g.x, g.y, d.x, d.y), want = g.spec.giant ? range * 0.7 : range * 0.75;
      const a = Math.atan2(d.y - g.y, d.x - g.x);
      let mx = 0, my = 0;
      if (gd > want + 0.5) { mx = -Math.cos(a); my = -Math.sin(a); }
      else if (gd < want - 1) { mx = Math.cos(a); my = Math.sin(a); }
      if (g.spec.giant && this.blockedFrom(d.x, d.y)) { mx += -Math.sin(a) * 0.9; my += Math.cos(a) * 0.9; }
      const l = Math.hypot(mx, my);
      return l > 0.05 ? { x: mx / l, y: my / l } : { x: 0, y: 0 };
    }
    if (this.thief) {
      const th = this.thief;
      if (dist(th.x, th.y, d.x, d.y) < 10) return toward(th.x, th.y, range * 0.6);
    }
    // the quest's beasts first (as XP Hero's quest button leads), then whatever is near
    const want = this.quest?.kind === 'hunt' ? this.quest.what : undefined;
    let best: Beast | null = null, bd: number = RULES.huntSeek, close = false;
    for (const b of this.beasts) {
      if (b.state === 'flee' || b.state === 'doze' || b.hidden) continue;
      const dd = dist(b.x, b.y, d.x, d.y);
      const threat = dd < 3 && (b.state === 'chase' || b.state === 'tele' || b.state === 'dash');
      const fit = threat || !want || b.kind === want;
      if (fit && dd < bd) { bd = dd; best = b; close = threat; }
    }
    if (best) return bd > range * RULES.huntStand && !close ? toward(best.x, best.y) : { x: 0, y: 0 };
    // no beast near: the nearest den (of the quest's kind) with beasts at home
    const den = (want ? this.nearestDen(d.x, d.y, true, want) : null) ?? this.nearestDen(d.x, d.y, true);
    return den ? toward(den.x, den.y, range * 0.6) : { x: 0, y: 0 };
  }

  /** The nearest den (of a kind), preferring those with beasts at home. */
  private nearestDen(x: number, y: number, aliveOnly: boolean, kind?: string): Den | null {
    let best: Den | null = null, bd = Infinity;
    for (let i = 0; i < this.dens.length; i++) {
      const dn = this.dens[i];
      if (kind && kind !== 'any' && dn.kind !== kind) continue;
      const alive = this.beasts.some(b => b.den === i && b.state !== 'flee');
      if (aliveOnly && !alive) continue;
      const dd = dist(dn.x, dn.y, x, y) + (alive ? 0 : 20);
      if (dd < bd) { bd = dd; best = dn; }
    }
    return best;
  }

  /** David is down: the lamb tugs his sleeve; he wakes at the camp's fire, the bag whole. */
  private hurtDavid(v: number, x: number, y: number): void {
    const d = this.david;
    if (d.safe > 0 || d.down > 0 || this.shieldT > 0 || !(v > 0) || this.sitting) return;
    d.hp = Math.max(0, d.hp - v);
    d.safe = RULES.safe;
    d.hit = 0.25;
    d.unhurt = 0;
    this.emit({ type: 'hurt', x, y });
    if (d.hp <= 0) {
      d.down = RULES.downSec;
      this.mode = 'none';
      this.emit({ type: 'down' });
      this.talk.ask('down', 4, 3);
    } else if (d.hp <= d.max * 0.25 && this.t - this.nearSaid > 20) {
      this.nearSaid = this.t;
      this.talk.ask('near', 2, 3);
    }
  }

  private wake(): void {
    const d = this.david;
    d.down = 0;
    d.hp = d.max;
    d.safe = RULES.wakeSafe;
    if (this.cave) {
      this.exitCave();
    } else {
      d.x = this.land.camp[0] + 0.8;
      d.y = this.land.camp[1] + 1.2;
      this.lamb.x = d.x - 0.8;
      this.lamb.y = d.y + 0.3;
      for (const m of this.mates) { m.x = d.x + (this.rng() - 0.5) * 2; m.y = d.y + 1 + this.rng(); }
    }
    const g = this.guard;
    if (['wake', 'move', 'tele', 'act', 'daze'].includes(g.state)) { g.state = 'home'; g.zone = null; }
    this.zones.length = 0;
    for (const b of this.beasts) if (b.state === 'chase' || b.state === 'tele' || b.state === 'dash') b.state = 'home';
    this.emit({ type: 'wake' });
    this.talk.ask('wake', 3, 4);
  }

  // ── the lamb and the party ──────────────────────────────────────
  private moveParty(w: number): void {
    const d = this.david;
    const moving = Math.hypot(d.mx, d.my) > 0.05;
    const follow = (o: { x: number; y: number; face: number; walking: number }, tx: number, ty: number, sp: number) => {
      const dd = dist(o.x, o.y, tx, ty);
      o.walking = dd > 0.25 ? 1 : 0;
      if (dd > 0.05) {
        const s = Math.min(dd, (sp + dd) * w);
        if (Math.abs(tx - o.x) > 0.05) o.face = tx > o.x ? 1 : -1;
        o.x += ((tx - o.x) / dd) * s;
        o.y += ((ty - o.y) / dd) * s;
      }
      if (dd > 9) { o.x = tx; o.y = ty; }
    };
    const back = moving ? this.walkDir + Math.PI : Math.PI * 0.75;
    if (this.sitting) follow(this.lamb, d.x - 0.7, d.y + 0.35, 3);
    else follow(this.lamb, d.x + Math.cos(back) * 0.95, d.y + Math.sin(back) * 0.7 + 0.15, this.stats.speed * 1.05);
    this.mates.forEach((m, i) => {
      if (m.act > 0) m.act = Math.max(0, m.act - w);
      if (m.kit === 'dash' && m.act > 0.6) return;   // Asahel mid-dash
      if (m.kit === 'stand' && m.act > 0) return;    // Shammah stands his ground
      const n = this.mates.length;
      const a = this.sitting ? (i / Math.max(1, n)) * TAU + 0.6 : back + (i - (n - 1) / 2) * 0.9;
      const r = this.sitting ? 1.4 : 1.55 + 0.25 * i;
      follow(m, d.x + Math.cos(a) * r, d.y + Math.sin(a) * r * 0.75, this.stats.speed * 1.08);
    });
  }

  // ── dens and beasts ─────────────────────────────────────────────
  /** A den refills a missing beast after the kind's respawn time, out of David's way. */
  private denLife(w: number): void {
    if (this.cave || this.restBlock) return;
    const d = this.david;
    this.dens.forEach((den, i) => {
      const have = this.beasts.filter(b => b.den === i).length;
      while (den.wait.length < den.n - have) den.wait.push(BEASTS[den.kind].respawn);
      for (let j = den.wait.length - 1; j >= 0; j--) {
        den.wait[j] -= w;
        if (den.wait[j] <= 0 && dist(den.x, den.y, d.x, d.y) > RULES.respawnFar) {
          den.wait.splice(j, 1);
          this.spawnBeast(i, true);
        }
      }
    });
  }

  private moveBeasts(w: number): void {
    const d = this.david, R = RULES;
    const awake = !this.restBlock && d.down <= 0 && !this.inCampCircle(d.x, d.y);
    for (let i = this.beasts.length - 1; i >= 0; i--) {
      const b = this.beasts[i];
      b.age += w;
      b.hit = Math.max(0, b.hit - w);
      b.bite = Math.max(0, b.bite - w);
      b.cd = Math.max(0, b.cd - w);
      b.taunt = Math.max(0, b.taunt - w);
      b.st += w;
      // knockback
      if (b.kx || b.ky) {
        b.x += b.kx * w;
        b.y += b.ky * w;
        const k = Math.exp(-R.knockDrag * w);
        b.kx *= k;
        b.ky *= k;
        if (Math.abs(b.kx) + Math.abs(b.ky) < 0.05) b.kx = b.ky = 0;
      }
      if (b.state === 'flee') {
        b.flee += w;
        b.x += b.fx * R.fleeSpeed * w;
        b.y += b.fy * R.fleeSpeed * w;
        if (b.flee >= R.fleeSec) this.beasts.splice(i, 1);
        continue;
      }
      if (b.state === 'doze') continue;
      if (b.state === 'stun') {
        if (b.st >= 2) { b.state = 'chase'; b.st = 0; }
        continue;
      }
      const dd = dist(b.x, b.y, d.x, d.y);
      const homeD = dist(b.x, b.y, b.hx, b.hy);
      // the target: David, or Shammah while he draws them
      let tx = d.x, ty = d.y;
      if (b.taunt > 0) {
        const s = this.mates.find(m => m.kit === 'stand');
        if (s) { tx = s.x; ty = s.y; }
      }
      const td = dist(b.x, b.y, tx, ty);
      switch (b.state) {
        case 'idle': {
          if (b.hidden && dd < b.spec.aggro && awake) { b.hidden = false; b.state = 'chase'; b.st = 0; b.cd = 0; break; }
          if (!b.hidden && awake && dd < b.spec.aggro) { b.state = 'chase'; b.st = 0; break; }
          // wander about the den
          if (b.st > 1.5 + (b.id % 5) * 0.4) {
            b.st = 0;
            const a = this.rng() * TAU, r = this.rng() * 1.6;
            b.ax = b.hx + Math.cos(a) * r;
            b.ay = b.hy + Math.sin(a) * r * 0.8;
          }
          this.stepTo(b, b.ax, b.ay, b.speed * (b.spec.habit === 'swarm' ? 0.8 : 0.3), w);
          break;
        }
        case 'home': {
          this.stepTo(b, b.hx, b.hy, b.speed * 0.9, w);
          b.hp = Math.min(b.max, b.hp + b.max * 0.25 * w);
          if (homeD < 0.4) { b.state = 'idle'; b.st = 0; if (b.spec.habit === 'ambush') b.hidden = true; }
          break;
        }
        case 'back': {
          // the hyena's hit-and-run, a boar after its charge
          const ax = b.x - tx, ay = b.y - ty, l = Math.hypot(ax, ay) || 1;
          b.x += (ax / l) * b.speed * 0.8 * w;
          b.y += (ay / l) * b.speed * 0.8 * w;
          if (b.st > 0.9) { b.state = 'chase'; b.st = 0; }
          break;
        }
        case 'chase': {
          if (!awake && b.taunt <= 0) { b.state = 'home'; break; }
          if (homeD > R.leash) { b.state = 'home'; break; }
          const habit = b.spec.habit;
          const reach = b.r + R.davidR + 0.12;
          if ((habit === 'lunge' && td < 2.8 && td > 1.2) || (habit === 'charge' && td < 5.2 && td > 1.6) || (habit === 'leap' && td < 3.4 && td > 1.2) || (habit === 'swoop' && td < 4.2 && td > 1.4)) {
            if (b.cd <= 0 && b.taunt <= 0) {
              b.state = 'tele';
              b.st = 0;
              b.ax = tx;
              b.ay = ty;
              b.face = tx >= b.x ? 1 : -1;
              const tele = habit === 'charge' ? 0.65 : habit === 'leap' ? 0.45 : habit === 'swoop' ? 0.6 : 0.35;
              b.cd = tele;
              if (habit === 'charge' || habit === 'swoop') {
                const a = Math.atan2(ty - b.y, tx - b.x);
                this.zones.push({ id: b.id, kind: 'lane', x: b.x, y: b.y, a, len: habit === 'charge' ? 6 : 5.5, w: b.r * 2 + 0.3, t: 0, dur: tele, live: false, small: true });
              } else if (habit === 'leap') this.zones.push({ id: b.id, kind: 'circle', x: tx, y: ty, a: 0, len: 0, w: 0.75, t: 0, dur: tele, live: false, small: true });
              break;
            }
          }
          if (habit === 'swarm') {
            // hornets: erratic about the target
            const a = b.st * 3 + b.id;
            this.stepTo(b, tx + Math.cos(a) * 0.6, ty + Math.sin(a * 1.3) * 0.5, b.speed, w);
          } else if (habit === 'swoop' && td < 1.4) {
            this.stepTo(b, tx + Math.cos(b.st) * 2.4, ty + Math.sin(b.st) * 1.8, b.speed, w);
          } else if (td > reach) this.stepTo(b, tx, ty, b.speed, w);
          if (td <= reach + 0.05 && b.bite <= 0 && b.taunt <= 0) {
            b.bite = R.biteSec;
            this.hurtDavid(b.atk, b.x, b.y);
            if (habit === 'skirmish') { b.state = 'back'; b.st = 0; }
          }
          break;
        }
        case 'tele': {
          if (b.st >= b.cd) {
            b.state = 'dash';
            b.st = 0;
            const z = this.zones.find(z2 => z2.id === b.id);
            if (z) z.live = true;
            const habit = b.spec.habit;
            b.cd = habit === 'charge' ? 0.8 : habit === 'leap' ? 0.35 : habit === 'swoop' ? 0.6 : 0.3;
            if (habit === 'charge' || habit === 'swoop') {
              const a = Math.atan2(b.ay - b.y, b.ax - b.x), len = habit === 'charge' ? 6 : 5.5;
              b.ax = b.x + Math.cos(a) * len;
              b.ay = b.y + Math.sin(a) * len;
            }
            b.fx = b.x;
            b.fy = b.y;
          }
          break;
        }
        case 'dash': {
          const k = clamp(b.st / b.cd);
          const nx = b.fx + (b.ax - b.fx) * k, ny = b.fy + (b.ay - b.fy) * k;
          b.x = nx;
          b.y = ny;
          if (b.spec.habit === 'leap') b.air = Math.sin(k * Math.PI) * 0.9;
          if (dist(b.x, b.y, d.x, d.y) < b.r + R.davidR + 0.15 && b.bite <= 0 && b.taunt <= 0) {
            b.bite = R.biteSec;
            this.hurtDavid(b.atk * (b.spec.habit === 'charge' ? 2 : 1.4), b.x, b.y);
          }
          if (k >= 1) {
            const zi = this.zones.findIndex(z2 => z2.id === b.id);
            if (zi >= 0) this.zones.splice(zi, 1);
            if (b.spec.habit === 'leap') b.air = 0;
            b.cd = b.spec.habit === 'charge' ? 4 : b.spec.habit === 'swoop' ? 3.5 : 2.6;
            if (b.spec.habit === 'charge') { b.state = 'stun'; b.st = 1; }
            else { b.state = 'chase'; b.st = 0; }
          }
          break;
        }
        default: break;
      }
      if (b.spec.flies && b.spec.habit !== 'leap') b.air = 1.1 + Math.sin(this.t * 3 + b.id) * 0.12;
      b.x = clamp(b.x, this.bounds.x0, this.bounds.x1);
      b.y = clamp(b.y, this.bounds.y0, this.bounds.y1);
    }
    // the camp is safe ground: beasts stay outside it
    if (!this.cave) for (const b of this.beasts) {
      const dx = b.x - this.land.camp[0], dy = b.y - this.land.camp[1], l = Math.hypot(dx, dy);
      if (l < RULES.campR && l > 0.01 && b.state !== 'flee') {
        b.x = this.land.camp[0] + (dx / l) * RULES.campR;
        b.y = this.land.camp[1] + (dy / l) * RULES.campR;
        if (b.state === 'chase') b.state = 'home';
      }
    }
  }

  private stepTo(b: Beast, x: number, y: number, sp: number, w: number): void {
    const dx = x - b.x, dy = y - b.y, l = Math.hypot(dx, dy);
    if (l < 0.02) return;
    const s = Math.min(l, sp * w);
    b.x += (dx / l) * s;
    b.y += (dy / l) * s;
    if (Math.abs(dx) > 0.05) b.face = dx > 0 ? 1 : -1;
  }

  private inCampCircle(x: number, y: number): boolean {
    return !this.cave && dist(x, y, this.land.camp[0], this.land.camp[1]) < RULES.campR;
  }

  /** Strike a beast: its spirit drops; at none it loses heart and runs off into the hills, dropping XP and silver. */
  private strike(b: Beast, dmg: number, mult: number, fromX: number, fromY: number, knock: number = RULES.knock, crit = false): void {
    if (b.state === 'flee' || !(dmg > 0)) return;
    b.hp -= dmg;
    b.hit = 0.15;
    b.hidden = false;
    if (b.state === 'idle' || b.state === 'doze' || b.state === 'home') { b.state = 'chase'; b.st = 0; }
    const a = Math.atan2(b.y - fromY, b.x - fromX);
    b.kx += Math.cos(a) * knock;
    b.ky += Math.sin(a) * knock;
    this.emit({ type: 'hit', x: b.x, y: b.y, dmg, gold: mult > 1, crit, guard: false });
    if (b.hp <= 0) this.drive(b, mult);
  }

  private drive(b: Beast, mult: number): void {
    b.state = 'flee';
    b.flee = 0;
    const d = this.david;
    const a = Math.atan2(b.y - d.y, b.x - d.x) + (this.rng() - 0.5) * 0.6;
    b.fx = Math.cos(a);
    b.fy = Math.sin(a);
    const zi = this.zones.findIndex(z => z.id === b.id);
    if (zi >= 0) this.zones.splice(zi, 1);
    const xp = this.gainXp(b.xp * mult, b.x, b.y - 0.8, true);
    this.dropCoins(b.x, b.y, 'silver', b.silver);
    this.driven++;
    this.p.tally[b.kind] = (this.p.tally[b.kind] ?? 0) + 1;
    this.puffs.push({ x: b.x, y: b.y, t: 0, kind: b.kind, dir: b.fx >= 0 ? 1 : -1, air: b.air });
    this.emit({ type: 'driven', x: b.x, y: b.y, kind: b.kind, xp, mult });
    const q = this.quest;
    if (q?.kind === 'hunt' && (q.what === b.kind || q.what === 'any')) this.p.questN++;
    if (this.cave && !this.beasts.some(x => x.state !== 'flee')) this.floorCleared();
  }

  /** Silver (or brushwood, or stone) bursts out and lies on the grass until it flies into the bag. */
  private dropCoins(x: number, y: number, kind: CoinKind, total: number): void {
    if (!(total > 0)) return;
    const n = kind === 'silver' ? Math.max(1, Math.min(5, Math.round(Math.sqrt(total)))) : Math.max(1, Math.round(total));
    const each = kind === 'silver' ? total / n : 1;
    for (let i = 0; i < n && this.coins.length < RULES.coinCap; i++) {
      const a = this.rng() * TAU, s = 1.2 + this.rng() * 1.8;
      this.coins.push({ id: this.uid++, kind, v: each, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, z: 0.2, vz: 3 + this.rng() * 2, t: 0, pulled: false });
    }
  }

  // ── the guardian ────────────────────────────────────────────────
  /** Whether the shield-bearer covers Goliath from a throw at (x, y). */
  blockedFrom(x: number, y: number): boolean {
    const g = this.guard;
    if (!g.spec.giant || g.state === 'daze' || g.state === 'sleep' || g.state === 'driven' || g.state === 'gone') return false;
    return Math.abs(turn(g.bearerA, Math.atan2(y - g.y, x - g.x))) < 0.62;
  }

  /** Where the shield-bearer stands (u). */
  get bearer(): { x: number; y: number } {
    const g = this.guard;
    return { x: g.x + Math.cos(g.bearerA) * RULES.bearerAhead, y: g.y + Math.sin(g.bearerA) * RULES.bearerAhead * 0.8 };
  }

  private guardAI(w: number): void {
    const g = this.guard, d = this.david, R = RULES;
    if (this.cave || g.state === 'gone') return;
    g.st += w;
    g.hit = Math.max(0, g.hit - w);
    g.bite = Math.max(0, g.bite - w);
    g.tauntT = Math.max(0, g.tauntT - w);
    const dd = dist(g.x, g.y, d.x, d.y);
    const pace = 1 + 0.12 * Math.min(4, this.circle);
    // the shield-bearer turns toward David (not while Goliath reels)
    if (g.spec.giant && g.state !== 'daze') {
      const want = Math.atan2(d.y - g.y, d.x - g.x);
      const diff = turn(g.bearerA, want);
      g.bearerA += Math.sign(diff) * Math.min(Math.abs(diff), 0.85 * w);
    }
    switch (g.state) {
      case 'sleep':
        if (this.guardActive && !this.restBlock && d.down <= 0 && dist(g.hx, g.hy, d.x, d.y) < R.guardWake) {
          g.state = 'wake';
          g.st = 0;
          this.emit({ type: 'guardWake', kind: g.kind });
          this.talk.ask(g.kind === 'lew' ? 'lion' : g.kind === 'niedzwiedzica' ? 'bear' : g.spec.giant ? 'goliath' : 'guard', 4, 4);
          this.coach('guard', g.x, g.y);
          if (g.spec.giant) this.coach('bearer', g.x, g.y);
        }
        return;
      case 'wake':
        g.face = d.x >= g.x ? 0 : Math.PI;
        if (g.st >= 1) { g.state = 'move'; g.st = 0; g.dur = R.guardRest[0] + this.rng() * (R.guardRest[1] - R.guardRest[0]); }
        return;
      case 'home': {
        const l = dist(g.x, g.y, g.hx, g.hy);
        if (l < 0.3) { g.state = 'sleep'; g.st = 0; return; }
        g.x += ((g.hx - g.x) / l) * Math.min(l, g.spec.speed * w);
        g.y += ((g.hy - g.y) / l) * Math.min(l, g.spec.speed * w);
        return;
      }
      case 'driven': {
        if (g.spec.giant) g.fall = clamp(g.st / 0.7);
        else {
          g.x += Math.cos(g.face) * 7 * w;
          g.y += Math.sin(g.face) * 7 * w;
        }
        if (g.st >= 2.4) { g.state = 'gone'; g.st = 0; }
        return;
      }
      default: break;
    }
    if (dist(g.hx, g.hy, d.x, d.y) > R.guardLeash || d.down > 0) {
      g.state = 'home';
      g.zone = null;
      this.zones.length = 0;
      return;
    }
    // touching him hurts
    if (dd < g.r + R.davidR + 0.1 && g.bite <= 0) {
      g.bite = R.biteSec;
      this.hurtDavid(g.atk * 0.5, g.x, g.y);
    }
    switch (g.state) {
      case 'move': {
        const keep = g.spec.giant ? 3.6 : 1.9;
        if (dd > keep + 0.3) {
          const sp = g.spec.speed * pace * w;
          g.x += ((d.x - g.x) / dd) * Math.min(dd - keep, sp);
          g.y += ((d.y - g.y) / dd) * Math.min(dd - keep, sp);
        }
        g.face = Math.atan2(d.y - g.y, d.x - g.x);
        if (g.st >= g.dur) this.guardTele();
        break;
      }
      case 'tele': {
        if (g.zone) g.zone.t = g.st;
        if (g.st >= g.dur) this.guardAct();
        break;
      }
      case 'act': {
        if (g.pattern === 'lunge' || g.pattern === 'pounce') {
          const k = clamp(g.st / g.dur);
          g.x = g.x0 + (g.ax - g.x0) * k;
          g.y = g.y0 + (g.ay - g.y0) * k;
          if (g.pattern === 'lunge' && g.zone && this.inZone(g.zone, d.x, d.y, 0)) this.hurtDavid(g.atk * R.harm.lunge, g.x, g.y);
          if (k >= 1) {
            if (g.pattern === 'pounce' && g.zone && this.inZone(g.zone, d.x, d.y, 0)) this.hurtDavid(g.atk * R.harm.pounce, g.x, g.y);
            this.afterAct();
          }
        } else if (g.st >= g.dur) this.afterAct();
        break;
      }
      case 'daze':
        if (g.st >= g.dur) {
          g.state = 'move';
          g.st = 0;
          g.dur = (R.guardRest[0] + this.rng() * (R.guardRest[1] - R.guardRest[0])) / pace;
        }
        break;
      default: break;
    }
  }

  private guardTele(): void {
    const g = this.guard, d = this.david, R = RULES;
    const ps = g.spec.patterns;
    const total = ps.reduce((s, [, wt]) => s + wt, 0);
    let r = this.rng() * total, pat: Pattern = ps[0][0];
    for (const [pp, wt] of ps) { r -= wt; if (r <= 0) { pat = pp; break; } }
    g.pattern = pat;
    g.state = 'tele';
    g.st = 0;
    g.dur = R.tele[pat] * (this.circle > 0 ? 0.88 : 1);
    const a = Math.atan2(d.y - g.y, d.x - g.x);
    g.face = a;
    let z: Zone | null = null;
    if (pat === 'lunge') z = { id: -1, kind: 'lane', x: g.x, y: g.y, a, len: R.lungeLen, w: R.lungeW, t: 0, dur: g.dur, live: false, small: false };
    else if (pat === 'spear') z = { id: -1, kind: 'lane', x: g.x, y: g.y, a, len: R.spearLen, w: R.spearW, t: 0, dur: g.dur, live: false, small: false };
    else if (pat === 'swipe') z = { id: -1, kind: 'cone', x: g.x, y: g.y, a, len: R.swipeLen + g.r, w: R.swipeHalf, t: 0, dur: g.dur, live: false, small: false };
    else if (pat === 'roar') z = { id: -1, kind: 'ring', x: g.x, y: g.y, a: 0, len: 0, w: R.roarR, t: 0, dur: g.dur, live: false, small: false };
    else if (pat === 'stomp') z = { id: -1, kind: 'ring', x: g.x, y: g.y, a: 0, len: 0, w: R.stompR, t: 0, dur: g.dur, live: false, small: false };
    else if (pat === 'pounce') z = { id: -1, kind: 'circle', x: d.x, y: d.y, a: 0, len: 0, w: R.pounceR, t: 0, dur: g.dur, live: false, small: false };
    if (pat === 'taunt') {
      g.taunt = TAUNTS[Math.floor(this.rng() * TAUNTS.length)];
      g.tauntT = 2.6;
      this.emit({ type: 'taunt', text: g.taunt });
    }
    this.zones.length = 0;
    g.zone = z;
    if (z) this.zones.push(z);
    this.emit({ type: 'guardTele', pattern: pat });
  }

  private guardAct(): void {
    const g = this.guard, d = this.david, R = RULES, pat = g.pattern!;
    g.state = 'act';
    g.st = 0;
    g.dur = pat === 'lunge' ? 0.32 : pat === 'pounce' ? 0.38 : 0.25;
    if (g.zone) g.zone.live = true;
    g.x0 = g.x;
    g.y0 = g.y;
    if (pat === 'lunge' && g.zone) {
      g.ax = g.x + Math.cos(g.zone.a) * g.zone.len;
      g.ay = g.y + Math.sin(g.zone.a) * g.zone.len;
    } else if (pat === 'pounce' && g.zone) {
      g.ax = g.zone.x;
      g.ay = g.zone.y;
    } else if (g.zone && this.inZone(g.zone, d.x, d.y, 0)) {
      this.hurtDavid(g.atk * R.harm[pat], g.x, g.y);
      if (pat === 'roar' || pat === 'stomp') {
        const a = Math.atan2(d.y - g.y, d.x - g.x);
        d.x = clamp(d.x + Math.cos(a) * 1.6, this.bounds.x0, this.bounds.x1);
        d.y = clamp(d.y + Math.sin(a) * 1.6, this.bounds.y0, this.bounds.y1);
      }
    }
    if (pat === 'taunt' && dist(g.x, g.y, d.x, d.y) < 9) d.slow = R.tauntSec;
    if (pat === 'roar' || pat === 'stomp') this.rings.push({ x: g.x, y: g.y, r: pat === 'roar' ? R.roarR : R.stompR, t: 0, dur: 0.5, kind: pat === 'roar' ? 'roar' : 'stomp' });
    this.emit({ type: 'guardAct', pattern: pat });
  }

  private afterAct(): void {
    const g = this.guard;
    this.zones.length = 0;
    g.zone = null;
    if (g.pattern === 'taunt') {
      g.state = 'move';
      g.st = 0;
      g.dur = 0.6;
      return;
    }
    g.state = 'daze';
    g.st = 0;
    g.dur = RULES.dazeSec;
    this.emit({ type: 'daze' });
    this.talk.ask('daze', 1, 2);
  }

  private inZone(z: Zone, x: number, y: number, pad: number): boolean {
    const dx = x - z.x, dy = y - z.y;
    if (z.kind === 'lane') {
      const along = dx * Math.cos(z.a) + dy * Math.sin(z.a);
      const across = -dx * Math.sin(z.a) + dy * Math.cos(z.a);
      return along > -0.4 && along < z.len + 0.3 && Math.abs(across) < z.w / 2 + RULES.davidR + pad;
    }
    if (z.kind === 'cone') {
      const l = Math.hypot(dx, dy);
      return l < z.len + pad && Math.abs(turn(z.a, Math.atan2(dy, dx))) < z.w + 0.15;
    }
    return Math.hypot(dx, dy) < z.w + RULES.davidR + pad;
  }

  /** Strike the guardian: a share of its XP per wound; driven off at none (Goliath falls flat). */
  private strikeGuard(dmg: number, mult: number, crit: boolean): void {
    const g = this.guard;
    if (!this.guardFighting || !(dmg > 0)) return;
    const v = dmg * (g.state === 'daze' ? RULES.dazeK : 1);
    const before = g.hp;
    g.hp = Math.max(0, g.hp - v);
    g.hit = 0.15;
    this.p.wounds = Math.round(g.max - g.hp);
    this.emit({ type: 'hit', x: g.x, y: g.y - 1, dmg: v, gold: mult > 1, crit, guard: true });
    const xp = ((before - g.hp) / g.max) * g.xp * 0.5;
    if (xp > 0) this.gainXp(xp * mult, g.x, g.y - 1.8, true);
    if (g.hp <= 0) this.guardDriven();
  }

  private guardDriven(): void {
    const g = this.guard, d = this.david;
    g.state = 'driven';
    g.st = 0;
    g.zone = null;
    this.zones.length = 0;
    g.face = Math.atan2(g.y - d.y, g.x - d.x);
    this.stop = Math.max(this.stop, RULES.stopDriven);
    this.gainXp(g.xp * 0.5, g.x, g.y - 2);
    this.chests.push({ id: this.uid++, kind: 'guard', x: g.x, y: g.y, t: 0, life: Infinity, silver: Math.round(120 * this.k), wood: 10, stone: 10, xp: 0 });
    this.p.guards++;
    this.p.wounds = 0;
    this.guardsNow.push(g.kind);
    if (g.spec.giant) this.fellNow.push(g.kind);
    this.emit({ type: 'guardDriven', kind: g.kind, giant: !!g.spec.giant, x: g.x, y: g.y });
    this.talk.ask(g.spec.giant ? 'fall' : 'driven', 5, 6);
    const q = this.quest;
    if (q?.kind === 'guard') this.completeQuest();
    const title = g.spec.giant ? t('story.fall.title', { name: g.name }) : t('story.driven.title', { name: g.name });
    this.showStory({ kind: 'guard', t: -1.6, dur: RULES.storySec + 1.6, title, text: t(`story.${g.kind}` as Key), verse: g.spec.giant ? '1sa17.45' : '1sa17.37' });
  }

  // ── weapons ─────────────────────────────────────────────────────
  /** What the sling aims at: a close beast first, then a fighting guardian, the thief, the nearest beast. */
  private pickTarget(range: number): { x: number; y: number; id: number } | null {
    const d = this.david;
    let best: Beast | null = null, bd = Infinity, close: Beast | null = null, cd = 2.6;
    for (const b of this.beasts) {
      if (b.state === 'flee' || b.state === 'doze' || b.hidden) continue;
      const dd = dist(b.x, b.y, d.x, d.y);
      if (dd > range + b.r) continue;
      if (dd < bd) { bd = dd; best = b; }
      if (dd < cd) { cd = dd; close = b; }
    }
    if (close) return { x: close.x, y: close.y, id: close.id };
    const g = this.guard;
    if (this.guardFighting && dist(g.x, g.y, d.x, d.y) < range + g.r) return { x: g.x, y: g.y, id: -1 };
    const th = this.thief;
    if (th && dist(th.x, th.y, d.x, d.y) < range + 0.4) return { x: th.x, y: th.y, id: -2 };
    return best ? { x: best.x, y: best.y, id: best.id } : null;
  }

  /** The great stone's mark: a fighting guardian, else the biggest pack in sight, else the strongest beast near. */
  stoneTarget(): { x: number; y: number; id: number } | null {
    const d = this.david;
    const g = this.guard;
    if (this.guardFighting && dist(g.x, g.y, d.x, d.y) < 12) return { x: g.x, y: g.y, id: -1 };
    let best: Beast | null = null, score = 0;
    for (const b of this.beasts) {
      if (b.state === 'flee' || b.state === 'doze' || b.hidden) continue;
      if (Math.abs(b.x - d.x) > this.viewHW + 1 || Math.abs(b.y - d.y) > this.viewHH + 1) continue;
      let n = 0;
      for (const o of this.beasts) if (o.state !== 'flee' && dist(o.x, o.y, b.x, b.y) < RULES.stoneScatter) n += o.max;
      if (n > score) { score = n; best = b; }
    }
    return best ? { x: best.x, y: best.y, id: best.id } : null;
  }

  private weapons(w: number): void {
    const d = this.david;
    if (d.down > 0 || this.sitting || d.armour > 0) return;
    const st = this.stats;
    // the sling (and the double and triple throws, a beat apart)
    this.slingT -= w;
    for (let i = this.extra.length - 1; i >= 0; i--) {
      this.extra[i].at -= w;
      if (this.extra[i].at <= 0) {
        this.extra.splice(i, 1);
        const tg = this.pickTarget(WEAPONS.proca.range);
        if (tg) this.throwStone(tg);
      }
    }
    if (this.slingT <= 0) {
      const tg = this.pickTarget(WEAPONS.proca.range);
      if (tg) {
        this.slingT = WEAPONS.proca.cd * st.cdK;
        this.throwStone(tg);
        if (this.rng() < st.double) this.extra.push({ at: 0.12 });
        if (this.rng() < st.triple) this.extra.push({ at: 0.24 });
      } else this.slingT = 0.1;
    }
    // the staff, the bow, the javelin
    for (const id of WEAPON_IDS) {
      if (id === 'proca') continue;
      const lv = weaponLevel(this.p, id);
      if (lv <= 0) continue;
      const wp = WEAPONS[id];
      const left = (this.weaponT[id] ?? 0) - w;
      this.weaponT[id] = left;
      if (left > 0) continue;
      const dmg = st.dmg * wp.dmg * weaponK(lv);
      if (id === 'kij') {
        const near = this.beasts.filter(b => b.state !== 'flee' && b.state !== 'doze' && !b.hidden && dist(b.x, b.y, d.x, d.y) < wp.range + b.r);
        const g = this.guard, gNear = this.guardFighting && dist(g.x, g.y, d.x, d.y) < wp.range + g.r;
        if (!near.length && !gNear) { this.weaponT[id] = 0.15; continue; }
        this.weaponT[id] = wp.cd * st.cdK;
        for (const b of near) this.strike(b, dmg * this.mult, this.mult, d.x, d.y, 5);
        if (gNear) this.strikeGuard(dmg * this.mult, this.mult, false);
        this.rings.push({ x: d.x, y: d.y, r: wp.range, t: 0, dur: 0.25, kind: 'sweep' });
        this.emit({ type: 'sweep', x: d.x, y: d.y, r: wp.range });
        continue;
      }
      const tg = id === 'oszczep' ? this.strongest(wp.range) : this.pickTarget(wp.range);
      if (!tg) { this.weaponT[id] = 0.2; continue; }
      this.weaponT[id] = wp.cd * st.cdK;
      this.lineShot(id === 'luk' ? 'arrow' : 'javelin', d.x, d.y, tg.x, tg.y, dmg * this.mult, this.mult, wp.pierce, wp.range);
    }
  }

  private strongest(range: number): { x: number; y: number; id: number } | null {
    const d = this.david, g = this.guard;
    if (this.guardFighting && dist(g.x, g.y, d.x, d.y) < range + g.r) return { x: g.x, y: g.y, id: -1 };
    let best: Beast | null = null;
    for (const b of this.beasts) {
      if (b.state === 'flee' || b.state === 'doze' || b.hidden || dist(b.x, b.y, d.x, d.y) > range) continue;
      if (!best || b.hp > best.hp) best = b;
    }
    return best ? { x: best.x, y: best.y, id: best.id } : null;
  }

  private throwStone(tg: { x: number; y: number; id: number }): void {
    const d = this.david, st = this.stats;
    const crit = this.rng() < st.crit;
    const mult = this.mult;
    const dmg = st.dmg * weaponK(weaponLevel(this.p, 'proca')) * mult * (crit ? RULES.critK : 1);
    const a = this.spinA;
    const sx = d.x + Math.cos(a) * 0.5, sy = d.y + Math.sin(a) * 0.35;
    this.shots.push({ id: this.uid++, kind: 'stone', x: sx, y: sy, vx: 0, vy: 0, speed: RULES.stoneSpeed, target: tg.id, dmg, mult, gold: mult > 1, crit, pierce: 1, life: 1.2, hit: [], tx: tg.x, ty: tg.y, z: 0.9 });
    d.face = Math.atan2(tg.y - d.y, tg.x - d.x);
    if (mult > 1) this.addCharge(RULES.goldHit);
    this.emit({ type: 'throw', kind: 'stone', x: d.x, y: d.y, gold: mult > 1 });
  }

  /** The great stone from the brook: it flies at the strongest target; nothing blocks it. */
  throwGreat(): void {
    const tg = this.stoneTarget();
    if (!this.stoneReady || !tg) return;
    const d = this.david;
    this.stoneReady = false;
    this.charge = 0;
    this.readyT = 0;
    this.stonesBlock++;
    this.stones++;
    this.p.stones++;
    this.shots.push({ id: this.uid++, kind: 'great', x: d.x, y: d.y, vx: 0, vy: 0, speed: RULES.stoneSpeed * 0.9, target: tg.id, dmg: this.stats.dmg * RULES.stoneDmg * Math.max(2, this.mult), mult: Math.max(2, this.mult), gold: true, crit: false, pierce: 1, life: 2, hit: [], tx: tg.x, ty: tg.y, z: 1.2 });
    this.emit({ type: 'throw', kind: 'great', x: d.x, y: d.y, gold: true });
    this.talk.ask('stone', 3, 3);
  }

  private lineShot(kind: ShotKind, x: number, y: number, tx: number, ty: number, dmg: number, mult: number, pierce: number, range: number): void {
    const a = Math.atan2(ty - y, tx - x), speed = kind === 'javelin' ? 13 : 17;
    this.shots.push({ id: this.uid++, kind, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, speed, target: 0, dmg, mult, gold: mult > 1, crit: false, pierce, life: (range + 1) / speed, hit: [], tx, ty, z: 0.8 });
    this.emit({ type: 'throw', kind, x, y, gold: mult > 1 });
  }

  private moveShots(w: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= w;
      if (s.kind === 'stone' || s.kind === 'great') {
        // homing: toward the target's place now (or where it was)
        let tx = s.tx, ty = s.ty, tr = 0.3;
        if (s.target > 0) {
          const b = this.beasts.find(x => x.id === s.target && x.state !== 'flee');
          if (b) { tx = s.tx = b.x; ty = s.ty = b.y; tr = b.r; }
        } else if (s.target === -1 && this.guardFighting) { tx = s.tx = this.guard.x; ty = s.ty = this.guard.y; tr = this.guard.r; }
        else if (s.target === -2 && this.thief) { tx = s.tx = this.thief.x; ty = s.ty = this.thief.y; tr = 0.4; }
        const dx = tx - s.x, dy = ty - s.y, l = Math.hypot(dx, dy);
        const step = s.speed * w;
        if (l <= step + tr * 0.6 || s.life <= 0) {
          this.shots.splice(i, 1);
          if (l <= step + tr * 0.6 + 0.2) this.landStone(s, tx, ty);
          continue;
        }
        s.x += (dx / l) * step;
        s.y += (dy / l) * step;
        continue;
      }
      // straight shots: arrows and javelins pass through `pierce` beasts
      s.x += s.vx * w;
      s.y += s.vy * w;
      for (const b of this.beasts) {
        if (b.state === 'flee' || b.state === 'doze' || s.hit.includes(b.id)) continue;
        if (dist(b.x, b.y, s.x, s.y) < b.r + 0.25) {
          s.hit.push(b.id);
          this.strike(b, s.dmg, s.mult, s.x - s.vx, s.y - s.vy, 2);
          if (s.hit.length >= s.pierce) { s.life = 0; break; }
        }
      }
      const g = this.guard;
      if (s.life > 0 && this.guardFighting && !s.hit.includes(-1) && dist(g.x, g.y, s.x, s.y) < g.r + 0.3) {
        s.hit.push(-1);
        this.strikeGuard(s.dmg, s.mult, false);
        if (s.hit.length >= s.pierce) s.life = 0;
      }
      if (s.life <= 0) this.shots.splice(i, 1);
    }
  }

  private landStone(s: Shot, x: number, y: number): void {
    const d = this.david;
    if (s.kind === 'great') {
      this.stop = Math.max(this.stop, RULES.stopStone);
      this.rings.push({ x, y, r: RULES.stoneScatter, t: 0, dur: 0.6, kind: 'great' });
      let n = 0;
      if (s.target === -1 && this.guardFighting) {
        const g = this.guard;
        const bite = Math.min(g.max * RULES.stoneBoss, s.dmg * 3);
        this.strikeGuard(Math.max(bite, s.dmg), s.mult, true);
        if (g.state !== 'driven' && g.state !== 'gone' && g.state !== 'act') { g.state = 'daze'; g.st = 0; g.dur = RULES.dazeSec; g.zone = null; this.zones.length = 0; }
        n = 1;
      }
      for (const b of [...this.beasts]) {
        if (b.state === 'flee' || dist(b.x, b.y, x, y) > RULES.stoneScatter + b.r) continue;
        this.strike(b, Math.max(s.dmg, b.hp + 1), s.mult, x, y, 8);
        n++;
      }
      this.emit({ type: 'stoneHit', x, y, n, guard: s.target === -1 });
      return;
    }
    if (s.target === -1) {
      if (this.blockedFrom(d.x, d.y)) {
        const b = this.bearer;
        this.emit({ type: 'blocked', x: b.x, y: b.y });
        return;
      }
      this.strikeGuard(s.dmg, s.mult, s.crit);
      return;
    }
    if (s.target === -2 && this.thief) {
      const th = this.thief;
      th.hp -= s.dmg;
      th.hit = 0.15;
      this.emit({ type: 'hit', x: th.x, y: th.y, dmg: s.dmg, gold: s.gold, crit: s.crit, guard: false });
      if (th.hp <= 0) this.catchThief();
      return;
    }
    const b = this.beasts.find(x2 => x2.id === s.target && x2.state !== 'flee');
    if (b) this.strike(b, s.dmg, s.mult, d.x, d.y, RULES.knock, s.crit);
  }

  // ── the companions' kit skills ──────────────────────────────────
  private kits(w: number): void {
    if (this.sitting || this.david.down > 0) return;
    const d = this.david;
    for (const m of this.mates) {
      m.cd -= w;
      if (m.cd > 0) continue;
      const s = stars(this.p, m.id), k = 1 + 0.25 * (s - 1);
      const cdNext = companionSpec(m.id).cd * (1 - 0.06 * (s - 1));
      const fighting = this.beasts.some(b => b.state === 'chase' || b.state === 'tele' || b.state === 'dash') || this.guardFighting;
      const dmg = this.stats.dmg * k;
      let used = false;
      switch (m.kit) {
        case 'dash': {
          // Asahel: through the nearest pack, sweeping up the silver
          const tg = this.pickTarget(7);
          if (!tg) break;
          const a = Math.atan2(tg.y - m.y, tg.x - m.x);
          const ex = clamp(tg.x + Math.cos(a) * 2, this.bounds.x0, this.bounds.x1), ey = clamp(tg.y + Math.sin(a) * 2, this.bounds.y0, this.bounds.y1);
          for (const b of this.beasts) {
            if (b.state === 'flee' || b.state === 'doze') continue;
            if (this.nearSegment(b.x, b.y, m.x, m.y, ex, ey) < b.r + 0.6) this.strike(b, dmg * 1.5, this.mult, m.x, m.y, 5);
          }
          if (tg.id === -1) this.strikeGuard(dmg * 1.5, this.mult, false);
          for (const c of this.coins) if (dist(c.x, c.y, ex, ey) < 3.5 || dist(c.x, c.y, d.x, d.y) < 5) c.pulled = true;
          this.rings.push({ x: m.x, y: m.y, r: 0, t: 0, dur: 0.35, kind: 'dash' });
          m.x = ex;
          m.y = ey;
          used = true;
          break;
        }
        case 'shield':
          if (!fighting) break;
          this.shieldT = 2.5 * k;
          this.rings.push({ x: d.x, y: d.y, r: 1.2, t: 0, dur: this.shieldT, kind: 'shield' });
          used = true;
          break;
        case 'volley': {
          const cands = this.beasts.filter(b => b.state !== 'flee' && b.state !== 'doze' && !b.hidden && dist(b.x, b.y, d.x, d.y) < 8).sort((a, b) => b.hp - a.hp).slice(0, 3);
          const g = this.guard;
          if (this.guardFighting && dist(g.x, g.y, d.x, d.y) < 9) {
            for (let i = 0; i < 3; i++) this.lineShot('volley', m.x, m.y, g.x, g.y, dmg * 2, this.mult, 1, 10);
            used = true;
          } else if (cands.length) {
            for (const b of cands) this.lineShot('volley', m.x, m.y, b.x, b.y, dmg * 2, this.mult, 1, 10);
            used = true;
          }
          break;
        }
        case 'supplies':
          if (d.hp >= d.max * 0.92) break;
          d.hp = Math.min(d.max, d.hp + d.max * 0.12 * k);
          this.rings.push({ x: d.x, y: d.y, r: 1.4, t: 0, dur: 0.6, kind: 'heal' });
          this.emit({ type: 'heal', v: d.hp });
          used = true;
          break;
        case 'stun': {
          const g = this.guard;
          if (this.guardFighting && dist(g.x, g.y, m.x, m.y) < 5) {
            this.strikeGuard(dmg * 3 * (g.kind === 'lew' || g.kind === 'lampart' ? 2 : 1), this.mult, true);
            if (g.state === 'move') { g.state = 'daze'; g.st = 0; g.dur = 1.2; }
            used = true;
            break;
          }
          const tg = this.beasts.filter(b => b.state !== 'flee' && b.state !== 'doze' && !b.hidden && dist(b.x, b.y, m.x, m.y) < 5).sort((a, b) => b.hp - a.hp)[0];
          if (!tg) break;
          this.strike(tg, dmg * 3 * (tg.kind === 'karakal' ? 2 : 1), this.mult, m.x, m.y, 4, true);
          if (tg.state !== 'flee') { tg.state = 'stun'; tg.st = 0; }
          used = true;
          break;
        }
        case 'stand': {
          const near = this.beasts.filter(b => b.state !== 'flee' && b.state !== 'doze' && dist(b.x, b.y, m.x, m.y) < 4.5);
          if (!near.length) break;
          for (const b of near) { b.taunt = 3 * k; if (b.state !== 'stun') b.state = 'chase'; }
          used = true;
          break;
        }
      }
      if (used) {
        m.cd = cdNext;
        m.act = m.kit === 'stand' ? 3 : 0.9;
        this.emit({ type: 'kit', id: m.id, x: m.x, y: m.y });
      } else m.cd = 0.3;
    }
  }

  private nearSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const k = clamp(((px - ax) * dx + (py - ay) * dy) / l2);
    return dist(px, py, ax + dx * k, ay + dy * k);
  }

  // ── pickups: coins into the bag, heaps, chests, visits ──────────
  private pickups(w: number): void {
    const d = this.david, R = RULES;
    const room = () => this.bagCap - this.bagLoad;
    let full = false;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.t += w;
      // the pop: a little hop, then it lies on the grass
      if (c.z > 0 || c.vz > 0) {
        c.vz -= 14 * w;
        c.z = Math.max(0, c.z + c.vz * w);
        if (c.z === 0) c.vz = 0;
        c.x += c.vx * w;
        c.y += c.vy * w;
        c.vx *= Math.exp(-3 * w);
        c.vy *= Math.exp(-3 * w);
      }
      // a coin goes in while there is any room (the bag may bulge by one coin)
      const fits = room() > 0.01;
      const dd = dist(c.x, c.y, d.x, d.y);
      if (!fits) { if (dd < R.pickR) full = true; c.pulled = false; }
      else if ((dd < R.pickR || c.pulled || (c.t > R.vacuumAfter && dd < R.vacuumR)) && c.t > 0.35 && d.down <= 0) c.pulled = true;
      if (c.pulled) {
        const sp = R.pull + c.t * 2;
        if (dd < 0.35) {
          this.coins.splice(i, 1);
          if (c.kind === 'silver') this.bag.silver += c.v;
          else this.bag[c.kind] += 1;
          this.emit({ type: 'coin', kind: c.kind, v: c.v });
          if (c.kind === 'silver') this.coach('coins', d.x, d.y);
          continue;
        }
        c.x += ((d.x - c.x) / dd) * Math.min(dd, sp * w);
        c.y += ((d.y - c.y) / dd) * Math.min(dd, sp * w);
      }
      if (c.t > R.coinLife) this.coins.splice(i, 1);
    }
    if (full || this.bagFull) {
      if (!this.bagFullSaid) {
        this.bagFullSaid = true;
        this.emit({ type: 'bagFull' });
        this.talk.ask('bagFull', 3, 5);
        this.coach('bag', d.x, d.y);
      }
    } else if (this.bagLoad < this.bagCap * 0.6) this.bagFullSaid = false;
    // brushwood and stone heaps
    if (!this.cave) for (const n of this.nodes) {
      if (n.back > 0) { n.back -= w; continue; }
      if (dist(n.x, n.y, d.x, d.y) < 1.3 && d.down <= 0) {
        n.back = 25;
        this.dropCoins(n.x, n.y, n.kind, 2 + Math.floor(this.rng() * 2));
        this.emit({ type: 'node', x: n.x, y: n.y, kind: n.kind });
      }
    }
    // chests open when David comes close
    for (let i = this.chests.length - 1; i >= 0; i--) {
      const c = this.chests[i];
      c.t += w;
      if (c.kind === 'land' && c.t < 0) continue;
      if (c.t > c.life) { this.chests.splice(i, 1); continue; }
      if (dist(c.x, c.y, d.x, d.y) < 1.4 && d.down <= 0 && c.t > 0.3) this.openChest(i);
    }
    if (!this.cave && !this.chests.some(c => c.kind === 'land')) {
      this.chestT += w;
      if (this.chestT >= R.chestBack) { this.chestT = 0; this.chests.push(this.landChest()); }
    }
    // visits: the people the quests send David to
    const q = this.quest;
    if (q?.kind === 'visit' && !this.cave && d.down <= 0) {
      const at = this.land.spots[q.what as Spot];
      if (at && dist(at[0], at[1], d.x, d.y) < 1.7) this.visit(q);
    }
  }

  private openChest(i: number): void {
    const c = this.chests[i];
    this.chests.splice(i, 1);
    const k = c.kind === 'land' || c.kind === 'guard' ? STORE_K[buildingLevel(this.p, 'spichlerz')] : 1;
    this.dropCoins(c.x, c.y, 'silver', c.silver * k);
    this.dropCoins(c.x, c.y, 'wood', c.wood);
    this.dropCoins(c.x, c.y, 'stone', c.stone);
    if (c.xp > 0) this.gainXp(c.xp, c.x, c.y - 0.8);
    for (const coin of this.coins) if (dist(coin.x, coin.y, c.x, c.y) < 0.5) coin.t = 0.2;
    if (c.kind === 'gift') this.emit({ type: 'gift', x: c.x, y: c.y });
    else this.emit({ type: 'chest', x: c.x, y: c.y, kind: c.kind });
    if (c.kind === 'gift') this.talk.ask('gift', 2, 4);
    else if (c.kind === 'reward') this.talk.ask('reward', 2, 4);
    else if (c.kind !== 'guard') this.talk.ask('chest', 1, 4);
    if (c.kind === 'land') this.chestT = 0;
  }

  private visit(q: QuestSpec): void {
    const say = q.say ?? q.what!;
    const name = q.joins ? companionName(q.joins) : t(`q.visit.${say}` as Key);
    let then: Story['then'];
    if (q.joins && join(this.p, q.joins)) {
      this.joinedNow.push(q.joins);
      this.placeMates();
      this.refreshStats(false);
      this.emit({ type: 'joined', id: q.joins });
      this.talk.ask('joined', 3, 8);
    }
    if (q.gives && weaponLevel(this.p, q.gives) <= 0) {
      this.p.wp[q.gives] = 1;
      this.emit({ type: 'forge', id: q.gives, level: 1, evolved: false });
    }
    if (say === 'saul') then = 'armour';
    if (say === 'brook') this.charge = Math.max(this.charge, 0.6);
    this.showStory({ kind: 'visit', t: 0, dur: RULES.storySec + 3, title: q.joins ? t('story.joined.title', { name }) : name, text: t(`npc.${say}` as Key), then });
    this.completeQuest();
  }

  // ── surprises: the golden jackal, Jesse's bundle ────────────────
  private surprises(w: number): void {
    const d = this.david, R = RULES;
    if (this.cave) return;
    const calm = this.restBlock || this.guardFighting || this.warmBlock;
    if (!this.thief && !calm) {
      this.thiefT -= w;
      if (this.thiefT <= 0) {
        this.thiefT = R.thiefEvery[0] + this.rng() * (R.thiefEvery[1] - R.thiefEvery[0]);
        const a = this.rng() * TAU, r = 6 + this.rng() * 2;
        const x = clamp(d.x + Math.cos(a) * r, this.bounds.x0 + 1, this.bounds.x1 - 1), y = clamp(d.y + Math.sin(a) * r * 0.7, this.bounds.y0 + 1, this.bounds.y1 - 1);
        if (!this.inCampCircle(x, y)) {
          const hp = BEASTS.szakal.hp * 3 * this.k;
          this.thief = { x, y, t: 0, hp, max: hp, dir: a, zig: 0, hit: 0 };
          this.emit({ type: 'thief', x, y });
          this.talk.ask('thief', 3, 4);
          this.coach('thief', x, y);
        }
      }
    }
    const th = this.thief;
    if (th) {
      th.t += w;
      th.hit = Math.max(0, th.hit - w);
      th.zig += w;
      const away = Math.atan2(th.y - d.y, th.x - d.x) + Math.sin(th.zig * 2.4) * 0.7;
      const dd = dist(th.x, th.y, d.x, d.y);
      const sp = R.thiefSpeed * (dd < 7 ? 1 : 0.55);
      th.dir = away;
      th.x = clamp(th.x + Math.cos(away) * sp * w, this.bounds.x0, this.bounds.x1);
      th.y = clamp(th.y + Math.sin(away) * sp * w, this.bounds.y0, this.bounds.y1);
      if (th.t >= R.thiefRun) {
        this.puffs.push({ x: th.x, y: th.y, t: 0, kind: 'thief', dir: 1, air: 0 });
        this.emit({ type: 'thiefGone', x: th.x, y: th.y });
        this.talk.ask('thiefGone', 2, 3);
        this.thief = null;
      }
    }
    // Jesse's bundle
    if (!this.restBlock) {
      this.giftT -= w;
      if (this.giftT <= 0) {
        this.giftT = R.giftEvery;
        const a = this.rng() * TAU, r = 3 + this.rng() * 2;
        const x = clamp(d.x + Math.cos(a) * r, this.bounds.x0 + 1, this.bounds.x1 - 1), y = clamp(d.y + Math.sin(a) * r * 0.7, this.bounds.y0 + 1, this.bounds.y1 - 1);
        this.chests.push({ id: this.uid++, kind: 'gift', x, y, t: 0, life: R.giftLife, silver: Math.round(20 * this.k), wood: 2, stone: 2, xp: Math.round(8 * this.k) });
      }
    }
  }

  private catchThief(): void {
    const th = this.thief;
    if (!th) return;
    this.thief = null;
    this.thieves++;
    this.p.thieves++;
    this.gainXp(BEASTS.szakal.xp * 8 * this.k * this.mult, th.x, th.y - 0.8);
    this.dropCoins(th.x, th.y, 'silver', 40 * this.k);
    this.puffs.push({ x: th.x, y: th.y, t: 0, kind: 'thief', dir: 1, air: 0 });
    this.emit({ type: 'thiefCaught', x: th.x, y: th.y });
    this.talk.ask('thiefCaught', 3, 4);
  }

  // ── the camp ────────────────────────────────────────────────────
  private campLife(w: number): void {
    const d = this.david, p = this.p;
    // the sheepfold's wool: silver straight to the treasury while playing
    const fold = FOLD_INCOME[buildingLevel(p, 'owczarnia')];
    if (fold > 0) {
      this.foldAcc += (fold * this.k * w) / 60;
      if (this.foldAcc >= 1) {
        const v = Math.floor(this.foldAcc);
        this.foldAcc -= v;
        p.silver += v;
        this.silverIn += v;
      }
    }
    const inside = !this.cave && this.inCampCircle(d.x, d.y) && d.down <= 0;
    if (inside && !this.inCamp) {
      this.inCamp = true;
      this.campTab = buildingLevel(p, 'ognisko') > 0 ? 'ab' : 'bd';
      this.deliver();
      this.coach('camp', this.land.camp[0], this.land.camp[1]);
      if (this.mode === 'home') this.mode = 'none';
    } else if (!inside && this.inCamp) this.inCamp = false;
    if (inside) {
      d.hp = Math.min(d.max, d.hp + RULES.campHeal * WELL_K[buildingLevel(p, 'studnia')] * d.max * w);
      if (this.bagLoad > 0) this.deliver();
    }
    // the gate
    if (this.gateOpen && !this.cave && dist(this.land.gate[0], this.land.gate[1], d.x, d.y) < 2.2 && d.down <= 0) this.nextLand();
  }

  /** The bag into the treasury (the camp, the session's end). */
  private deliver(): void {
    const b = this.bag, p = this.p;
    if (b.silver <= 0 && b.wood <= 0 && b.stone <= 0) return;
    const silver = Math.round(b.silver);
    p.silver += silver;
    p.wood += b.wood;
    p.stone += b.stone;
    this.silverIn += silver;
    const q = this.quest;
    if (q?.kind === 'gather') this.p.questN += q.what === 'stone' ? b.stone : b.wood;
    this.emit({ type: 'deliver', silver, wood: b.wood, stone: b.stone });
    if (this.started && this.phase !== 'done') this.talk.ask('deliver', 1, 3);
    this.bag = { silver: 0, wood: 0, stone: 0 };
    this.bagFullSaid = false;
  }

  setTab(tab: CampTab): void {
    this.campTab = tab;
  }

  /** The camp card's tiles for a tab, with their words and whether they can be bought now. */
  tiles(tab: CampTab = this.campTab): Tile[] {
    const p = this.p;
    if (tab === 'ab') {
      return ABILITIES.map(a => {
        const lv = abilityLevel(p, a.id);
        const c = abilityCost(a.id, lv);
        return { kind: 'ab', id: a.id, title: abilityName(a.id), lv, fx: abilityFx(a.id, lv + 1, p), cost: silverText(c), why: abilityWhy(p, a.id), price: [c, 0, 0] };
      });
    }
    if (tab === 'bd') {
      const out: Tile[] = BUILDINGS.map(b => {
        const lv = buildingLevel(p, b.id), cost = buildingCost(b.id, lv);
        return { kind: 'bd', id: b.id, title: buildingName(b.id), lv, fx: buildingFx(b.id, Math.min(3, lv + 1), this.k), cost: cost ? costText(cost) : '', why: buildingWhy(p, b.id), price: cost ?? undefined };
      });
      if (buildingLevel(p, 'jaskinia') > 0) out.push({ kind: 'cave', id: 'cave', title: t('camp.cave'), lv: p.floor, fx: t('hud.floor', { n: p.floor + 1 }), cost: '', why: 'ok' });
      return out;
    }
    if (tab === 'wp') {
      return WEAPON_IDS.map(id => {
        const lv = weaponLevel(p, id);
        const cost = lv <= 0 ? CRAFT[id] ?? null : weaponCost(id, lv);
        const why = weaponWhy(p, id);
        return { kind: 'wp', id, title: weaponName(id, tierOf(Math.max(1, lv))), lv, fx: weaponFx(id, Math.max(1, lv + (lv > 0 ? 1 : 0))), cost: cost ? costText(cost) : '', why, price: cost ?? undefined };
      });
    }
    return COMPANIONS.map(c => {
      const has = hasJoined(p, c.id), inParty = partyNow(p).includes(c.id);
      return { kind: 'mate', id: c.id, title: `${companionName(c.id)}${has ? ` ${t('stars', { n: stars(p, c.id) })}` : ''}`, lv: stars(p, c.id), fx: kitName(c.id), cost: '', why: !has ? 'later' : inParty ? 'in' : 'out' };
    });
  }

  /** A tap on the camp card's tile `i` (of the tab shown): buy, build, forge, take along, or go down into the cave. */
  campTap(i: number): boolean {
    if (!this.inCamp || this.story) return false;
    const tile = this.tiles()[i];
    if (!tile) return false;
    const p = this.p;
    let ok = false;
    if (tile.kind === 'ab') {
      ok = buyAbility(p, tile.id as AbilityId);
      if (ok) {
        this.emit({ type: 'buy', id: tile.id as AbilityId });
        this.talk.ask('buy', 1, 3);
        const q = this.quest;
        if (q?.kind === 'buy' && (q.what === tile.id || q.what === 'any')) p.questN++;
      }
    } else if (tile.kind === 'bd') {
      ok = build(p, tile.id as BuildingId);
      if (ok) {
        this.emit({ type: 'build', id: tile.id as BuildingId, level: buildingLevel(p, tile.id as BuildingId) });
        this.talk.ask('build', 2, 3);
        if (tile.id === 'ognisko' && buildingLevel(p, 'ognisko') === 1) this.campTab = 'ab';
      }
    } else if (tile.kind === 'wp') {
      const before = weaponLevel(p, tile.id as WeaponId);
      ok = forge(p, tile.id as WeaponId);
      if (ok) {
        const lv = weaponLevel(p, tile.id as WeaponId);
        this.emit({ type: 'forge', id: tile.id as WeaponId, level: lv, evolved: before > 0 && tierOf(lv) > tierOf(before) });
        this.talk.ask('forge', 2, 3);
      }
    } else if (tile.kind === 'mate') {
      ok = toggleParty(p, tile.id as CompanionId);
      if (ok) this.placeMates();
    } else if (tile.kind === 'cave') {
      this.enterCave();
      return true;
    }
    if (ok) this.refreshStats(false);
    this.checkQuest();
    return ok;
  }

  /** David's numbers after a change (a level, a purchase, the party); the health keeps its share. */
  private refreshStats(full: boolean): void {
    const d = this.david, share = d.max > 0 ? d.hp / d.max : 1;
    this.stats = statsOf(this.p, partyNow(this.p));
    d.max = this.stats.hp;
    d.hp = full ? d.max : Math.min(d.max, Math.max(1, share * d.max));
  }

  // ── XP and levels ───────────────────────────────────────────────
  /** XP earned: rested XP doubles it while it lasts; levels come with their gains and a chest every fifth. */
  private gainXp(v: number, x: number, y: number, quiet = false): number {
    const p = this.p;
    let n = Math.round(v);
    if (!(n > 0)) return 0;
    const bonus = Math.min(n, Math.floor(p.rested));
    p.rested -= bonus;
    n += bonus;
    this.score += n;
    this.blockXp += n;
    p.xp += n;
    p.total += n;
    for (const m of this.mates) {
      const before = stars(p, m.id);
      p.friend[m.id] = (p.friend[m.id] ?? 0) + n * 0.1;
      const after = stars(p, m.id);
      if (after > before) this.emit({ type: 'star', id: m.id, stars: after });
    }
    if (!quiet) this.emit({ type: 'xp', v: n, x, y });
    let guard = 0;
    while (p.xp >= xpNeed(p.level) && guard++ < 50) {
      p.xp -= xpNeed(p.level);
      p.level++;
      const before = this.stats;
      this.refreshStats(true);
      this.stop = Math.max(this.stop, RULES.stopLevel);
      this.rings.push({ x: this.david.x, y: this.david.y, r: 2.4, t: 0, dur: 0.7, kind: 'level' });
      this.emit({ type: 'level', level: p.level, dmg: Math.round(this.stats.dmg - before.dmg), hp: this.stats.hp - before.hp });
      this.talk.ask('level', 2, 3);
      this.coach('level', this.david.x, this.david.y);
      if (p.level % RULES.rewardEvery === 0) {
        this.chests.push({ id: this.uid++, kind: 'reward', x: clamp(this.david.x + 1.1, this.bounds.x0, this.bounds.x1), y: this.david.y + 0.3, t: 0, life: Infinity, silver: Math.round(12 * p.level * this.k), wood: 4, stone: 4, xp: 0 });
        this.emit({ type: 'chest', x: this.david.x + 1.1, y: this.david.y, kind: 'reward' });
      }
    }
    if (!this.tensSaid && this.score >= 10000) {
      this.tensSaid = true;
      this.talk.ask('tens', 3, 5);
    }
    return n;
  }

  // ── quests ──────────────────────────────────────────────────────
  /** Complete the quest now when its condition holds (a cascade: built, bought and levels already reached pass at once). */
  private checkQuest(): void {
    for (let guard = 0; guard < 8; guard++) {
      const q = this.quest;
      if (!q) return;
      const p = this.p;
      let done = false;
      switch (q.kind) {
        case 'hunt': case 'gather': case 'buy': done = p.questN >= (q.n ?? 1); break;
        case 'build': done = buildingLevel(p, q.what as BuildingId) >= (q.n ?? 1); break;
        case 'forge': done = weaponLevel(p, q.what as WeaponId) >= 1; break;
        case 'level': done = p.level >= (q.n ?? 1); break;
        case 'visit': done = !!q.joins && hasJoined(p, q.joins) && !q.gives; break;
        default: done = false;
      }
      if (!done) return;
      this.completeQuest();
    }
  }

  private completeQuest(): void {
    const p = this.p, q = this.quest;
    if (!q) return;
    const silver = Math.round(15 * this.k * (1 + p.quest * 0.4));
    const xp = Math.round(xpNeed(p.level) * 0.2);
    p.silver += silver;
    this.silverIn += silver;
    this.questsDone++;
    p.quests++;
    p.quest++;
    p.questN = 0;
    this.gainXp(xp, this.david.x, this.david.y - 1.2);
    this.emit({ type: 'questDone', xp, silver });
    this.talk.ask('questDone', 1, 3);
    if (this.quest) {
      this.emit({ type: 'quest', index: p.quest });
      this.talk.ask('quest', 1, 4);
      this.coach('quest', this.david.x, this.david.y);
      if (this.quest.kind === 'gate' && !this.cave) {
        this.emit({ type: 'gate' });
        this.coach('gate', this.land.gate[0], this.land.gate[1]);
      }
    }
  }

  /** The quest's place on the map (the arrow points there), or null. */
  questTarget(): { x: number; y: number } | null {
    const q = this.quest, d = this.david;
    if (!q || this.cave) return null;
    const camp = { x: this.land.camp[0], y: this.land.camp[1] };
    const nearestDen = (kind?: string): { x: number; y: number } | null => {
      const dn = this.nearestDen(d.x, d.y, false, kind);
      return dn ? { x: dn.x, y: dn.y } : null;
    };
    /** what a price still lacks: wood or stone from the nearest heap, silver from the nearest beasts; else the camp */
    const forPrice = (c: readonly [number, number, number] | null | undefined): { x: number; y: number } | null => {
      if (!c) return camp;
      const p = this.p, b = this.bag;
      for (const [kind, need, have] of [['wood', c[1], p.wood + b.wood], ['stone', c[2], p.stone + b.stone]] as const) {
        if (need <= have) continue;
        const n = this.nearestNode(kind);
        if (n) return n;
      }
      if (c[0] > p.silver + b.silver) return nearestDen() ?? camp;
      return camp;
    };
    switch (q.kind) {
      case 'hunt': return nearestDen(q.what);
      case 'build': return forPrice(buildingCost(q.what as BuildingId, buildingLevel(this.p, q.what as BuildingId)));
      case 'forge': return forPrice(weaponLevel(this.p, q.what as WeaponId) <= 0 ? CRAFT[q.what as WeaponId] : null);
      case 'buy': return forPrice([abilityCost(q.what as AbilityId, abilityLevel(this.p, q.what as AbilityId)), 0, 0]);
      case 'gather': {
        const kind = (q.what ?? 'wood') as NodeKind;
        const carried = kind === 'stone' ? this.bag.stone : this.bag.wood;
        if (carried >= (q.n ?? 1) - this.p.questN) return camp;
        return this.nearestNode(kind) ?? camp;
      }
      case 'visit': {
        const at = this.land.spots[q.what as Spot];
        return at ? { x: at[0], y: at[1] } : null;
      }
      case 'level': return nearestDen();
      case 'guard': return { x: this.guard.x, y: this.guard.y };
      case 'gate': return { x: this.land.gate[0], y: this.land.gate[1] };
    }
    return null;
  }

  /** The nearest heap of a kind (one that is there now first). */
  private nearestNode(kind: NodeKind): { x: number; y: number } | null {
    const d = this.david;
    let best: Node | null = null, bd = Infinity;
    for (const n of this.nodes) {
      if (n.kind !== kind) continue;
      const dd = dist(n.x, n.y, d.x, d.y) + (n.back > 0 ? 30 : 0);
      if (dd < bd) { bd = dd; best = n; }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  /** The quest's words ("Przepędź 4 szakale · 2/4"). */
  questText(): { text: string; progress: string } {
    if (this.cave) {
      const c = this.cave;
      return { text: t('hud.floor', { n: c.floor }), progress: c.state === 'fight' ? `${Math.max(0, Math.ceil(RULES.floorSec - c.t))} s` : '✓' };
    }
    const q = this.quest;
    if (!q) return { text: '', progress: '' };
    const p = this.p, n = q.n ?? 1;
    switch (q.kind) {
      case 'hunt': return { text: t('q.hunt', { what: beastCount(q.what as BeastKind, n) }), progress: `${Math.min(n, p.questN)}/${n}` };
      case 'build': return { text: t('q.build', { what: buildingName(q.what as BuildingId) }), progress: '' };
      case 'buy': return { text: t('q.buy', { what: abilityName(q.what as AbilityId) }), progress: n > 1 ? `${Math.min(n, p.questN)}/${n}` : '' };
      case 'forge': return { text: t('q.forge', { what: weaponName(q.what as WeaponId, 0) }), progress: '' };
      case 'gather': return { text: t('q.gather', { what: count(q.what === 'stone' ? 'stoneN' : 'woodN', n) }), progress: `${Math.min(n, p.questN)}/${n}` };
      case 'visit': return { text: t(`q.visit.${q.say ?? q.what}` as Key), progress: '' };
      case 'level': return { text: t('q.level', { n }), progress: `${p.level}/${n}` };
      case 'guard': return { text: t(this.guard.spec.giant ? 'q.guardGiant' : 'q.guard', { what: this.guard.name }), progress: this.guard.max > 0 ? `${Math.round((1 - this.guard.hp / this.guard.max) * 100)}%` : '' };
      case 'gate': return { text: t('q.gate', { what: landName(landAt(p.land + 1).spec.id) }), progress: '' };
    }
    return { text: '', progress: '' };
  }

  // ── the road: the next land ─────────────────────────────────────
  private nextLand(): void {
    const p = this.p;
    this.deliver();
    this.completeQuest();
    p.land++;
    p.wounds = 0;
    p.quest = 0;
    p.questN = 0;
    const L = landAt(p.land);
    this.land = L.spec;
    this.landIdx = L.idx;
    this.circle = L.circle;
    this.k = landK(p.land);
    this.guard = this.makeGuard();
    fillParty(p);
    this.setupLand();
    this.refreshStats(true);
    this.landsNow.push(p.land);
    this.emit({ type: 'land', idx: L.idx, circle: L.circle });
    this.talk.ask('land', 3, 8);
    const text = L.idx === 0 && L.circle > 0 ? `${t('story.circle', { n: L.circle + 1 })} ${landStory(L.spec.id)}` : landStory(L.spec.id);
    this.showStory({ kind: 'land', t: 0, dur: RULES.storySec + 2, title: t('story.land.title', { name: landName(L.spec.id) }), text });
    this.emit({ type: 'quest', index: 0 });
  }

  // ── the cave of Adullam (the tower) ─────────────────────────────
  enterCave(): void {
    if (this.cave || buildingLevel(this.p, 'jaskinia') <= 0 || this.sitting) return;
    this.deliver();
    this.stash = { coins: this.coins.splice(0) };
    this.beasts.length = 0;
    this.shots.length = 0;
    this.zones.length = 0;
    this.thief = null;
    this.cave = { floor: this.p.floor + 1, t: 0, state: 'fight', clearT: 0, best: this.p.floor };
    this.bounds = { x0: 0.8, y0: 0.8, x1: CAVE_W - 0.8, y1: CAVE_H - 0.8 };
    const d = this.david;
    d.x = CAVE_W / 2;
    d.y = CAVE_H / 2 + 2;
    this.lamb.x = d.x - 0.8;
    this.lamb.y = d.y + 0.3;
    for (const m of this.mates) { m.x = d.x + (this.rng() - 0.5) * 2; m.y = d.y + 1; }
    this.inCamp = false;
    this.mode = 'hunt';
    this.spawnFloor();
    this.emit({ type: 'cave', floor: this.cave.floor });
    this.talk.ask('cave', 3, 5);
    this.coach('cave', d.x, d.y);
  }

  private spawnFloor(): void {
    const c = this.cave!;
    const kinds = this.reachedKinds();
    const n = Math.min(10, 4 + Math.floor(c.floor / 4));
    const k = 0.9 * RULES.floorGrow ** (c.floor - 1);
    for (let i = 0; i < n; i++) {
      const kind = kinds[(c.floor + i) % kinds.length];
      const a = (i / n) * TAU, r = 5 + this.rng() * 2;
      this.spawnBeast(0, true, { kind, x: clamp(CAVE_W / 2 + Math.cos(a) * r * 1.3, 2, CAVE_W - 2), y: clamp(CAVE_H / 2 + Math.sin(a) * r * 0.8, 2.5, CAVE_H - 2), k });
    }
    for (const b of this.beasts) if (b.den === -1) { b.state = this.restBlock ? 'doze' : 'chase'; b.hidden = false; }
    c.t = 0;
    c.state = 'fight';
  }

  private reachedKinds(): BeastKind[] {
    const out = new Set<BeastKind>();
    for (let i = 0; i < reached(this.p); i++) for (const [kind] of landAt(i).spec.camps) out.add(kind);
    return out.size ? [...out] : ['szakal'];
  }

  private floorCleared(): void {
    const c = this.cave;
    if (!c || c.state !== 'fight') return;
    c.state = 'clear';
    c.clearT = 0;
    const first = c.floor > this.p.floor;
    this.p.floor = Math.max(this.p.floor, c.floor);
    this.floorsNow = Math.max(this.floorsNow, c.floor);
    const k = 0.9 * RULES.floorGrow ** (c.floor - 1);
    const rk = CAVE_REWARD[buildingLevel(this.p, 'jaskinia')];
    if (first) this.dropCoins(this.david.x, this.david.y - 1, 'silver', 20 * k * rk);
    if (first && c.floor % 10 === 0) this.chests.push({ id: this.uid++, kind: 'floor', x: this.david.x + 1, y: this.david.y, t: 0, life: Infinity, silver: Math.round(60 * k * rk), wood: 6, stone: 6, xp: Math.round(30 * k) });
    this.emit({ type: 'floor', floor: c.floor });
    this.talk.ask('floor', 1, 3);
  }

  private caveLife(w: number): void {
    const c = this.cave;
    if (!c) return;
    const d = this.david;
    if (c.state === 'fight') {
      if (!this.restBlock) c.t += w;
      if (c.t >= RULES.floorSec) { this.exitCave(); return; }
    } else {
      c.clearT += w;
      if (c.clearT >= RULES.floorPause) {
        // the coins of the floor come along
        for (const coin of this.coins) coin.pulled = true;
        c.floor++;
        this.spawnFloor();
      }
    }
    if (dist(d.x, d.y, CAVE_MOUTH[0], CAVE_MOUTH[1]) < 1.1 && c.t > 2) this.exitCave();
  }

  exitCave(): void {
    const c = this.cave;
    if (!c) return;
    this.deliver();
    this.cave = null;
    this.emit({ type: 'caveOut', floor: Math.max(c.best, this.p.floor) });
    this.beasts.length = 0;
    this.shots.length = 0;
    this.zones.length = 0;
    this.coins.length = 0;
    if (this.stash) this.coins.push(...this.stash.coins);
    this.stash = null;
    const L = this.land;
    this.bounds = { x0: 0.6, y0: 0.6, x1: L.w - 0.6, y1: L.h - 0.6 };
    this.dens.forEach((dn, i) => { dn.wait = []; for (let j = 0; j < dn.n; j++) this.spawnBeast(i, false); });
    const d = this.david;
    d.x = L.camp[0] + 1;
    d.y = L.camp[1] + 1.2;
    this.lamb.x = d.x - 0.8;
    this.lamb.y = d.y + 0.3;
    for (const m of this.mates) { m.x = d.x + (this.rng() - 0.5) * 2; m.y = d.y + 1; }
    this.mode = 'none';
  }

  // ── effects that only age ───────────────────────────────────────
  private fx(dt: number, w: number): void {
    for (let i = this.puffs.length - 1; i >= 0; i--) if ((this.puffs[i].t += dt) > 1) this.puffs.splice(i, 1);
    for (let i = this.rings.length - 1; i >= 0; i--) if ((this.rings[i].t += dt) > this.rings[i].dur) this.rings.splice(i, 1);
    for (let i = this.notes.length - 1; i >= 0; i--) if ((this.notes[i].t += dt) > 2.2) this.notes.splice(i, 1);
    for (const z of this.zones) if (z.id !== -1) z.t += w;
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
    this.phase = 'done';
    this.talk.clear();
    this.talk.ask('end', 5, 8);
    this.emit({ type: 'done' });
    this.settle();
  }

  /** The session is settled once — at its end, or when it ends early: the bag comes home, the counters reach the progress. */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p;
    if (this.cave) this.exitCave();
    this.deliver();
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushesBase + this.pushesBegun);
    p.lastLen = this.plannedSec;
    const g = this.guard;
    if (g.state !== 'gone' && g.state !== 'driven') p.wounds = Math.max(0, Math.round(g.max - g.hp));
  }

  /** The session ends before its own end: settle as the end would. */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') this.endBlock();
    this.story = null;
    this.storyQueue = [];
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

  /** The panel's gauge: the whirl in a sighted push, calm in a rest; null blind, without signal, in the lead-in or outside the blocks. */
  meter(): number | null {
    if (!this.started || !this.reliable) return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.whirl);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  /** The pad follows the whirl in a sighted push, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(this.whirl);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const g = this.guard;
    const stats: [string, string][] = [
      [t('stat.level'), String(p.level)],
      [t('stat.driven'), fmtNum(this.driven)],
      [t('stat.silver'), fmtNum(this.silverIn + Math.round(this.settled ? 0 : this.bag.silver))],
      [t('stat.quests'), String(this.questsDone)],
      [t('stat.stones'), String(this.stones)],
      [cap(g.name), t('pct', { n: g.state === 'gone' || g.state === 'driven' ? 100 : Math.round(((g.max - g.hp) / Math.max(1, g.max)) * 100) })],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    if (this.floorsNow > 0) stats.push([t('stat.floor'), String(this.floorsNow)]);
    return {
      score: this.score, unit: t('unit'), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: the first
   * session (the youngest son: 1 Sam 16:7), a guardian driven off (17:37), a giant fallen (17:45), great
   * stones (17:40), a calm harp (16:23); else Psalm 23.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('1sa16.7');
    if (this.fellNow.length) fit.push('1sa17.45');
    else if (this.guardsNow.length) fit.push('1sa17.37');
    if (this.stones > 0) fit.push('1sa17.40');
    if (this.passedRests > 0) fit.push('1sa16.23');
    if (this.p.level > this.levelBefore && this.session > 1) fit.push('1sa16.7');
    fit.push('psa23.1-3');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    const p = this.p;
    if (this.fellNow.length) add(0, t('hl.close.fall'));
    else if (this.guardsNow.length) add(0, t('hl.close.driven', { name: guardName(this.guardsNow[this.guardsNow.length - 1], this.circle) }));
    else if (p.level > this.levelBefore) add(0, t('hl.close.level', { n: p.level }));
    else if (this.started) add(0, t('hl.close.none'));
    for (const k of this.guardsNow) add(1, t(GUARDS[k].giant ? 'hl.fall' : 'hl.driven', { name: guardName(k, this.circle) }));
    for (const id of this.joinedNow) add(2, t('hl.joined', { name: companionName(id) }));
    for (const i of this.landsNow) add(2, t('hl.land', { name: landName(landAt(i).spec.id) }));
    if (p.level > this.levelBefore) add(3, t('hl.levels', { a: this.levelBefore, b: p.level }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(4, t('hl.record', { xp: xpText(this.score) }));
    else if (this.bestBefore !== null && this.score > 0 && this.bestBefore - this.score <= Math.max(200, this.bestBefore * 0.3)) add(4, t('hl.toBest', { xp: xpText(this.bestBefore - this.score) }));
    if (this.stones) add(5, t('hl.stones', { n: this.stones }));
    if (this.thieves) add(6, t('hl.thief'));
    if (this.questsDone) add(6, t('hl.quests', { n: this.questsDone }));
    if (this.floorsNow) add(7, t('hl.floor', { n: this.floorsNow }));
    if (this.blindShare >= 0) add(7, t('hl.blind', { n: this.blindShare }));
    if (this.settled && anyAffordable(p)) add(8, t('hl.shop'));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }

  /** For the view: the party's slots now. */
  get slots(): number { return partySlots(this.p); }
}

// ── the camp card's words ────────────────────────────────────────
const f1 = (v: number): string => fmtNum(v, Number.isInteger(v) ? 0 : 1);

/** "obrażenia +16%" — an ability's total effect at a level. */
export function abilityFx(id: AbilityId, lv: number, p: DawidProgress): string {
  const a = ability(id);
  switch (id) {
    case 'torba': {
      const v = Math.round(RULES.bagBase * RULES.bagGrow ** lv * STORE_K[Math.min(3, buildingLevel(p, 'spichlerz'))]);
      return t('abfx.torba', { a: fmtNum(v) });
    }
    case 'oddech': return t('abfx.oddech', { p: f1(Math.round(RULES.regenPer * lv * 10000) / 10) });
    case 'celnosc': return t('abfx.celnosc', { p: Math.round((RULES.crit + a.per * lv) * 100) });
    default: return t(`abfx.${id}` as Key, { p: f1(Math.round(a.per * lv * 1000) / 10) });
  }
}

/** "umiejętności do poz. 25" — a building's effect at a level. */
export function buildingFx(id: BuildingId, lv: number, k: number): string {
  switch (id) {
    case 'ognisko': return t('bdfx.ognisko', { n: lv >= 3 ? '∞' : lv === 2 ? 60 : 25 });
    case 'kuznia': return t('bdfx.kuznia', { n: lv >= 3 ? 25 : lv === 2 ? 18 : 10 });
    case 'spichlerz': return t('bdfx.spichlerz', { a: f1(STORE_K[lv]) });
    case 'studnia': return t('bdfx.studnia', { a: f1(WELL_K[lv]) });
    case 'owczarnia': return t('bdfx.owczarnia', { n: fmtNum(Math.round(FOLD_INCOME[lv] * k)) });
    case 'jaskinia': return t('bdfx.jaskinia', { a: f1(CAVE_REWARD[lv]) });
  }
}

/** "×1,3 · co 0,8 s" — a weapon's numbers at a level. */
export function weaponFx(id: WeaponId, lv: number): string {
  const w = WEAPONS[id];
  const k = Math.round(weaponK(lv) * w.dmg * 100) / 100;
  return t(`wfx.${id}` as Key, { k: fmtNum(k, Number.isInteger(k) ? 0 : 2), c: fmtNum(w.cd, 1) });
}

/** Why a tile cannot be bought now, in words (null: it can, or it has its own label). */
export function whyText(kind: Tile['kind'], id: string, why: Tile['why']): string | null {
  switch (why) {
    case 'max': return t('camp.max');
    case 'cap': return t(kind === 'ab' ? 'camp.capAb' : 'camp.capWp');
    case 'need': {
      const what = kind === 'ab' && id === 'potrojny' ? `${abilityName('podwojny')} 10`
        : kind === 'bd' ? buildingName(BUILDINGS.find(b => b.id === id)?.after ?? 'ognisko')
          : buildingName(kind === 'wp' ? 'kuznia' : 'ognisko');
      return t('camp.needBd', { what });
    }
    case 'land': {
      const li = kind === 'bd' ? BUILDINGS.find(b => b.id === id)?.land ?? 0 : 3;
      return t('camp.needLand', { what: landName(landAt(li).spec.id) });
    }
    case 'gift': return t('camp.gift');
    case 'in': return t('camp.in');
    case 'out': return t('camp.out');
    case 'later': return t('camp.join');
    default: return null;
  }
}

/** "120 srebrników · 6 naręczy chrustu · 4 kamienie" (only what the price has). */
export function costText(c: readonly [number, number, number]): string {
  const parts: string[] = [];
  if (c[0] > 0) parts.push(silverText(c[0]));
  if (c[1] > 0) parts.push(count('woodN', c[1]));
  if (c[2] > 0) parts.push(count('stoneN', c[2]));
  return parts.join(' · ');
}

export { BEAST_KINDS, weaponCap };
