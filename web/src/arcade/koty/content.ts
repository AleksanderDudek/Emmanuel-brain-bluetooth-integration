/**
 * Kocia straż's data: the six places of the abbey (each with its pests and its chief), the pests (how
 * they move, what they are, what they bring), the chiefs and their tricks, the toy families (how each
 * fires) and the grades, the twelve abbey cats (their coats, their gifts, when they join), the perks of
 * the vintage, the strategies under a block's name and Brother Anselm's lines.  The words live in the
 * catalog (i18n.ts), in this page's language.
 */
import { fmtNum, lang } from '../../i18n';
import { RULES } from './rules';
import { CATALOGS, bare, t, type Key } from './i18n';

// ── the places ───────────────────────────────────────────────────
export type PlaceId = 'winnica' | 'spichlerz' | 'sad' | 'warzywnik' | 'staw' | 'skryptorium';
export type PestId = 'liszka' | 'wrobel' | 'mysz' | 'szczur' | 'szpak' | 'wrona' | 'slimak' | 'zajac' | 'kormoran' | 'wydra' | 'rybik' | 'mol' | 'kolatek';
export type BossId = 'lis' | 'krol' | 'hrabina' | 'kret' | 'czapla' | 'ksiazkowy';
export type Trait = 'ground' | 'air' | 'swarm' | 'armour';
export type Motion = 'walk' | 'hop' | 'fly' | 'scurry' | 'flutter' | 'creep' | 'swim';
export type Trick = 'dash' | 'summon' | 'fly' | 'dig' | 'gust' | 'dust';

export interface PlaceSpec {
  id: PlaceId;
  /** the pests that come here, with weights */
  pests: readonly (readonly [PestId, number])[];
  boss: BossId;
}

export const PLACES: readonly PlaceSpec[] = [
  { id: 'winnica', pests: [['liszka', 3], ['wrobel', 2]], boss: 'lis' },
  { id: 'spichlerz', pests: [['mysz', 3], ['szczur', 1.4]], boss: 'krol' },
  { id: 'sad', pests: [['szpak', 2.5], ['wrona', 1.5], ['wrobel', 0.8]], boss: 'hrabina' },
  { id: 'warzywnik', pests: [['slimak', 1.6], ['zajac', 2], ['mysz', 0.8]], boss: 'kret' },
  { id: 'staw', pests: [['kormoran', 2], ['wydra', 1.8]], boss: 'czapla' },
  { id: 'skryptorium', pests: [['rybik', 2.5], ['mol', 2], ['kolatek', 1.2]], boss: 'ksiazkowy' },
];

export interface PestSpec {
  id: PestId;
  /** courage and fish (× the stage's base) */
  hp: number;
  fish: number;
  /** speed (u/s), radius (u) */
  speed: number;
  r: number;
  motion: Motion;
  trait: Trait;
  /** how many come in one group */
  group: readonly [number, number];
}

export const PESTS: Readonly<Record<PestId, PestSpec>> = {
  liszka: { id: 'liszka', hp: 1, fish: 1, speed: 1.35, r: 0.42, motion: 'walk', trait: 'ground', group: [1, 2] },
  wrobel: { id: 'wrobel', hp: 0.45, fish: 0.5, speed: 3.2, r: 0.26, motion: 'fly', trait: 'air', group: [2, 4] },
  mysz: { id: 'mysz', hp: 0.4, fish: 0.45, speed: 2.4, r: 0.24, motion: 'scurry', trait: 'swarm', group: [3, 5] },
  szczur: { id: 'szczur', hp: 1.8, fish: 1.7, speed: 1.0, r: 0.42, motion: 'walk', trait: 'ground', group: [1, 1] },
  szpak: { id: 'szpak', hp: 0.4, fish: 0.45, speed: 2.8, r: 0.24, motion: 'flutter', trait: 'air', group: [3, 5] },
  wrona: { id: 'wrona', hp: 1.5, fish: 1.4, speed: 1.7, r: 0.4, motion: 'hop', trait: 'air', group: [1, 2] },
  slimak: { id: 'slimak', hp: 2.6, fish: 2.2, speed: 0.35, r: 0.4, motion: 'creep', trait: 'armour', group: [1, 2] },
  zajac: { id: 'zajac', hp: 1.1, fish: 1.1, speed: 2.0, r: 0.4, motion: 'hop', trait: 'ground', group: [1, 2] },
  kormoran: { id: 'kormoran', hp: 1, fish: 1, speed: 2.4, r: 0.4, motion: 'fly', trait: 'air', group: [1, 3] },
  wydra: { id: 'wydra', hp: 1.4, fish: 1.4, speed: 1.6, r: 0.44, motion: 'swim', trait: 'ground', group: [1, 2] },
  rybik: { id: 'rybik', hp: 0.3, fish: 0.35, speed: 2.8, r: 0.2, motion: 'scurry', trait: 'swarm', group: [4, 7] },
  mol: { id: 'mol', hp: 0.6, fish: 0.6, speed: 1.5, r: 0.28, motion: 'flutter', trait: 'air', group: [2, 3] },
  kolatek: { id: 'kolatek', hp: 2.2, fish: 2, speed: 0.55, r: 0.34, motion: 'creep', trait: 'armour', group: [1, 2] },
};
export const PEST_IDS = Object.keys(PESTS) as PestId[];

