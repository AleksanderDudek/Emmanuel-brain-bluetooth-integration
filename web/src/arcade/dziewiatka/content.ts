/**
 * Dziewiątka's data: the nine heroes named for the fruit of the Spirit (Galatians 5:22-23) in three
 * families, each with a role, a line in the formation, base numbers and colours; the Din's shadows
 * (noise that dissolves into quiet when hushed, never killed) and its six bosses with their wind-ups;
 * the six districts of Zacisze (the campaign's chapters) and their missions of three waves; the Bell
 * Tower's endless floors; the boons the well offers; the six pieces of gear a colour rank needs; the
 * strategies under a block's name and Klara's lines.  The words live in the catalog (i18n.ts), in
 * this page's language.  No randomness here except through the `rnd` a caller passes.
 */
import { t, type Key } from './i18n';

// ── the heroes ───────────────────────────────────────────────────
export type HeroId = 'milosc' | 'radosc' | 'pokoj' | 'cierpliwosc' | 'uprzejmosc' | 'dobroc' | 'wiernosc' | 'lagodnosc' | 'opanowanie';
export type Family = 'serce' | 'dlonie' | 'korzenie';
export type Role = 'tank' | 'guard' | 'striker' | 'support' | 'control' | 'bard' | 'marksman' | 'healer';
export type Line = 'front' | 'mid' | 'back';

export interface HeroSpec {
  id: HeroId;
  family: Family;
  role: Role;
  line: Line;
  /** level 1, white rank, 1★ */
  hp: number;
  atk: number;
  /** seconds between basic attacks */
  cd: number;
  /** reach of a basic attack (u) */
  range: number;
  /** share of damage taken away */
  armor: number;
  /** the hero's colour (portrait, energy flash, the chord's note) and a darker one */
  color: string;
  dark: string;
  /** the note this hero sings in the chord (Hz) */
  note: number;
  /** the campaign mission (index) after which the hero joins (−1: from the start): Kindness comes just before the
   * first boss, so the first wind-up can be broken */
  joins: number;
}

/** The order of Galatians 5:22-23, which is also the panel's order. */
export const HERO_IDS: readonly HeroId[] = ['milosc', 'radosc', 'pokoj', 'cierpliwosc', 'uprzejmosc', 'dobroc', 'wiernosc', 'lagodnosc', 'opanowanie'];

export const HEROES: Readonly<Record<HeroId, HeroSpec>> = {
  milosc: { id: 'milosc', family: 'serce', role: 'support', line: 'mid', hp: 270, atk: 15, cd: 1.25, range: 3.4, armor: 0.08, color: '#e8566a', dark: '#8f2338', note: 392.0, joins: -1 },
  radosc: { id: 'radosc', family: 'serce', role: 'bard', line: 'mid', hp: 235, atk: 13, cd: 1.05, range: 4.3, armor: 0.05, color: '#ffc23d', dark: '#a86a12', note: 659.25, joins: -1 },
  pokoj: { id: 'pokoj', family: 'serce', role: 'healer', line: 'back', hp: 235, atk: 11, cd: 1.35, range: 6.2, armor: 0.05, color: '#8fd3f4', dark: '#2f6f93', note: 523.25, joins: -1 },
  cierpliwosc: { id: 'cierpliwosc', family: 'dlonie', role: 'tank', line: 'front', hp: 430, atk: 14, cd: 1.4, range: 1.15, armor: 0.25, color: '#8fb35a', dark: '#4a5e2a', note: 196.0, joins: -1 },
  uprzejmosc: { id: 'uprzejmosc', family: 'dlonie', role: 'control', line: 'mid', hp: 255, atk: 12, cd: 1.3, range: 3.0, armor: 0.08, color: '#f6a77c', dark: '#9a5130', note: 440.0, joins: 3 },
  dobroc: { id: 'dobroc', family: 'dlonie', role: 'marksman', line: 'back', hp: 215, atk: 24, cd: 1.15, range: 7.6, armor: 0.04, color: '#ffe48a', dark: '#a8892a', note: 783.99, joins: -1 },
  wiernosc: { id: 'wiernosc', family: 'korzenie', role: 'guard', line: 'front', hp: 340, atk: 16, cd: 1.2, range: 1.6, armor: 0.15, color: '#5a78c8', dark: '#253a72', note: 293.66, joins: 9 },
  lagodnosc: { id: 'lagodnosc', family: 'korzenie', role: 'control', line: 'back', hp: 225, atk: 14, cd: 1.3, range: 6.0, armor: 0.05, color: '#b9a3e8', dark: '#5f4a92', note: 587.33, joins: 4 },
  opanowanie: { id: 'opanowanie', family: 'korzenie', role: 'striker', line: 'front', hp: 255, atk: 22, cd: 0.95, range: 1.25, armor: 0.08, color: '#3fb7a8', dark: '#145a52', note: 349.23, joins: 14 },
};

