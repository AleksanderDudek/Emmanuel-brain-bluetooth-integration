/**
 * Dawid's data: the six lands of David's road (each a map with its shepherds' camp, its beast camps,
 * brushwood and stone heaps, the brook, a chest, the people who give quests, the guardian's lair and
 * the gate it holds), the beasts (struck, they lose heart and run off into the hills — nothing dies),
 * the guardians (the lion, the she-bear, Goliath, the great aurochs, the leopard of En-Gedi, the giants
 * of Gath), the companions who join through the story and their kit skills, the weapons and their
 * evolutions, the ability ladder, the camp's buildings, the quest chains, the strategies under a
 * block's name and the lamb's moments.  The words live in the catalog (i18n.ts).
 */
import { t, type Key } from './i18n';

// ── beasts ───────────────────────────────────────────────────────
export type BeastKind = 'szakal' | 'szerszen' | 'wilk' | 'dzik' | 'zmija' | 'hiena' | 'skorpion' | 'sep' | 'tur' | 'karakal';
/** how a beast fights: chase and bite; lunge (a quick dash); charge (a telegraphed line); ambush (hidden till close); hit-and-run; swoop (flies, dives); swarm (erratic); leap (a short jump) */
export type Habit = 'chase' | 'lunge' | 'charge' | 'ambush' | 'skirmish' | 'swoop' | 'swarm' | 'leap';

export interface BeastSpec {
  kind: BeastKind;
  habit: Habit;
  /** at land 1, circle 0: spirit (hp), a bite, XP and silver when driven off */
  hp: number;
  atk: number;
  xp: number;
  silver: number;
  speed: number;
  r: number;
  /** it notices David this close (u) */
  aggro: number;
  /** a den refills a slot after this long (s) */
  respawn: number;
  /** flies (drawn above the ground, its shadow below) */
  flies?: boolean;
}

export const BEASTS: Readonly<Record<BeastKind, BeastSpec>> = {
  szakal: { kind: 'szakal', habit: 'chase', hp: 24, atk: 3, xp: 6, silver: 3, speed: 3.3, r: 0.32, aggro: 4.6, respawn: 9 },
  szerszen: { kind: 'szerszen', habit: 'swarm', hp: 9, atk: 2, xp: 3, silver: 1, speed: 4.2, r: 0.17, aggro: 3.8, respawn: 7, flies: true },
  wilk: { kind: 'wilk', habit: 'lunge', hp: 46, atk: 5, xp: 11, silver: 6, speed: 3.5, r: 0.4, aggro: 5.2, respawn: 12 },
  dzik: { kind: 'dzik', habit: 'charge', hp: 90, atk: 8, xp: 20, silver: 10, speed: 2.5, r: 0.5, aggro: 5, respawn: 14 },
  zmija: { kind: 'zmija', habit: 'ambush', hp: 36, atk: 7, xp: 12, silver: 6, speed: 1.3, r: 0.3, aggro: 2.6, respawn: 11 },
  hiena: { kind: 'hiena', habit: 'skirmish', hp: 56, atk: 5, xp: 14, silver: 8, speed: 3.7, r: 0.42, aggro: 5.4, respawn: 12 },
  skorpion: { kind: 'skorpion', habit: 'chase', hp: 82, atk: 7, xp: 18, silver: 9, speed: 1.5, r: 0.42, aggro: 4.2, respawn: 13 },
  sep: { kind: 'sep', habit: 'swoop', hp: 42, atk: 6, xp: 15, silver: 8, speed: 3, r: 0.45, aggro: 6, respawn: 14, flies: true },
  tur: { kind: 'tur', habit: 'charge', hp: 140, atk: 10, xp: 30, silver: 15, speed: 2.3, r: 0.62, aggro: 5, respawn: 16 },
  karakal: { kind: 'karakal', habit: 'leap', hp: 52, atk: 7, xp: 16, silver: 9, speed: 4.3, r: 0.36, aggro: 5.4, respawn: 12 },
};
export const BEAST_KINDS = Object.keys(BEASTS) as BeastKind[];

