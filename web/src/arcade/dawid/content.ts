/**
 * Dawid's data: the six lands of David's road (each a map with its shepherds' camp, its beast camps,
 * brushwood and stone heaps, the brook, a chest, the people who give quests, the guardian's lair and
 * the gate it holds), the beasts (struck, they lose heart and run off into the hills — nothing dies),
 * the guardians (the lion, the she-bear, Goliath, the great aurochs, the leopard of En-Gedi, the giants
 * of Gath), the companions who join through the story and their kit skills, the weapons and their
 * evolutions, the ability ladder, the camp's buildings, the quest chains, the strategies under a
 * block's name and the lamb's moments.  The words live in the catalog (i18n.ts).
 */
import { CHAINS, type QuestKind, type QuestSpec } from './chains';
import { t, type Key } from './i18n';
import { MAPS, allSpots, type LandMap } from './lands';

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
/** a place on a land's map the quests send David to (lands.ts: each area's spots) */
export type Spot = string;
export type NodeKind = 'wood' | 'stone';

/**
 * A land: its map (lands.ts — three areas side by side, each with its fire, dens, heaps, chest, people and
 * landmarks; the passes between them; the lair and the gate in the last), and the round-5 fields read from it: the
 * first area's camp and chest, every den, heap and spot of the land.
 */
export interface LandSpec extends LandMap {
  /** the first area's shepherds' fire, where a land begins */
  camp: readonly [number, number];
  /** every beast camp of the land (kind, x, y, how many) */
  camps: readonly (readonly [BeastKind, number, number, number])[];
  /** every brushwood and stone heap */
  nodes: readonly (readonly [NodeKind, number, number])[];
  /** the first area's chest place */
  chest: readonly [number, number];
  /** every spot of the land */
  spots: Readonly<Record<string, readonly [number, number]>>;
}

export const LANDS: readonly LandSpec[] = MAPS.map(m => ({
  ...m,
  camp: m.areas[0].camp,
  camps: m.areas.flatMap(a => a.dens),
  nodes: m.areas.flatMap(a => a.nodes),
  chest: m.areas[0].chest,
  spots: allSpots(m),
}));
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

// ── quests (each land's chain, area by area: chains.ts) ──────────
export type { QuestKind, QuestSpec };
export const QUESTS: Readonly<Record<LandId, readonly QuestSpec[]>> = CHAINS;

/** Later circles: a short chain of hunts and the guardian (the people already met). */
export function circleQuests(land: LandSpec): readonly QuestSpec[] {
  const kinds = [...new Set(land.camps.map(c => c[0]))];
  const last = land.areas.length - 1;
  const areaOf = (k: BeastKind): number => Math.max(0, land.areas.findIndex(a => a.dens.some(d => d[0] === k)));
  return [
    { kind: 'hunt', what: kinds[0], n: 8, area: areaOf(kinds[0]) },
    { kind: 'hunt', what: kinds[1] ?? kinds[0], n: 10, area: areaOf(kinds[1] ?? kinds[0]) },
    { kind: 'guard', area: last },
    { kind: 'gate', area: last },
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

/** The lamb's lines that speak of the hand ("Stuknij!"): a mouse hears their `.keys` words (a click, a key). */
export const HAND_LINES: ReadonlySet<string> = new Set(['say.warm.1', 'say.hunt.2', 'say.stoneReady.1', 'say.stoneReady.3', 'say.bagFull.3']);

/** The lamb's lines for the player's hand: a finger's (LINES), or a mouse's (the hand's lines in its own words). */
export function linesFor(touch: boolean): Readonly<Record<Moment, readonly string[]>> {
  if (touch) return LINES;
  return Object.fromEntries(MOMENTS.map(m => [m, Array.from({ length: LINE_COUNT[m] }, (_, i) => {
    const k = `say.${m}.${i + 1}`;
    return t((HAND_LINES.has(k) ? `${k}.keys` : k) as Key);
  })])) as unknown as Record<Moment, readonly string[]>;
}

/** Goliath's taunts (his own bubble; he shouts, the lamb answers) and the giants' */
export const TAUNTS: readonly string[] = [t('taunt.1'), t('taunt.2'), t('taunt.3'), t('taunt.4')];