/** The five a new player starts with: a tank, a support, a bard, a healer and an archer. */
export const START_TEAM: readonly HeroId[] = ['cierpliwosc', 'milosc', 'radosc', 'pokoj', 'dobroc'];

export const FAMILIES: readonly Family[] = ['serce', 'dlonie', 'korzenie'];
export const FAMILY_COLOR: Readonly<Record<Family, string>> = { serce: '#e8566a', dlonie: '#8fb35a', korzenie: '#5a78c8' };
/** a family's bonus with two of it in the five, and with three */
export const FAMILY_BONUS: Readonly<Record<Family, readonly [number, number]>> = {
  /** energy given to the whole five when one of them fires an ultimate */
  serce: [80, 160],
  /** damage up (share) */
  dlonie: [0.1, 0.2],
  /** damage taken down (share) */
  korzenie: [0.1, 0.2],
};

export const heroName = (id: HeroId): string => t(`hero.${id}` as Key);
export const ultName = (id: HeroId): string => t(`ult.${id}` as Key);
export const heroCry = (id: HeroId): string => t(`cry.${id}` as Key);
export const heroText = (id: HeroId): string => t(`text.${id}` as Key);
export const roleName = (r: Role): string => t(`role.${r}` as Key);
export const familyName = (f: Family): string => t(`fam.${f}` as Key);
export function familyBonusText(f: Family): string {
  const [a, b] = FAMILY_BONUS[f];
  return f === 'serce' ? t('fam.serce.bonus', { a, b }) : t(`fam.${f}.bonus` as Key, { a: Math.round(a * 100), b: Math.round(b * 100) });
}

// ── the Din's shadows ────────────────────────────────────────────
export type ShadowKind = 'rozproszek' | 'klotniak' | 'klotniaczek' | 'gniewosz' | 'pyszalek' | 'leniwiec' | 'zazdrosnik' | 'pospiech' | 'plotka';
export type BossKind = 'krzykacz' | 'turkot' | 'gwar' | 'klakson' | 'pycha' | 'zgielk';
export type DinKind = ShadowKind | BossKind;
/** what a boss (or a small shadow) does at the end of its wind-up */
export type Special = 'outburst' | 'whisper' | 'shout' | 'roll' | 'hubbub' | 'honk' | 'lookAtMe';
/** whom a shadow goes for: the front-most hero, the back-most, the one with the most energy */
export type Aim = 'front' | 'back' | 'energy';

export interface DinSpec {
  kind: DinKind;
  hp: number;
  atk: number;
  cd: number;
  range: number;
  speed: number;
  armor: number;
  /** hushed it counts this many toward the headline */
  worth: number;
  aim: Aim;
  /** body size (u, the drawn height) */
  size: number;
  fly?: boolean;
  /** a special on a timer: every `every` s a wind-up of `wind` s (Gniewosz winds up at full swell instead) */
  special?: Special;
  every?: number;
  wind?: number;
  /** a mirror shield of this share of max health (Pyszałek, the Great Show-off) */
  mirror?: number;
  /** bosses: small shadows summoned every `summonEvery` s */
  summon?: ShadowKind;
  summonN?: number;
  summonEvery?: number;
  boss?: boolean;
}