export const beastName = (k: BeastKind): string => t(`beast.${k}` as Key);
/** "4 szakale", "6 hornets" (the count bent by the language) */
export const beastCount = (k: BeastKind, n: number): string => t(`beasts.${k}` as Key, { n });

// ── guardians (the gate bosses: driven off, never killed; Goliath falls flat) ──
export type GuardKind = 'lew' | 'niedzwiedzica' | 'goliat' | 'tur' | 'lampart' | 'olbrzym';
export type Pattern = 'lunge' | 'swipe' | 'roar' | 'pounce' | 'spear' | 'stomp' | 'taunt';

export interface GuardSpec {
  kind: GuardKind;
  /** spirit at land 1 strength (× the land's and the circle's factor) */
  hp: number;
  atk: number;
  speed: number;
  r: number;
  patterns: readonly (readonly [Pattern, number])[];
  /** a giant: walks, falls flat on his face when beaten (the others run off into the hills) */
  giant?: boolean;
}

export const GUARDS: Readonly<Record<GuardKind, GuardSpec>> = {
  lew: { kind: 'lew', hp: 1200, atk: 14, speed: 3.1, r: 0.85, patterns: [['lunge', 3], ['swipe', 2], ['roar', 1]] },
  niedzwiedzica: { kind: 'niedzwiedzica', hp: 1500, atk: 13, speed: 2.4, r: 0.95, patterns: [['swipe', 3], ['roar', 2], ['pounce', 1.5], ['lunge', 1]] },
  goliat: { kind: 'goliat', hp: 2000, atk: 14, speed: 1.5, r: 1.15, patterns: [['spear', 3], ['stomp', 2], ['taunt', 1.6]], giant: true },
  tur: { kind: 'tur', hp: 2100, atk: 15, speed: 2.6, r: 1.0, patterns: [['lunge', 4], ['stomp', 2], ['roar', 1]] },
  lampart: { kind: 'lampart', hp: 2200, atk: 15, speed: 3.6, r: 0.8, patterns: [['pounce', 3], ['lunge', 2], ['swipe', 2]] },
  olbrzym: { kind: 'olbrzym', hp: 2400, atk: 16, speed: 1.6, r: 1.15, patterns: [['spear', 2], ['stomp', 2], ['swipe', 1.5], ['taunt', 1]], giant: true },
};

/** The giant of Gath on a circle: Ishbi-Benob, Saph, Lahmi, the six-fingered one (2 Sam 21:16-20), in turn. */
export const GIANTS = ['iszbi', 'saf', 'lachmi', 'szesc'] as const;
export type GiantName = (typeof GIANTS)[number];
export function guardName(k: GuardKind, circle = 0): string {
  if (k === 'olbrzym') return t(`giant.${GIANTS[Math.max(0, circle) % GIANTS.length]}` as Key);
  return t(`guard.${k}` as Key);
}

// ── lands (a circle of six, then round again, stronger) ──────────
export type LandId = 'pastwiska' | 'wzgorza' | 'ela' | 'gibea' | 'engedi' | 'gat';
export type Ground = 'pasture' | 'hills' | 'valley' | 'fields' | 'desert' | 'gath';
export type Spot = 'jesse' | 'asahel' | 'sluga' | 'abiszaj' | 'eliab' | 'saul' | 'brook' | 'jonatan' | 'abigail' | 'benajasz' | 'itaj' | 'szamma';
export type NodeKind = 'wood' | 'stone';

export interface LandSpec {
  id: LandId;
  ground: Ground;
  /** the map's size (u) */
  w: number;
  h: number;
  /** the shepherds' camp, the gate out (on the map's edge), the guardian's lair */
  camp: readonly [number, number];
  gate: readonly [number, number];
  lair: readonly [number, number];
  guard: GuardKind;
  /** the brook (a polyline across the map) */
  brook: readonly (readonly [number, number])[];
  /** beast camps: kind, x, y, how many */
  camps: readonly (readonly [BeastKind, number, number, number])[];
  /** brushwood and stone heaps */
  nodes: readonly (readonly [NodeKind, number, number])[];
  /** the land's chest */
  chest: readonly [number, number];
  /** people and places the quests send David to */
  spots: Partial<Record<Spot, readonly [number, number]>>;
}

