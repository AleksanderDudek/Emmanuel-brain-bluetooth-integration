/**
 * Jerzy i smok's data: the six lands of the dragon's kingdom (each with its dragon — a beast with its
 * patterns, its **fatal flaw** the player learns to use, and the treasure of its hoard; driven off over
 * the hills, never killed), the four roads a land can be fought on again, the dragon's brood
 * (creatures that dissolve into smoke and scamper off when beaten), the weapons and the gear a
 * level-up offers with their numbers per level, the evolutions of a maxed pair, the duets of two
 * weapons, the companions who come along, the treasures of the dragons' hoard, the forge's permanent
 * upgrades, the armoury's pieces a knight earns, the strategies under a block's name and Princess
 * Linda's lines.  The words live in the catalog (i18n.ts), in this page's language.
 */
import { fmtNum } from '../../i18n';
import { t, type Key } from './i18n';

// ── the lands and their dragons ──────────────────────────────────
export type DragonKind = 'zielony' | 'bagienny' | 'skrzydlaty' | 'trzyglowy' | 'zarowy' | 'zloty';
export type ArenaKind = 'meadow' | 'marsh' | 'pass' | 'castle' | 'ash' | 'hoard';
export type Pattern = 'breath' | 'lanes' | 'rain' | 'swoop' | 'dive' | 'ring' | 'embers' | 'coins' | 'sweep';
/** each dragon's own weakness (the "chess move" against him) */
export type FlawKind = 'steam' | 'mud' | 'crash' | 'tangle' | 'heat' | 'greed';

export interface DragonSpec {
  kind: DragonKind;
  arena: ArenaKind;
  /** his scales on the squire's road */
  hp: number;
  /** pace (× the base) */
  pace: number;
  patterns: readonly (readonly [Pattern, number])[];
  /** the pattern he adds from the knight's road on (with this weight) */
  extra: readonly [Pattern, number];
  flaw: FlawKind;
  /** the treasure of his hoard: his big chest gives it the first time he is driven off */
  hoard: TreasureId;
}

export const DRAGONS: readonly DragonSpec[] = [
  { kind: 'zielony', arena: 'meadow', hp: 2400, pace: 1, patterns: [['breath', 3], ['lanes', 1.5], ['rain', 1]], extra: ['sweep', 1.2], flaw: 'steam', hoard: 'lustro' },
  { kind: 'bagienny', arena: 'marsh', hp: 3000, pace: 1.04, patterns: [['dive', 2.6], ['rain', 2.4], ['breath', 1]], extra: ['lanes', 1.2], flaw: 'mud', hoard: 'dzban' },
  { kind: 'skrzydlaty', arena: 'pass', hp: 3600, pace: 1.08, patterns: [['swoop', 3], ['rain', 1.5], ['breath', 1]], extra: ['lanes', 1.1], flaw: 'crash', hoard: 'pioro' },
  { kind: 'trzyglowy', arena: 'castle', hp: 4300, pace: 1.1, patterns: [['breath', 2.5], ['lanes', 2], ['rain', 2], ['swoop', 1]], extra: ['ring', 1], flaw: 'tangle', hoard: 'klepsydra' },
  { kind: 'zarowy', arena: 'ash', hp: 5000, pace: 1.1, patterns: [['ring', 2.6], ['embers', 1.4], ['breath', 2]], extra: ['rain', 1.2], flaw: 'heat', hoard: 'krzesiwo' },
  { kind: 'zloty', arena: 'hoard', hp: 5800, pace: 1.12, patterns: [['coins', 3], ['sweep', 2], ['swoop', 1]], extra: ['rain', 1], flaw: 'greed', hoard: 'mapa' },
];
export const DRAGON_KINDS = DRAGONS.map(d => d.kind);

export const dragonName = (k: DragonKind): string => t(`dragon.${k}` as Key);
export const townName = (k: DragonKind): string => t(`town.${k}` as Key);
export const townStory = (k: DragonKind): string => t(`story.${k}` as Key);
export const flawName = (k: FlawKind): string => t(`flaw.${k}` as Key);
export const flawText = (k: FlawKind): string => t(`flaw.${k}.text` as Key);
export const flawHint = (k: FlawKind): string => t(`flaw.${k}.hint` as Key);