export interface BossSpec {
  id: BossId;
  place: PlaceId;
  /** × the boss courage of the stage */
  hp: number;
  r: number;
  trick: Trick;
  /** how long the trick lasts (s) */
  trickSec: number;
}

export const BOSSES: Readonly<Record<BossId, BossSpec>> = {
  lis: { id: 'lis', place: 'winnica', hp: 1, r: 0.85, trick: 'dash', trickSec: 0.7 },
  krol: { id: 'krol', place: 'spichlerz', hp: 1.05, r: 0.9, trick: 'summon', trickSec: 0.6 },
  hrabina: { id: 'hrabina', place: 'sad', hp: 1, r: 0.85, trick: 'fly', trickSec: 1.8 },
  kret: { id: 'kret', place: 'warzywnik', hp: 1.1, r: 0.9, trick: 'dig', trickSec: 1.8 },
  czapla: { id: 'czapla', place: 'staw', hp: 1.05, r: 0.95, trick: 'gust', trickSec: 1.4 },
  ksiazkowy: { id: 'ksiazkowy', place: 'skryptorium', hp: 1.1, r: 0.9, trick: 'dust', trickSec: 2.4 },
};
export const BOSS_IDS = Object.keys(BOSSES) as BossId[];

export const placeName = (id: PlaceId): string => t(`place.${id}` as Key);
export const pestName = (id: PestId): string => t(`pest.${id}` as Key);
export const bossName = (id: BossId): string => t(`boss.${id}` as Key);
export const trickName = (k: Trick): string => t(`trick.${k}` as Key);

// ── stages ───────────────────────────────────────────────────────
export interface StageInfo {
  /** the stage (1-based, never resets inside a year), its place, the place's index, the round (year of the loop) */
  n: number;
  place: PlaceSpec;
  placeIdx: number;
  round: number;
  /** 1..5 inside the place; 5 = the boss stage */
  inPlace: number;
  boss: boolean;
}

export function stageInfo(n: number): StageInfo {
  const s = Math.max(1, Math.floor(n));
  const per = RULES.stagesPerPlace;
  const k = Math.floor((s - 1) / per);
  const placeIdx = k % RULES.places;
  const inPlace = ((s - 1) % per) + 1;
  return { n: s, place: PLACES[placeIdx], placeIdx, round: Math.floor(k / RULES.places), inPlace, boss: inPlace === per };
}

// ── the toys ─────────────────────────────────────────────────────
export type FamId = 'proca' | 'dmuchawka' | 'konewka' | 'sikawka' | 'klebek' | 'banki' | 'lusterko' | 'katapulta';
export type Pattern = 'single' | 'rapid' | 'spray' | 'pierce' | 'bounce' | 'splash' | 'beam' | 'lob';

export interface FamSpec {
  id: FamId;
  pattern: Pattern;
  /** seconds between shots at ×1 */
  cd: number;
  /** the main hit at grade 1 */
  dmg: number;
  /** the side hits (spray, bounce, splash, lob): their share of the main hit, how many, the reach (u) */
  side: number;
  n: number;
  area: number;
  good: Trait;
}