export const LANDS: readonly LandSpec[] = [
  {
    id: 'pastwiska', ground: 'pasture', w: 64, h: 42, camp: [8, 27], gate: [63, 7], lair: [55, 10], guard: 'lew',
    brook: [[0, 14], [13, 13], [22, 18], [31, 24], [41, 25], [52, 33], [64, 36]],
    camps: [['szakal', 15, 22, 4], ['szakal', 16, 34, 4], ['szerszen', 24, 29, 5], ['wilk', 26, 15, 3], ['szakal', 33, 32, 5], ['szerszen', 38, 19, 6], ['wilk', 43, 30, 3], ['wilk', 46, 15, 4], ['szakal', 51, 25, 5]],
    nodes: [['wood', 12, 20], ['wood', 21, 37], ['wood', 30, 21], ['wood', 45, 37], ['stone', 11, 34], ['stone', 24, 11], ['stone', 36, 37], ['stone', 49, 21]],
    chest: [34, 8],
    spots: { jesse: [6, 24], asahel: [19, 9], brook: [22, 18] },
  },
  {
    id: 'wzgorza', ground: 'hills', w: 64, h: 42, camp: [8, 10], gate: [63, 36], lair: [54, 32], guard: 'niedzwiedzica',
    brook: [[19, 0], [22, 11], [30, 18], [38, 23], [43, 42]],
    camps: [['dzik', 16, 15, 2], ['zmija', 13, 23, 3], ['hiena', 25, 8, 4], ['dzik', 27, 22, 3], ['zmija', 34, 13, 3], ['hiena', 34, 30, 4], ['dzik', 45, 18, 3], ['hiena', 46, 27, 5], ['zmija', 52, 22, 4]],
    nodes: [['wood', 11, 17], ['wood', 20, 30], ['wood', 40, 9], ['wood', 50, 13], ['stone', 18, 6], ['stone', 27, 34], ['stone', 41, 36], ['stone', 57, 26]],
    chest: [14, 36],
    spots: { sluga: [12, 6], abiszaj: [30, 37], brook: [24, 13] },
  },
  {
    id: 'ela', ground: 'valley', w: 64, h: 42, camp: [8, 21], gate: [63, 21], lair: [49, 21], guard: 'goliat',
    brook: [[0, 23], [16, 22], [30, 20], [44, 21], [64, 20]],
    camps: [['skorpion', 15, 28, 3], ['sep', 18, 13, 2], ['hiena', 25, 27, 4], ['skorpion', 29, 13, 3], ['sep', 33, 30, 3], ['hiena', 37, 14, 4], ['skorpion', 41, 28, 4]],
    nodes: [['wood', 12, 14], ['wood', 22, 34], ['wood', 35, 8], ['stone', 13, 32], ['stone', 25, 19], ['stone', 44, 33], ['stone', 39, 22]],
    chest: [25, 38],
    spots: { eliab: [16, 6], saul: [26, 5], brook: [32, 20], jonatan: [40, 6] },
  },
  {
    id: 'gibea', ground: 'fields', w: 64, h: 42, camp: [8, 31], gate: [63, 9], lair: [56, 12], guard: 'tur',
    brook: [[0, 20], [12, 22], [26, 19], [38, 12], [46, 0]],
    camps: [['szerszen', 15, 25, 6], ['dzik', 18, 36, 3], ['tur', 26, 27, 2], ['szerszen', 30, 14, 6], ['dzik', 37, 33, 3], ['tur', 41, 22, 3], ['szerszen', 47, 31, 7], ['tur', 50, 17, 3]],
    nodes: [['wood', 13, 18], ['wood', 22, 38], ['wood', 34, 24], ['wood', 52, 36], ['stone', 10, 37], ['stone', 22, 10], ['stone', 44, 9], ['stone', 57, 27]],
    chest: [32, 39],
    spots: { brook: [20, 21] },
  },
  {
    id: 'engedi', ground: 'desert', w: 64, h: 42, camp: [8, 12], gate: [63, 35], lair: [54, 31], guard: 'lampart',
    brook: [[14, 0], [17, 8], [15, 18], [20, 26], [18, 42]],
    camps: [['zmija', 14, 24, 3], ['karakal', 23, 10, 3], ['skorpion', 26, 22, 4], ['karakal', 33, 16, 3], ['zmija', 35, 30, 4], ['skorpion', 43, 20, 4], ['karakal', 46, 31, 4]],
    nodes: [['wood', 19, 4], ['wood', 21, 32], ['wood', 30, 37], ['stone', 10, 21], ['stone', 29, 6], ['stone', 40, 10], ['stone', 50, 24]],
    chest: [38, 38],
    spots: { abigail: [11, 34], benajasz: [36, 6], brook: [17, 10] },
  },
  {
    id: 'gat', ground: 'gath', w: 64, h: 42, camp: [8, 21], gate: [63, 21], lair: [55, 21], guard: 'olbrzym',
    brook: [[0, 31], [18, 30], [34, 34], [50, 31], [64, 33]],
    camps: [['wilk', 15, 14, 4], ['hiena', 16, 28, 5], ['sep', 25, 21, 3], ['wilk', 31, 11, 4], ['hiena', 33, 29, 5], ['sep', 41, 16, 3], ['wilk', 45, 27, 5]],
    nodes: [['wood', 12, 9], ['wood', 23, 36], ['wood', 39, 7], ['stone', 13, 35], ['stone', 27, 15], ['stone', 46, 37], ['stone', 50, 10]],
    chest: [30, 39],
    spots: { itaj: [13, 15], szamma: [24, 36], brook: [30, 33] },
  },
];
export const LAND_COUNT = LANDS.length;