/** The roads a land is fought on: 0 the squire's, 1 the knight's, 2 the hero's, 3 and beyond the legend's. */
export const ROADS = 4;
export const roadName = (tier: number): string => (tier < ROADS - 1 ? t(`road.${Math.max(0, tier)}` as Key) : tier === ROADS - 1 ? t('road.3') : t('road.n', { n: tier - ROADS + 2 }));

// ── the brood ────────────────────────────────────────────────────
export type BroodKind = 'piskle' | 'jaszczurka' | 'plujka' | 'pancernik' | 'ognik';

export interface BroodSpec {
  kind: BroodKind;
  hp: number;
  speed: number;
  r: number;
  /** the scale it leaves: 1 bronze, 3 silver, 10 gold */
  xp: number;
  /** from this run time on (s) it joins the waves, with this weight */
  from: number;
  weight: number;
  /** a spitter keeps this distance (u) and spits every `spit` s */
  keep?: number;
  spit?: number;
  /** comes in packs of this many */
  pack?: number;
}

export const BROOD: Readonly<Record<BroodKind, BroodSpec>> = {
  piskle: { kind: 'piskle', hp: 3, speed: 1.45, r: 0.32, xp: 1, from: 0, weight: 4 },
  jaszczurka: { kind: 'jaszczurka', hp: 2, speed: 2.4, r: 0.27, xp: 1, from: 16, weight: 2.5, pack: 3 },
  plujka: { kind: 'plujka', hp: 5, speed: 1.25, r: 0.34, xp: 2, from: 8, weight: 1.2, keep: 4.2, spit: 3.0 },
  pancernik: { kind: 'pancernik', hp: 16, speed: 0.95, r: 0.5, xp: 2, from: 55, weight: 1.2 },
  ognik: { kind: 'ognik', hp: 1, speed: 3.0, r: 0.2, xp: 1, from: 80, weight: 2, pack: 5 },
};
export const BROOD_KINDS = Object.keys(BROOD) as BroodKind[];

// ── weapons and gear (one run's build) ───────────────────────────
export type WeaponId = 'miecz' | 'kopia' | 'sokol' | 'wiadra' | 'rog' | 'kon' | 'mlot' | 'kusza' | 'kolce';
export type GearId = 'sztandar' | 'rekawice' | 'buty' | 'tarcza' | 'zbroja' | 'sakwa' | 'kolczan' | 'plaszcz' | 'pierscien';
export type ItemId = WeaponId | GearId;

/**
 * A weapon's numbers by level: index 0..4 are levels 1..5, index 5 the evolved weapon.  `dmg`
 * damage per hit, `cd` seconds between uses, `area` its reach or radius (u), `n` how many at once.
 */
export interface WeaponSpec { id: WeaponId; pair: GearId; dmg: readonly number[]; cd: readonly number[]; area: readonly number[]; n: readonly number[] }