export const DIN: Readonly<Record<DinKind, DinSpec>> = {
  rozproszek: { kind: 'rozproszek', hp: 50, atk: 18, cd: 1.0, range: 0.8, speed: 2.4, armor: 0, worth: 1, aim: 'energy', size: 0.62, fly: true },
  klotniak: { kind: 'klotniak', hp: 150, atk: 35, cd: 1.3, range: 1.0, speed: 1.3, armor: 0.05, worth: 1, aim: 'front', size: 1.05 },
  klotniaczek: { kind: 'klotniaczek', hp: 50, atk: 18, cd: 1.0, range: 0.9, speed: 1.9, armor: 0, worth: 1, aim: 'front', size: 0.62 },
  gniewosz: { kind: 'gniewosz', hp: 205, atk: 39, cd: 1.5, range: 1.0, speed: 1.05, armor: 0.08, worth: 2, aim: 'front', size: 1.1, special: 'outburst', wind: 1.8 },
  pyszalek: { kind: 'pyszalek', hp: 190, atk: 35, cd: 1.4, range: 1.2, speed: 1.0, armor: 0.1, worth: 2, aim: 'front', size: 1.25, mirror: 1.2 },
  leniwiec: { kind: 'leniwiec', hp: 400, atk: 26, cd: 2.2, range: 1.0, speed: 0.6, armor: 0.3, worth: 3, aim: 'front', size: 1.2 },
  zazdrosnik: { kind: 'zazdrosnik', hp: 155, atk: 35, cd: 1.3, range: 3.6, speed: 1.15, armor: 0.05, worth: 2, aim: 'front', size: 1.1 },
  pospiech: { kind: 'pospiech', hp: 90, atk: 30, cd: 0.8, range: 0.9, speed: 3.6, armor: 0, worth: 1, aim: 'back', size: 0.9 },
  plotka: { kind: 'plotka', hp: 120, atk: 26, cd: 1.8, range: 5.6, speed: 0.95, armor: 0.05, worth: 2, aim: 'front', size: 1.3, special: 'whisper', every: 7, wind: 1.3 },
  krzykacz: { kind: 'krzykacz', hp: 1725, atk: 56, cd: 1.6, range: 1.5, speed: 0.8, armor: 0.1, worth: 12, aim: 'front', size: 2.3, boss: true, special: 'shout', every: 8, wind: 2.2, summon: 'rozproszek', summonN: 2, summonEvery: 12 },
  turkot: { kind: 'turkot', hp: 2185, atk: 58, cd: 1.7, range: 1.6, speed: 0.75, armor: 0.2, worth: 14, aim: 'front', size: 2.3, boss: true, special: 'roll', every: 7.5, wind: 2.0 },
  gwar: { kind: 'gwar', hp: 2185, atk: 52, cd: 1.6, range: 1.6, speed: 0.75, armor: 0.12, worth: 15, aim: 'front', size: 2.4, boss: true, special: 'hubbub', every: 9, wind: 2.2, summon: 'klotniak', summonN: 2, summonEvery: 14 },
  klakson: { kind: 'klakson', hp: 2530, atk: 64, cd: 1.5, range: 1.6, speed: 0.8, armor: 0.15, worth: 16, aim: 'front', size: 2.3, boss: true, special: 'honk', every: 8, wind: 2.0, summon: 'pospiech', summonN: 2, summonEvery: 12 },
  pycha: { kind: 'pycha', hp: 2760, atk: 64, cd: 1.6, range: 1.7, speed: 0.75, armor: 0.12, worth: 18, aim: 'front', size: 2.5, boss: true, special: 'lookAtMe', every: 8.5, wind: 2.2, mirror: 0.3 },
  zgielk: { kind: 'zgielk', hp: 4140, atk: 69, cd: 1.5, range: 1.8, speed: 0.7, armor: 0.15, worth: 30, aim: 'front', size: 2.8, boss: true, special: 'shout', every: 7, wind: 2.0, summon: 'rozproszek', summonN: 2, summonEvery: 11 },
};

export const BOSS_KINDS: readonly BossKind[] = ['krzykacz', 'turkot', 'gwar', 'klakson', 'pycha', 'zgielk'];
export const isBoss = (k: DinKind): k is BossKind => (BOSS_KINDS as readonly string[]).includes(k);
export const dinName = (k: DinKind): string => (isBoss(k) ? t(`boss.${k}` as Key) : t(`din.${k}` as Key));
/** what a shadow shouts as it winds up */
export const windCry = (k: DinKind): string => t(`wind.${k === 'klotniaczek' ? 'gniewosz' : k}` as Key);
/** the Din's final boss changes its special by thirds of its health */
export const ZGIELK_PHASES: readonly Special[] = ['shout', 'roll', 'hubbub'];

// ── the town: chapters and missions ──────────────────────────────
export type ChapterId = 'rynek' | 'mlyn' | 'szkola' | 'most' | 'ogrody' | 'plac';
export interface ChapterSpec {
  id: ChapterId;
  /** the shadows of its missions (new ones are introduced here) and its boss */
  pool: readonly ShadowKind[];
  boss: BossKind;
  /** the street's palette: sky top, sky bottom, the houses, the ground */
  sky: [string, string];
  wall: string;
  ground: string;
}