export const landName = (id: LandId): string => t(`land.${id}` as Key);
export const landStory = (id: LandId): string => t(`land.${id}.story` as Key);

// ── companions (they join through the story; one kit skill each) ──
export type CompanionId = 'asahel' | 'abiszaj' | 'jonatan' | 'abigail' | 'benajasz' | 'szamma';
/** dash (through a camp, sweeping up coins) · shield (the party takes no harm) · volley (three arrows) · supplies (heal) · stun (a mighty blow) · stand (draws the beasts to himself) */
export type Kit = 'dash' | 'shield' | 'volley' | 'supplies' | 'stun' | 'stand';

export interface CompanionSpec { id: CompanionId; kit: Kit; cd: number; land: number }

export const COMPANIONS: readonly CompanionSpec[] = [
  { id: 'asahel', kit: 'dash', cd: 7, land: 0 },
  { id: 'abiszaj', kit: 'shield', cd: 9, land: 1 },
  { id: 'jonatan', kit: 'volley', cd: 6, land: 2 },
  { id: 'abigail', kit: 'supplies', cd: 10, land: 4 },
  { id: 'benajasz', kit: 'stun', cd: 8, land: 4 },
  { id: 'szamma', kit: 'stand', cd: 9, land: 5 },
];
export const companionSpec = (id: CompanionId): CompanionSpec => COMPANIONS.find(c => c.id === id)!;
export const companionName = (id: CompanionId): string => t(`comp.${id}` as Key);
export const kitName = (id: CompanionId): string => t(`kit.${id}` as Key);
export const kitText = (id: CompanionId): string => t(`kit.${id}.text` as Key);
/** friendship (the XP they share) needed for each star, 1★ when they join */
export const STAR_AT = [0, 600, 3000, 12000, 45000] as const;
/** party slots by the land reached (index in the circle) */
export const slotsAt = (landsReached: number): number => (landsReached >= 4 ? 3 : landsReached >= 2 ? 2 : 1);
/** belong together: a party bonus (the sons of Zeruiah; the mighty men of 2 Sam 23) */
export const BONDS: readonly { id: 'zeruja' | 'mocarze'; members: readonly CompanionId[]; dmg: number }[] = [
  { id: 'zeruja', members: ['asahel', 'abiszaj'], dmg: 0.1 },
  { id: 'mocarze', members: ['benajasz', 'szamma', 'abiszaj'], dmg: 0.15 },
];

