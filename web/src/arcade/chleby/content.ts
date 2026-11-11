/**
 * Chleby i ryby's data with words (the catalog in i18n.ts holds them in this page's language): what
 * to do in the head in each block (a concrete strategy, never "concentrate harder"), the six
 * hillsides of the path and their story cards, the cards of the collection, the village's
 * buildings, the bosses, the league's tiers, the missions, the day's weather, the coach marks, and
 * what Mirka the gull and the boy say at each moment of a session (several variants per moment, so
 * a session never repeats a line).
 */
import { fmtNum } from '../../i18n';
import type { CardId } from './cards';
import { t, type Key } from './i18n';
import type { BossKind, Building, DayKind, MissionKind, Teach } from './meta';
import { RULES } from './rules';

/** Strategies to try in each kind of block. */
export const TIPS = {
  warmup: t('tip.warmup'),
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5'), t('tip.push.6')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3'), t('tip.rest.4')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;

/** The six hillsides, in the path's order. */
export const CHAPTERS: readonly string[] = [1, 2, 3, 4, 5, 6].map(i => t(`chapter.${i}` as Key));
export const STORIES: readonly string[] = [1, 2, 3, 4, 5, 6].map(i => t(`story.${i}` as Key));

/** A card's name and what it does (with its numbers filled in by the caller where it has them). */
export const cardName = (id: CardId): string => t(`card.${id}` as Key);
export const cardText = (id: CardId): string => t(`card.${id}.text` as Key);

export const buildName = (b: Building): string => t(`b.${b}` as Key);
export const buildText = (b: Building): string => t(`b.${b}.text` as Key);

export const bossName = (b: BossKind): string => t(`boss.${b}` as Key);
export const bossStory = (b: BossKind): string => t(`boss.${b}.story` as Key);

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
/** The league's tier: Garść … Dwanaście koszy, then II, III … */
export function tierName(tier: number): string {
  const top = RULES.tiers.length - 1;
  if (tier < top) return t(`tier.${Math.max(0, tier)}` as Key);
  const k = tier - top + 1;
  return k <= 1 ? t(`tier.${top}` as Key) : `${t(`tier.${top}` as Key)} ${ROMAN[k] ?? fmtNum(k)}`;
}

export const dayName = (d: DayKind): string => t(`day.${d}` as Key);
export const dayText = (d: DayKind): string => t(`day.${d}.text` as Key);

/** A mission in words: "Nakarm 300 ludzi". */
export const missionText = (kind: MissionKind, goal: number): string => t(`mission.${kind}` as Key, { n: fmtNum(goal) });

/** The coach marks' words. */
export const HINTS: Readonly<Record<Teach, string>> = Object.fromEntries(
  ([
    'tap', 'hold', 'drag', 'gull', 'gold', 'big', 'rest', 'pelikan', 'sub', 'add', 'help', 'pack', 'jar', 'brook', 'sprint', 'rock',
    'koziol', 'czapla', 'kormorany', 'burst', 'osiol', 'woz', 'wielblad', 'four',
  ] as const).map(w => [w, t(`hint.${w}` as Key)]),
) as Record<Teach, string>;

/** The moments the companion speaks at, and who speaks. */
export type Moment =
  | 'open' | 'push' | 'blind' | 'good' | 'rest' | 'wave' | 'snatch' | 'mirka' | 'fat' | 'peck' | 'big' | 'bigGo'
  | 'boss' | 'sated' | 'table' | 'level' | 'help' | 'end'
  | 'bossKoziol' | 'bossCzapla' | 'bossKormorany' | 'satedKoziol' | 'satedCzapla' | 'satedKormorany' | 'butt' | 'stab' | 'dive'
  | 'goOsiol' | 'goWoz' | 'goOlbrzym' | 'goWielblad' | 'befriend' | 'burst'
  | 'helpReady' | 'helpMewy' | 'helpSiec' | 'helpWiatr' | 'helpBramka'
  | 'pack' | 'fresh' | 'evo' | 'tier' | 'mission' | 'build' | 'jar'
  | 'boyOpen' | 'boyPeck' | 'boyLevel' | 'boyEnd' | 'boyBefriend';
export type Who = 'mirka' | 'boy';

const COUNT: Readonly<Record<Moment, number>> = {
  open: 4, push: 5, blind: 3, good: 4, rest: 4, wave: 3, snatch: 4, mirka: 3, fat: 3, peck: 3, big: 3, bigGo: 3,
  boss: 3, sated: 3, table: 3, level: 4, help: 3, end: 3,
  bossKoziol: 3, bossCzapla: 3, bossKormorany: 3, satedKoziol: 3, satedCzapla: 3, satedKormorany: 3, butt: 3, stab: 3, dive: 3,
  goOsiol: 3, goWoz: 3, goOlbrzym: 3, goWielblad: 3, befriend: 3, burst: 3,
  helpReady: 3, helpMewy: 3, helpSiec: 3, helpWiatr: 3, helpBramka: 3,
  pack: 3, fresh: 3, evo: 3, tier: 3, mission: 3, build: 3, jar: 3,
  boyOpen: 3, boyPeck: 3, boyLevel: 3, boyEnd: 3, boyBefriend: 3,
};

export const WHO = (m: Moment): Who => (m.startsWith('boy') ? 'boy' : 'mirka');

/** The boy's answer to a Mirka line, when he has one. */
export const REPLY: Partial<Record<Moment, Moment>> = { open: 'boyOpen', peck: 'boyPeck', level: 'boyLevel', end: 'boyEnd', befriend: 'boyBefriend' };

/** Every variant of a moment, in this page's language. */
export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(
  (Object.keys(COUNT) as Moment[]).map(m => [m, Array.from({ length: COUNT[m] }, (_, i) => t(`say.${m}.${i + 1}` as Key))]),
) as Record<Moment, string[]>;