export const CHAPTERS: readonly ChapterSpec[] = [
  { id: 'rynek', pool: ['rozproszek', 'klotniak'], boss: 'krzykacz', sky: ['#f7c98b', '#fde9c4'], wall: '#d9a46f', ground: '#b98a5a' },
  { id: 'mlyn', pool: ['rozproszek', 'klotniak', 'gniewosz'], boss: 'turkot', sky: ['#a7d4e8', '#e8f3e4'], wall: '#b7a07a', ground: '#8f9a5c' },
  { id: 'szkola', pool: ['klotniak', 'gniewosz', 'pyszalek', 'rozproszek'], boss: 'gwar', sky: ['#c6c0ef', '#f1e6f2'], wall: '#c98d6d', ground: '#a88066' },
  { id: 'most', pool: ['pospiech', 'leniwiec', 'gniewosz', 'rozproszek'], boss: 'klakson', sky: ['#9fc6e6', '#dcefee'], wall: '#9fa7b5', ground: '#8c8f99' },
  { id: 'ogrody', pool: ['zazdrosnik', 'plotka', 'pyszalek', 'klotniak'], boss: 'pycha', sky: ['#b5e0b0', '#f4f5d2'], wall: '#c7b28a', ground: '#7fa05a' },
  { id: 'plac', pool: ['rozproszek', 'klotniak', 'gniewosz', 'pyszalek', 'leniwiec', 'zazdrosnik', 'pospiech', 'plotka'], boss: 'zgielk', sky: ['#f2a07b', '#f8d9b0'], wall: '#c99b6f', ground: '#a7845e' },
];
export const MISSIONS_PER_CHAPTER = 5;
export const CAMPAIGN = CHAPTERS.length * MISSIONS_PER_CHAPTER;
export const chapterName = (id: ChapterId | 'tower'): string => t(`ch.${id}` as Key);
/** the shadow kinds a chapter introduces (the first time they come, a coach mark) */
export const chapterOf = (mission: number): ChapterSpec => CHAPTERS[Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor(mission / MISSIONS_PER_CHAPTER)))];

export interface WaveSpec { kinds: DinKind[] }
export interface MissionSpec {
  /** the campaign's index (0…29), or −1 on the Bell Tower */
  index: number;
  /** the tower's floor (1…), 0 in the campaign */
  floor: number;
  chapter: ChapterSpec;
  waves: WaveSpec[];
  boss: BossKind | null;
  /** the Din's power (× every number of its shadows) */
  power: number;
  /** the hero whose notes this mission gives */
  notesOf: HeroId;
}

/**
 * A campaign mission: three waves from its chapter's pool, a few more shadows mission by mission, and
 * the chapter's boss with two of its kind in the last wave of the fifth.  The same mission is always
 * the same (seeded by its index).
 */
export function campaignMission(index: number, powerStep: number): MissionSpec {
  const i = Math.max(0, Math.min(CAMPAIGN - 1, Math.floor(index)));
  const ch = chapterOf(i), m = i % MISSIONS_PER_CHAPTER;
  const rnd = seeded(1009 + i * 7919);
  const pool = ch.pool;
  // the first mission of the game is gentle: Scatterflies first, so the first hush comes quickly
  const first = i === 0;
  const waves: WaveSpec[] = [];
  for (let w = 0; w < 3; w++) {
    const n = (first ? [3, 4, 4] : [3, 4, 5])[w] + Math.floor(m / 2) + (i >= 10 ? 1 : 0);
    const kinds: DinKind[] = [];
    for (let k = 0; k < n; k++) {
      // new kinds of the chapter come more often in its own missions
      const pick = first && w === 0 ? 'rozproszek' : pool[Math.floor(rnd() * pool.length)];
      kinds.push(pick);
    }
    waves.push({ kinds });
  }
  let boss: BossKind | null = null;
  if (m === MISSIONS_PER_CHAPTER - 1) {
    boss = ch.boss;
    waves[2] = { kinds: [ch.boss, pool[0], pool[Math.min(1, pool.length - 1)]] };
  }
  return { index: i, floor: 0, chapter: ch, waves, boss, power: powerStep ** i, notesOf: HERO_IDS[(i * 4 + 3) % HERO_IDS.length] };
}