// ── weapons (the forge: levels 1–25, an evolution every five) ────
export type WeaponId = 'proca' | 'kij' | 'luk' | 'oszczep';
export interface WeaponSpec {
  id: WeaponId;
  /** seconds between uses, reach (u), damage × David's, how many it passes through */
  cd: number;
  range: number;
  dmg: number;
  pierce: number;
  /** silver for the next level: cost × grow^(level − 1) */
  cost: number;
  grow: number;
}
export const WEAPONS: Readonly<Record<WeaponId, WeaponSpec>> = {
  proca: { id: 'proca', cd: 0.8, range: 5.6, dmg: 1, pierce: 1, cost: 20, grow: 1.2 },
  kij: { id: 'kij', cd: 1.6, range: 1.9, dmg: 0.8, pierce: 99, cost: 30, grow: 1.2 },
  luk: { id: 'luk', cd: 1.4, range: 7.5, dmg: 0.9, pierce: 2, cost: 400, grow: 1.2 },
  oszczep: { id: 'oszczep', cd: 2.6, range: 7, dmg: 2.4, pierce: 3, cost: 900, grow: 1.2 },
};
export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
/** the damage factor of a tier (0..4) */
export const TIER_K = [1, 1.3, 1.7, 2.2, 2.9] as const;
export const weaponName = (id: WeaponId, tier: number): string => t(`weapon.${id}.${Math.max(0, Math.min(4, tier))}` as Key);
/** the crafts that give a weapon: silver, wood, stone (the bow is Jonathan's gift) */
export const CRAFT: Readonly<Partial<Record<WeaponId, readonly [number, number, number]>>> = {
  kij: [30, 4, 0],
  oszczep: [900, 20, 20],
};

// ── abilities (bought with silver at the bonfire, steep ladders) ──
export type AbilityId = 'sila' | 'zdrowie' | 'torba' | 'tempo' | 'krok' | 'celnosc' | 'podwojny' | 'potrojny' | 'oddech';
export interface AbilitySpec {
  id: AbilityId;
  /** silver for the next level: cost × grow^level; at most `max` levels (and the bonfire's cap) */
  cost: number;
  grow: number;
  max: number;
  /** what one level adds (the effect's unit is in the catalog) */
  per: number;
}
export const ABILITIES: readonly AbilitySpec[] = [
  { id: 'sila', cost: 12, grow: 1.16, max: 200, per: 0.08 },
  { id: 'zdrowie', cost: 10, grow: 1.16, max: 200, per: 0.07 },
  { id: 'torba', cost: 15, grow: 1.2, max: 120, per: 0.18 },
  { id: 'tempo', cost: 30, grow: 1.3, max: 20, per: 0.025 },
  { id: 'krok', cost: 25, grow: 1.3, max: 15, per: 0.03 },
  { id: 'celnosc', cost: 40, grow: 1.25, max: 25, per: 0.01 },
  { id: 'podwojny', cost: 60, grow: 1.24, max: 25, per: 0.02 },
  { id: 'potrojny', cost: 400, grow: 1.28, max: 20, per: 0.015 },
  { id: 'oddech', cost: 20, grow: 1.2, max: 40, per: 1 },
];
export const ability = (id: AbilityId): AbilitySpec => ABILITIES.find(a => a.id === id)!;
export const abilityName = (id: AbilityId): string => t(`ab.${id}` as Key);