export const WEAPONS: Readonly<Record<WeaponId, WeaponSpec>> = {
  // the sword: a sweep toward the nearest creature (area = reach); n = the arc in tenths of a full turn
  miecz: { id: 'miecz', pair: 'sztandar', dmg: [3, 4, 5, 6, 8, 11], cd: [1.1, 1.0, 0.92, 0.85, 0.78, 0.7], area: [1.8, 1.9, 2.0, 2.15, 2.3, 2.8], n: [3.3, 3.8, 4.2, 4.6, 5, 10] },
  // the lance: thrown at the nearest; n lances, each piercing area creatures (area = pierce)
  kopia: { id: 'kopia', pair: 'rekawice', dmg: [5, 6, 7, 8, 10, 12], cd: [1.7, 1.55, 1.4, 1.25, 1.1, 0.9], area: [1, 2, 2, 3, 3, 6], n: [1, 1, 2, 2, 3, 6] },
  // the falcon: n birds circling at area u; cd = seconds per turn
  sokol: { id: 'sokol', pair: 'buty', dmg: [2, 3, 3, 4, 4, 6], cd: [2.4, 2.2, 2.1, 2.0, 1.9, 1.5], area: [1.9, 1.9, 2.0, 2.0, 2.1, 2.4], n: [1, 1, 2, 2, 3, 4] },
  // the squire's buckets: a splash at a creature (area = radius); the evolved spring leaves a pool
  wiadra: { id: 'wiadra', pair: 'tarcza', dmg: [4, 5, 6, 7, 8, 9], cd: [3, 2.7, 2.4, 2.1, 1.8, 1.6], area: [1.0, 1.15, 1.3, 1.45, 1.6, 1.8], n: [1, 1, 1, 2, 2, 3] },
  // the horn: a ring of sound around the knight (area = radius), throwing the brood back
  rog: { id: 'rog', pair: 'zbroja', dmg: [3, 4, 4, 5, 6, 9], cd: [4, 3.6, 3.2, 2.8, 2.4, 2.2], area: [2.6, 2.85, 3.1, 3.35, 3.6, 5], n: [1, 1, 1, 1, 1, 1] },
  // the white horse: n charges across the field near the knight (area = width)
  kon: { id: 'kon', pair: 'sakwa', dmg: [12, 15, 18, 21, 24, 30], cd: [9, 8, 7, 6, 5, 4.5], area: [1.2, 1.2, 1.3, 1.3, 1.4, 1.6], n: [1, 1, 1, 2, 2, 3] },
  // the hammer: thrown at the nearest, out to `area` u and back, striking all it passes (each way)
  mlot: { id: 'mlot', pair: 'pierscien', dmg: [6, 7, 8, 10, 12, 16], cd: [2.3, 2.1, 1.9, 1.7, 1.5, 1.25], area: [4.4, 4.7, 5.0, 5.3, 5.6, 6.6], n: [1, 1, 1, 2, 2, 3] },
  // the crossbow: quick bolts at the strongest within 8 u (an elite, the dragon); area = pierce
  kusza: { id: 'kusza', pair: 'kolczan', dmg: [3, 4, 5, 6, 7, 9], cd: [0.9, 0.82, 0.74, 0.66, 0.58, 0.5], area: [1, 1, 2, 2, 3, 4], n: [1, 1, 1, 1, 2, 2] },
  // the caltrops: dropped at his feet every cd s as he goes; area = a caltrop's radius, n = how many
  kolce: { id: 'kolce', pair: 'plaszcz', dmg: [2, 3, 3, 4, 5, 6], cd: [1.5, 1.35, 1.2, 1.05, 0.9, 0.75], area: [0.6, 0.65, 0.7, 0.8, 0.9, 1.15], n: [1, 1, 2, 2, 3, 4] },
};
export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

/** Gear by level 1..3: what one level adds. */
export const GEAR: Readonly<Record<GearId, { per: number }>> = {
  sztandar: { per: 0.12 },   // damage +12 %
  rekawice: { per: 0.08 },   // time between uses −8 %
  buty: { per: 0.1 },        // speed +10 %
  tarcza: { per: 0.25 },     // the aura's base radius +0.25 u, its beat +1 damage
  zbroja: { per: 0.12 },     // hearts lost −12 %
  sakwa: { per: 0.35 },      // pickup radius +35 %
  kolczan: { per: 1 },       // projectiles +1 (+2 at level 3)
  plaszcz: { per: 0.12 },    // the weapons' reach and size +12 %
  pierscien: { per: 0.08 },  // critical blows +8 %
};
export const GEAR_IDS = Object.keys(GEAR) as GearId[];

export const isWeapon = (id: ItemId): id is WeaponId => id in WEAPONS;
export const itemName = (id: ItemId): string => t(`item.${id}` as Key);
export const evoName = (id: WeaponId): string => t(`evo.${id}` as Key);
/** The quiver's extra projectiles at a level (0..3). */
export const quiverOf = (level: number): number => (level >= 3 ? 2 : level >= 1 ? 1 : 0);

const f1 = (v: number): string => fmtNum(v, Number.isInteger(v) ? 0 : 1);
const f2 = (v: number): string => fmtNum(v, Number.isInteger(v) ? 0 : Math.abs(v * 10 - Math.round(v * 10)) < 1e-6 ? 1 : 2);

/** A weapon's numbers at a level (1..5, 6 = evolved), in words: "obrażenia 4 · co 1,0 s · zasięg 1,9 m". */
export function weaponStats(id: WeaponId, level: number): string {
  const w = WEAPONS[id], i = Math.max(0, Math.min(5, level - 1));
  return t(`stats.${id}` as Key, { d: f1(w.dmg[i]), c: f2(w.cd[i]), a: f1(w.area[i]), n: f1(w.n[i]), deg: Math.round(w.n[i] * 36) });
}