/** A floor of the Bell Tower (after the campaign): every shadow kind, a boss every fifth floor, stronger floor by floor. */
export function towerFloor(floor: number, basePower: number, step: number): MissionSpec {
  const f = Math.max(1, Math.floor(floor));
  const rnd = seeded(7717 + f * 104729);
  const pool = CHAPTERS[CHAPTERS.length - 1].pool;
  const waves: WaveSpec[] = [];
  for (let w = 0; w < 3; w++) {
    const n = 4 + w + Math.min(3, Math.floor(f / 6));
    const kinds: DinKind[] = [];
    for (let k = 0; k < n; k++) kinds.push(pool[Math.floor(rnd() * pool.length)]);
    waves.push({ kinds });
  }
  let boss: BossKind | null = null;
  if (f % 5 === 0) {
    boss = BOSS_KINDS[(f / 5 - 1) % BOSS_KINDS.length];
    waves[2] = { kinds: [boss, pool[Math.floor(rnd() * pool.length)], pool[Math.floor(rnd() * pool.length)]] };
  }
  const ch = CHAPTERS[(f - 1) % CHAPTERS.length];
  return { index: -1, floor: f, chapter: ch, waves, boss, power: basePower * step ** (f - 1), notesOf: HERO_IDS[(f * 5) % HERO_IDS.length] };
}

/** A small seeded generator (mulberry32) for the missions, so a mission is always the same. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ── boons (the well's gift at a rest's end) ──────────────────────
export type BoonId = 'piesn' | 'zupa' | 'szal' | 'werbel' | 'pierniki' | 'klucz' | 'apteczka' | 'kieszenie';
/** each boon's number, plain and golden (after a calm rest) */
export const BOONS: Readonly<Record<BoonId, readonly [number, number]>> = {
  piesn: [400, 800],
  zupa: [20, 35],
  szal: [12, 22],
  werbel: [12, 22],
  pierniki: [12, 22],
  klucz: [30, 55],
  apteczka: [50, 80],
  kieszenie: [2, 4],
};
export const BOON_IDS = Object.keys(BOONS) as BoonId[];
export const boonName = (id: BoonId): string => t(`boon.${id}` as Key);
export const boonText = (id: BoonId, gold: boolean): string => t(`boon.${id}.text` as Key, { n: BOONS[id][gold ? 1 : 0] });

// ── gear and ranks ───────────────────────────────────────────────
export const PIECES = 6;
export const pieceName = (k: number): string => t(`piece.${Math.max(0, Math.min(PIECES - 1, k))}` as Key);
export const rankName = (r: number): string => t(`rank.${Math.max(0, Math.min(9, r))}` as Key);
/** the colour of a rank (the portrait's ring) */
export const RANK_COLOR: readonly string[] = ['#f4f1ea', '#7fd17f', '#5fc06a', '#6fa8ff', '#4f8ef0', '#b48cff', '#9a6cf0', '#ffad5a', '#ff9440', '#ff6a5a'];

// ── strategies and Klara's lines ─────────────────────────────────
const range = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, i) => t(`${prefix}.${i + 1}` as Key));

export const TIPS = {
  warmup: range('tip.warmup', 1),
  push: range('tip.push', 6),
  blind: range('tip.blind', 2),
  rest: range('tip.rest', 4),
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
};

export type Moment = 'open' | 'warm' | 'push' | 'blind' | 'rest' | 'good' | 'ult' | 'tea' | 'song' | 'harmonyReady' | 'harmony'
  | 'near' | 'fall' | 'wipe' | 'wave' | 'surge' | 'mission' | 'stars3' | 'boss' | 'interrupt' | 'bossDown' | 'boon' | 'rank' | 'join' | 'end';

export const LINE_COUNT: Readonly<Record<Moment, number>> = {
  open: 4, warm: 3, push: 4, blind: 3, rest: 4, good: 4, ult: 4, tea: 3, song: 3, harmonyReady: 3, harmony: 3,
  near: 3, fall: 3, wipe: 3, wave: 3, surge: 3, mission: 3, stars3: 3, boss: 3, interrupt: 3, bossDown: 3, boon: 3, rank: 3, join: 3, end: 3,
};
export const MOMENTS = Object.keys(LINE_COUNT) as Moment[];
export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(
  MOMENTS.map(m => [m, range(`say.${m}`, LINE_COUNT[m])]),
) as unknown as Record<Moment, readonly string[]>;