// ── the camp's buildings (the camp travels with David) ───────────
export type BuildingId = 'ognisko' | 'kuznia' | 'spichlerz' | 'studnia' | 'owczarnia' | 'jaskinia';
export interface BuildingSpec {
  id: BuildingId;
  /** silver, wood, stone for levels 1..3 */
  cost: readonly (readonly [number, number, number])[];
  /** needs: another building first, or a land reached (index in the circle) */
  after?: BuildingId;
  land?: number;
}
export const BUILDINGS: readonly BuildingSpec[] = [
  { id: 'ognisko', cost: [[10, 0, 0], [400, 10, 10], [6000, 40, 40]] },
  { id: 'kuznia', cost: [[50, 5, 0], [1500, 20, 20], [30000, 60, 60]], after: 'ognisko' },
  { id: 'spichlerz', cost: [[150, 12, 4], [2500, 25, 15], [40000, 70, 60]], after: 'kuznia' },
  { id: 'studnia', cost: [[300, 4, 16], [5000, 20, 40], [60000, 60, 90]], after: 'ognisko', land: 1 },
  { id: 'owczarnia', cost: [[800, 24, 12], [9000, 40, 30], [90000, 90, 70]], after: 'ognisko', land: 1 },
  { id: 'jaskinia', cost: [[3000, 30, 30], [30000, 60, 60], [200000, 120, 120]], after: 'ognisko', land: 2 },
];
export const building = (id: BuildingId): BuildingSpec => BUILDINGS.find(b => b.id === id)!;
export const buildingName = (id: BuildingId): string => t(`bd.${id}` as Key);
/** the bonfire's level caps the abilities: 25 / 60 / all */
export const ABILITY_CAP = [0, 25, 60, 999] as const;
/** the forge's level caps the weapons: 10 / 18 / 25 */
export const WEAPON_CAP = [1, 10, 18, 25] as const;
/** the storehouse multiplies the bag; the well heals and speeds the harp's healing; the sheepfold's income (silver a minute × the land) */
export const STORE_K = [1, 1.25, 1.5, 2] as const;
export const WELL_K = [1, 1.25, 1.5, 2] as const;
export const FOLD_INCOME = [0, 4, 10, 24] as const;

// ── quests (each land's chain; the people give them) ─────────────
export type QuestKind = 'hunt' | 'build' | 'buy' | 'forge' | 'gather' | 'visit' | 'level' | 'guard' | 'gate';
export interface QuestSpec {
  kind: QuestKind;
  /** hunt: a beast kind or 'any'; build: a building; forge: a weapon; gather: wood/stone; visit: a spot; level: — */
  what?: string;
  n?: number;
  /** a visit makes a companion join, or gives a weapon */
  joins?: CompanionId;
  gives?: WeaponId;
  /** the line's key suffix for a visit (npc.<say>) */
  say?: string;
}

export const QUESTS: Readonly<Record<LandId, readonly QuestSpec[]>> = {
  pastwiska: [
    { kind: 'hunt', what: 'szakal', n: 4 },
    { kind: 'build', what: 'ognisko', n: 1 },
    { kind: 'buy', what: 'sila', n: 1 },
    { kind: 'hunt', what: 'szerszen', n: 6 },
    { kind: 'gather', what: 'wood', n: 5 },
    { kind: 'build', what: 'kuznia', n: 1 },
    { kind: 'forge', what: 'kij' },
    { kind: 'visit', what: 'asahel', joins: 'asahel', say: 'asahel' },
    { kind: 'hunt', what: 'wilk', n: 6 },
    { kind: 'level', n: 8 },
    { kind: 'guard' },
    { kind: 'gate' },
  ],
  wzgorza: [
    { kind: 'hunt', what: 'dzik', n: 4 },
    { kind: 'visit', what: 'sluga', say: 'sluga' },
    { kind: 'build', what: 'spichlerz', n: 1 },
    { kind: 'hunt', what: 'zmija', n: 6 },
    { kind: 'visit', what: 'abiszaj', joins: 'abiszaj', say: 'abiszaj' },
    { kind: 'buy', what: 'torba', n: 2 },
    { kind: 'hunt', what: 'hiena', n: 8 },
    { kind: 'level', n: 16 },
    { kind: 'guard' },
    { kind: 'gate' },
  ],
  ela: [
    { kind: 'visit', what: 'eliab', say: 'eliab' },
    { kind: 'hunt', what: 'skorpion', n: 6 },
    { kind: 'visit', what: 'saul', say: 'saul' },
    { kind: 'visit', what: 'brook', say: 'brook' },
    { kind: 'hunt', what: 'sep', n: 4 },
    { kind: 'level', n: 24 },
    { kind: 'guard' },
    { kind: 'visit', what: 'jonatan', joins: 'jonatan', gives: 'luk', say: 'jonatan' },
    { kind: 'gate' },
  ],
  gibea: [
    { kind: 'hunt', what: 'tur', n: 4 },
    { kind: 'forge', what: 'oszczep' },
    { kind: 'hunt', what: 'szerszen', n: 10 },
    { kind: 'build', what: 'owczarnia', n: 1 },
    { kind: 'level', n: 32 },
    { kind: 'guard' },
    { kind: 'gate' },
  ],
  engedi: [
    { kind: 'hunt', what: 'karakal', n: 6 },
    { kind: 'visit', what: 'abigail', joins: 'abigail', say: 'abigail' },
    { kind: 'hunt', what: 'skorpion', n: 8 },
    { kind: 'visit', what: 'benajasz', joins: 'benajasz', say: 'benajasz' },
    { kind: 'level', n: 40 },
    { kind: 'guard' },
    { kind: 'gate' },
  ],
  gat: [
    { kind: 'visit', what: 'itaj', say: 'itaj' },
    { kind: 'hunt', what: 'hiena', n: 10 },
    { kind: 'visit', what: 'szamma', joins: 'szamma', say: 'szamma' },
    { kind: 'hunt', what: 'wilk', n: 10 },
    { kind: 'level', n: 48 },
    { kind: 'guard' },
    { kind: 'gate' },
  ],
};