export const FAMS: Readonly<Record<FamId, FamSpec>> = {
  proca: { id: 'proca', pattern: 'single', cd: 0.75, dmg: 1, side: 0, n: 0, area: 0, good: 'ground' },
  dmuchawka: { id: 'dmuchawka', pattern: 'rapid', cd: 0.26, dmg: 0.34, side: 0, n: 0, area: 0, good: 'air' },
  konewka: { id: 'konewka', pattern: 'spray', cd: 0.9, dmg: 1, side: 0.5, n: 2, area: 1.7, good: 'armour' },
  sikawka: { id: 'sikawka', pattern: 'pierce', cd: 0.95, dmg: 1.2, side: 0.8, n: 6, area: 0.55, good: 'swarm' },
  klebek: { id: 'klebek', pattern: 'bounce', cd: 1.05, dmg: 1.15, side: 0.7, n: 2, area: 2.6, good: 'swarm' },
  banki: { id: 'banki', pattern: 'splash', cd: 1.25, dmg: 1.35, side: 0.55, n: 8, area: 1.4, good: 'armour' },
  lusterko: { id: 'lusterko', pattern: 'beam', cd: 0.2, dmg: 0.28, side: 0, n: 0, area: 0, good: 'air' },
  katapulta: { id: 'katapulta', pattern: 'lob', cd: 1.6, dmg: 2.2, side: 0.45, n: 8, area: 1.6, good: 'ground' },
};
export const FAM_IDS = Object.keys(FAMS) as FamId[];

export interface Toy { fam: FamId; g: number }

export const famName = (id: FamId): string => t(`fam.${id}` as Key);
export const famText = (id: FamId): string => t(`fam.${id}.text` as Key);
export const gradeName = (g: number): string => t(`grade.${Math.max(1, Math.min(RULES.grades, Math.floor(g)))}` as Key);
export const traitName = (k: Trait): string => t(`trait.${k}` as Key);

/** A toy's main hit at its grade, before the cat's gift, the upgrades and alertness. */
export const toyHit = (toy: Toy): number => FAMS[toy.fam].dmg * RULES.gradeK ** (toy.g - 1);

/** A toy's single-target damage per second at ×1 (for comparing toys). */
export const toyDps = (toy: Toy): number => toyHit(toy) / FAMS[toy.fam].cd;

/** Grade colours: wood, paint, copper, brass, silver, gold, pearl, crystal, amber, opal, ruby, sun. */
export const GRADE_COLORS: readonly string[] = [
  '#b98a5a', '#e07a5f', '#c8753c', '#d6b04c', '#c9d2dc', '#ffd166', '#f1e6d8', '#9fe3f5', '#f2a541', '#b8a1e8', '#e5486a', '#fff3a8',
];
export const gradeColor = (g: number): string => GRADE_COLORS[Math.max(0, Math.min(GRADE_COLORS.length - 1, Math.floor(g) - 1))];

// ── the cats ─────────────────────────────────────────────────────
export type CatId = 'mruczek' | 'rudy' | 'kluska' | 'psotka' | 'sadza' | 'sniezka' | 'pangur' | 'bursztyn' | 'tygrys' | 'mila' | 'szperacz' | 'baron';
export type Gift = 'purr' | 'brave' | 'gourmand' | 'quick' | 'pierce' | 'freeze' | 'crit' | 'golden' | 'boss' | 'hunt' | 'finder' | 'splash';
export type CoatPattern = 'tabby' | 'solid' | 'tuxedo' | 'calico' | 'long' | 'point';

export interface Coat { base: string; dark: string; light: string; eye: string; pattern: CoatPattern }

export type Join =
  | { kind: 'start' }
  | { kind: 'stage'; n: number }
  | { kind: 'boss'; id: BossId }
  | { kind: 'vintage' }
  | { kind: 'sessions'; n: number }
  | { kind: 'hunts'; n: number };

export interface CatSpec { id: CatId; gift: Gift; coat: Coat; join: Join; size: number }