/** A piece of gear's effect at a level (1..3), in words: "obrażenia +24%". */
export function gearStats(id: GearId, level: number): string {
  const per = GEAR[id].per * level;
  return t(`stats.${id}` as Key, { p: Math.round(per * 100), a: f2(per), d: level, n: quiverOf(level) });
}

// ── duets: two weapons that change each other ────────────────────
export type DuetId = 'turniej' | 'pobudka' | 'ulewa' | 'lowy' | 'zasadzka' | 'kuznia';
export interface DuetSpec { id: DuetId; a: WeaponId; b: WeaponId }
export const DUETS: readonly DuetSpec[] = [
  { id: 'turniej', a: 'kopia', b: 'kon' },     // the horses carry lances: charges +60 %
  { id: 'pobudka', a: 'miecz', b: 'rog' },     // after a horn blast the next sweep goes all round
  { id: 'ulewa', a: 'wiadra', b: 'rog' },      // the horn's ring sprays water: fire in its reach goes out
  { id: 'lowy', a: 'sokol', b: 'kusza' },      // one more falcon, bolts +25 %
  { id: 'zasadzka', a: 'kolce', b: 'kon' },    // the horse scatters caltrops along its lane
  { id: 'kuznia', a: 'mlot', b: 'miecz' },     // both +10 %, the sword's blows critical +15 %
];
export const duetName = (id: DuetId): string => t(`duet.${id}` as Key);
export const duetText = (id: DuetId): string => t(`duet.${id}.text` as Key);

// ── the companions (unlocked by play, chosen in the lobby) ───────
export type CompanionId = 'pies' | 'iskierka' | 'jez' | 'bobr';
export const COMPANIONS: readonly CompanionId[] = ['pies', 'iskierka', 'jez', 'bobr'];
export const palName = (id: CompanionId): string => t(`pal.${id}` as Key);
export const palText = (id: CompanionId): string => t(`pal.${id}.text` as Key);
export const palHow = (id: CompanionId): string => t(`pal.${id}.how` as Key);
/** A companion's numbers at a level (1..4) for its card. */
export function palStats(id: CompanionId, level: number): string {
  const L = Math.max(1, Math.min(4, level));
  return t(`stats.pal.${id}` as Key, {
    d: f1(id === 'pies' ? 3 + 1.5 * (L - 1) : id === 'iskierka' ? 4 + 2 * (L - 1) : id === 'jez' ? 3 + 1.5 * (L - 1) : 2 + (L - 1)),
    c: f2(id === 'iskierka' ? 2.2 - 0.3 * (L - 1) : id === 'bobr' ? 9 - (L - 1) : id === 'jez' ? 2.6 - 0.2 * (L - 1) : 0.7),
    a: f1(id === 'pies' ? 6.5 + (L - 1) : id === 'iskierka' ? 2.4 + 0.4 * (L - 1) : id === 'jez' ? 2.3 + 0.2 * (L - 1) : 2.6 + 0.5 * (L - 1)),
  });
}

// ── the treasures of the dragons' hoard (one run's modifiers, a collection for good) ──
export type TreasureId = 'lustro' | 'dzban' | 'pioro' | 'klepsydra' | 'krzesiwo' | 'mapa' | 'podkowa' | 'oselka' | 'kowadlo' | 'jablon' | 'kompas' | 'ogniwo';
export const TREASURES: readonly TreasureId[] = ['lustro', 'dzban', 'pioro', 'klepsydra', 'krzesiwo', 'mapa', 'podkowa', 'oselka', 'kowadlo', 'jablon', 'kompas', 'ogniwo'];
/** the weapon a treasure works on (its card says so) */
export const TREASURE_ON: Partial<Record<TreasureId, WeaponId>> = { dzban: 'wiadra', pioro: 'sokol', podkowa: 'kon', oselka: 'miecz' };
export const treasureName = (id: TreasureId): string => t(`tr.${id}` as Key);
export const treasureText = (id: TreasureId): string => t(`tr.${id}.text` as Key);

// ── the forge (permanent upgrades, bought with scales in the lobby) ──
export type ForgeId = 'sila' | 'serce' | 'krok' | 'magnes' | 'oslona' | 'nauka' | 'los' | 'druh';