/** Later circles: a short chain of hunts and the guardian (the people already met). */
export function circleQuests(land: LandSpec): readonly QuestSpec[] {
  const kinds = [...new Set(land.camps.map(c => c[0]))];
  return [
    { kind: 'hunt', what: kinds[0], n: 8 },
    { kind: 'hunt', what: kinds[1] ?? kinds[0], n: 10 },
    { kind: 'guard' },
    { kind: 'gate' },
  ];
}

// ── the strategies under a block's name (never "concentrate harder") ──
export const TIPS = {
  warmup: [t('tip.warmup.1')],
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5'), t('tip.push.6')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3'), t('tip.rest.4')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;

// ── the lamb's lines (Kłębek, pulled from the lion's mouth) ──────
export type Moment =
  | 'open' | 'warm' | 'hunt' | 'push' | 'blind' | 'rest' | 'good' | 'gold4' | 'stoneReady' | 'stone'
  | 'level' | 'reward' | 'bagFull' | 'deliver' | 'build' | 'buy' | 'forge' | 'quest' | 'questDone'
  | 'thief' | 'thiefCaught' | 'thiefGone' | 'chest' | 'gift' | 'near' | 'down' | 'wake'
  | 'lion' | 'bear' | 'goliath' | 'guard' | 'daze' | 'driven' | 'fall' | 'joined' | 'land'
  | 'cave' | 'floor' | 'dawn' | 'restGift' | 'tens' | 'end';

/** How many variants each moment has in the catalog (`say.<moment>.<i>`, i from 1). */
export const LINE_COUNT: Readonly<Record<Moment, number>> = {
  open: 4, warm: 3, hunt: 3, push: 4, blind: 3, rest: 4, good: 4, gold4: 3, stoneReady: 3, stone: 3,
  level: 4, reward: 3, bagFull: 3, deliver: 3, build: 3, buy: 3, forge: 3, quest: 3, questDone: 3,
  thief: 3, thiefCaught: 3, thiefGone: 3, chest: 3, gift: 3, near: 3, down: 3, wake: 3,
  lion: 3, bear: 3, goliath: 4, guard: 3, daze: 3, driven: 3, fall: 3, joined: 3, land: 3,
  cave: 3, floor: 3, dawn: 3, restGift: 3, tens: 3, end: 3,
};
export const MOMENTS = Object.keys(LINE_COUNT) as Moment[];

export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(
  MOMENTS.map(m => [m, Array.from({ length: LINE_COUNT[m] }, (_, i) => t(`say.${m}.${i + 1}` as Key))]),
) as unknown as Record<Moment, readonly string[]>;

/** Goliath's taunts (his own bubble; he shouts, the lamb answers) and the giants' */
export const TAUNTS: readonly string[] = [t('taunt.1'), t('taunt.2'), t('taunt.3'), t('taunt.4')];