export const CATS: readonly CatSpec[] = [
  { id: 'mruczek', gift: 'purr', join: { kind: 'start' }, size: 1, coat: { base: '#9a8f86', dark: '#5f554e', light: '#e9e1d8', eye: '#9ccf6a', pattern: 'tabby' } },
  { id: 'rudy', gift: 'brave', join: { kind: 'start' }, size: 1.02, coat: { base: '#e8893a', dark: '#b65a1c', light: '#ffe2c2', eye: '#7ed0a0', pattern: 'tabby' } },
  { id: 'kluska', gift: 'gourmand', join: { kind: 'stage', n: 3 }, size: 1.12, coat: { base: '#f2e4cf', dark: '#c9a77e', light: '#fffaf1', eye: '#e8b04c', pattern: 'calico' } },
  { id: 'psotka', gift: 'quick', join: { kind: 'boss', id: 'lis' }, size: 0.84, coat: { base: '#b9b3ad', dark: '#6e6761', light: '#f6f1ea', eye: '#8fc7ff', pattern: 'tuxedo' } },
  { id: 'sadza', gift: 'pierce', join: { kind: 'boss', id: 'krol' }, size: 1, coat: { base: '#2c2a30', dark: '#141217', light: '#57525d', eye: '#f5d35a', pattern: 'solid' } },
  { id: 'sniezka', gift: 'freeze', join: { kind: 'boss', id: 'hrabina' }, size: 0.97, coat: { base: '#f7f5f2', dark: '#cfc8c0', light: '#ffffff', eye: '#7fb8ff', pattern: 'solid' } },
  { id: 'tygrys', gift: 'boss', join: { kind: 'boss', id: 'kret' }, size: 1.06, coat: { base: '#c9a26b', dark: '#5a4128', light: '#f1e2c4', eye: '#b6d36a', pattern: 'tabby' } },
  { id: 'szperacz', gift: 'finder', join: { kind: 'boss', id: 'czapla' }, size: 0.95, coat: { base: '#a5866a', dark: '#5e4632', light: '#efe1d2', eye: '#d9a948', pattern: 'calico' } },
  { id: 'pangur', gift: 'crit', join: { kind: 'boss', id: 'ksiazkowy' }, size: 1, coat: { base: '#fbfaf6', dark: '#d8d0c4', light: '#ffffff', eye: '#6fbf73', pattern: 'point' } },
  { id: 'mila', gift: 'hunt', join: { kind: 'vintage' }, size: 1.08, coat: { base: '#8f7f72', dark: '#4e433b', light: '#efe6dc', eye: '#e6c25a', pattern: 'calico' } },
  { id: 'bursztyn', gift: 'golden', join: { kind: 'hunts', n: 5 }, size: 1, coat: { base: '#d9a05b', dark: '#9a6630', light: '#fbe7c8', eye: '#ffbf2e', pattern: 'solid' } },
  { id: 'baron', gift: 'splash', join: { kind: 'sessions', n: 7 }, size: 1.1, coat: { base: '#8e949c', dark: '#5b6067', light: '#dfe3e8', eye: '#f0b65a', pattern: 'long' } },
];
export const CAT_IDS = CATS.map(c => c.id);
export const catSpec = (id: CatId): CatSpec => CATS.find(c => c.id === id) ?? CATS[0];
export const catName = (id: CatId): string => t(`cat.${id}` as Key);
export const catBio = (id: CatId): string => t(`cat.${id}.bio` as Key);
export const giftText = (g: Gift): string => t(`gift.${g}` as Key);

/** The words for how a cat joins ("od etapu 3", "gdy przegonisz: Stary Lis"). */
export function joinText(j: Join): string {
  switch (j.kind) {
    case 'start': return t('join.start');
    case 'stage': return t('join.stage', { n: j.n });
    case 'boss': return t('join.boss', { name: bossName(j.id) });
    case 'vintage': return t('join.vintage');
    case 'sessions': return t('join.sessions', { n: j.n });
    case 'hunts': return t('join.hunts', { n: j.n });
  }
}

// ── the perks (golden fish) ─────────────────────────────────────
export type PerkId = 'oczy' | 'spizarnia' | 'kufer' | 'parapet' | 'lowy' | 'skrot' | 'warta' | 'gaweda';

export interface PerkSpec { id: PerkId; max: number; cost: readonly number[] | ((level: number) => number) }