export interface ForgeSpec { id: ForgeId; max: number; cost: number; per: number }

export const FORGE: readonly ForgeSpec[] = [
  { id: 'sila', max: 5, cost: 220, per: 0.08 },     // damage +8 %
  { id: 'serce', max: 3, cost: 500, per: 1 },      // +1 heart
  { id: 'krok', max: 3, cost: 180, per: 0.05 },     // speed +5 %
  { id: 'magnes', max: 3, cost: 180, per: 0.15 },   // pickup +15 %
  { id: 'oslona', max: 3, cost: 330, per: 0.12 },   // the aura's base +0.12 u
  { id: 'nauka', max: 3, cost: 260, per: 0.1 },     // scales count +10 % toward a level
  { id: 'los', max: 2, cost: 300, per: 1 },         // +1 reshuffle a run
  { id: 'druh', max: 2, cost: 450, per: 1 },       // companions start a level higher
];
export const forgeSpec = (id: ForgeId): ForgeSpec => FORGE.find(f => f.id === id)!;
/** The price of the next level of a forge upgrade (null: at its top): 1, 3, 6, 10, 15 × the first. */
export function forgeCost(id: ForgeId, have: number): number | null {
  const f = forgeSpec(id);
  return have >= f.max ? null : (f.cost * (have + 1) * (have + 2)) / 2;
}

// ── the armoury (the knight's gear, earned by milestones, worn for good) ──
export type ArmourId = 'helm' | 'ostrogi' | 'proporzec' | 'pas' | 'kosz' | 'slonce' | 'wieniec' | 'karwasz';
export const ARMOUR: readonly ArmourId[] = ['proporzec', 'helm', 'ostrogi', 'pas', 'kosz', 'slonce', 'wieniec', 'karwasz'];
export const armourName = (id: ArmourId): string => t(`armour.${id}` as Key);
export const armourText = (id: ArmourId): string => t(`armour.${id}.text` as Key);
export const armourHow = (id: ArmourId): string => t(`armour.${id}.how` as Key);

// ── the strategies under a block's name (never "concentrate harder") ──
export const TIPS = {
  warmup: [t('tip.warmup.1')],
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5'), t('tip.push.6')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3'), t('tip.rest.4')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;

// ── Princess Linda's lines ───────────────────────────────────────
export type Moment =
  | 'open' | 'warm' | 'push' | 'blind' | 'rest' | 'good' | 'quench' | 'near' | 'swordReady' | 'sword'
  | 'level' | 'evolve' | 'chest' | 'elite' | 'wave' | 'boss' | 'flaw' | 'nap' | 'driven' | 'down'
  | 'runEnd' | 'newRun' | 'end' | 'apple'
  | 'fatal' | 'treasure' | 'duet' | 'reroll' | 'road'
  | 'hint_zielony' | 'hint_bagienny' | 'hint_skrzydlaty' | 'hint_trzyglowy' | 'hint_zarowy' | 'hint_zloty'
  | 'pal_pies' | 'pal_iskierka' | 'pal_jez' | 'pal_bobr';

/** How many variants each moment has in the catalog (`say.<moment>.<i>`, i from 1). */
export const LINE_COUNT: Readonly<Record<Moment, number>> = {
  open: 4, warm: 3, push: 4, blind: 3, rest: 4, good: 4, quench: 4, near: 3, swordReady: 3, sword: 3,
  level: 4, evolve: 3, chest: 3, elite: 3, wave: 3, boss: 4, flaw: 3, nap: 3, driven: 3, down: 3,
  runEnd: 3, newRun: 3, end: 3, apple: 3,
  fatal: 4, treasure: 3, duet: 3, reroll: 3, road: 3,
  hint_zielony: 3, hint_bagienny: 3, hint_skrzydlaty: 3, hint_trzyglowy: 3, hint_zarowy: 3, hint_zloty: 3,
  pal_pies: 3, pal_iskierka: 3, pal_jez: 3, pal_bobr: 3,
};

export const MOMENTS = Object.keys(LINE_COUNT) as Moment[];

export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(
  MOMENTS.map(m => [m, Array.from({ length: LINE_COUNT[m] }, (_, i) => t(`say.${m}.${i + 1}` as Key))]),
) as unknown as Record<Moment, readonly string[]>;