export const PERKS: readonly PerkSpec[] = [
  { id: 'oczy', max: 30, cost: l => 2 + 2 * l },
  { id: 'spizarnia', max: 30, cost: l => 2 + 2 * l },
  { id: 'kufer', max: 4, cost: [5, 10, 20, 40] },
  { id: 'parapet', max: 5, cost: l => 3 + 3 * l },
  { id: 'lowy', max: 5, cost: l => 3 + 3 * l },
  { id: 'skrot', max: 5, cost: l => 4 + 4 * l },
  { id: 'warta', max: 4, cost: l => 3 + 2 * l },
  { id: 'gaweda', max: 4, cost: l => 3 + 2 * l },
];
export const PERK_IDS = PERKS.map(p => p.id);

/** The golden fish the next level of a perk costs (null: at its top). */
export function perkCost(id: PerkId, level: number): number | null {
  const p = PERKS.find(x => x.id === id);
  if (!p || level >= p.max) return null;
  return typeof p.cost === 'function' ? p.cost(level) : p.cost[level] ?? null;
}

export const perkName = (id: PerkId): string => t(`perk.${id}` as Key);
export const perkText = (id: PerkId): string => t(`perk.${id}.text` as Key);

// ── numbers ──────────────────────────────────────────────────────
const SUFFIX = ['', 'K', 'M', 'B', 'T'];

/**
 * An idle game's big number: 950, 1,25K, 12,5K, 125K, 1,25M … T, then aa, ab … zz (three significant
 * digits, the page's decimal mark).
 */
export function big(v: number): string {
  if (!Number.isFinite(v)) return '∞';
  const s = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a < 1000) return s + fmtNum(Math.floor(a));
  let k = Math.floor(Math.log10(a) / 3);
  let m = a / 1000 ** k;
  if (m >= 999.5) { k++; m /= 1000; }
  let suf: string;
  if (k < SUFFIX.length) suf = SUFFIX[k];
  else {
    const i = k - SUFFIX.length;
    suf = String.fromCharCode(97 + Math.min(25, Math.floor(i / 26))) + String.fromCharCode(97 + (i % 26));
  }
  const digits = m < 10 ? 2 : m < 100 ? 1 : 0;
  return s + fmtNum(Math.floor(m * 10 ** digits) / 10 ** digits, digits) + suf;
}

/** "12 rybek" for small counts (the language bends the word), "1,25K rybek" for big ones. */
export function fishText(v: number): string {
  const n = Math.max(0, Math.floor(v));
  if (n < 1000) return t('fish', { n });
  return `${big(n)} ${bare('fish', lang === 'pl' ? 5 : 2)}`;
}

/** "3 złote rybki". */
export const goldText = (n: number): string => t('gold', { n: Math.max(0, Math.floor(n)) });

// ── the words of a block and Brother Anselm's moments ────────────
const keysOf = (prefix: string): string[] => Object.keys(CATALOGS.pl).filter(k => k.startsWith(prefix));
const linesOf = (prefix: string): string[] => keysOf(prefix).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map(k => t(k as Key));

export const TIPS = {
  warmup: linesOf('tip.warmup.'),
  push: linesOf('tip.push.'),
  blind: linesOf('tip.blind.'),
  rest: linesOf('tip.rest.'),
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
};

export const MOMENTS = [
  'open', 'warm', 'push', 'blind', 'rest', 'good', 'huntReady', 'hunt', 'merge', 'gift', 'cat', 'boss', 'trick', 'chased', 'backs',
  'near', 'place', 'vintageReady', 'vintage', 'pet', 'away', 'upgrade', 'full', 'end',
] as const;
export type Moment = (typeof MOMENTS)[number];

export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(
  MOMENTS.map(m => [m, linesOf(`say.${m}.`)]),
) as unknown as Record<Moment, readonly string[]>;

/** How many lines Brother Anselm has (the tests check that each moment has at least three). */
export const LINE_COUNT = MOMENTS.reduce((s, m) => s + LINES[m].length, 0);

/** A number with the page's decimal mark, at most one decimal ("2,4"). */
export const f1 = (v: number): string => fmtNum(v, Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1);
