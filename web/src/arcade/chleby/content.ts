/**
 * Chleby i ryby's data with words (the catalog in i18n.ts holds them in this page's language): what
 * to do in the head in each block (a concrete strategy, never "concentrate harder"), the six
 * hillsides of the path and their story cards, the upgrades' names, the coach marks, and what Mirka
 * the gull and the boy say at each moment of a session (several variants per moment, so a session
 * never repeats a line).
 */
import { t, type Key } from './i18n';
import type { Teach } from './meta';
import type { Upgrade } from './rules';

/** Strategies to try in each kind of block. */
export const TIPS = {
  warmup: t('tip.warmup'),
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3'), t('tip.rest.4')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;

/** The six hillsides, in the path's order. */
export const CHAPTERS: readonly string[] = [1, 2, 3, 4, 5, 6].map(i => t(`chapter.${i}` as Key));
export const STORIES: readonly string[] = [1, 2, 3, 4, 5, 6].map(i => t(`story.${i}` as Key));

export const UP_NAME: Readonly<Record<Upgrade, string>> = {
  rate: t('up.rate'), fish: t('up.fish'), big: t('up.big'), start: t('up.start'),
};
export const UP_TEXT: Readonly<Record<Upgrade, string>> = {
  rate: t('up.rate.text'), fish: t('up.fish.text'), big: t('up.big.text'), start: t('up.start.text'),
};

/** The coach marks' words. */
export const HINTS: Readonly<Record<Teach, string>> = {
  tap: t('hint.tap'), hold: t('hint.hold'), drag: t('hint.drag'), gull: t('hint.gull'), gold: t('hint.gold'),
  big: t('hint.big'), rest: t('hint.rest'), pelikan: t('hint.pelikan'), sub: t('hint.sub'), add: t('hint.add'),
};

/** The moments the companion speaks at, and who speaks. */
export type Moment =
  | 'open' | 'push' | 'blind' | 'good' | 'rest' | 'wave' | 'snatch' | 'mirka' | 'fat' | 'peck' | 'big' | 'bigGo'
  | 'boss' | 'sated' | 'table' | 'level' | 'help' | 'end'
  | 'boyOpen' | 'boyPeck' | 'boyLevel' | 'boyEnd';
export type Who = 'mirka' | 'boy';

const COUNT: Readonly<Record<Moment, number>> = {
  open: 4, push: 5, blind: 3, good: 4, rest: 4, wave: 3, snatch: 4, mirka: 3, fat: 3, peck: 3, big: 3, bigGo: 3,
  boss: 3, sated: 3, table: 3, level: 4, help: 3, end: 3,
  boyOpen: 3, boyPeck: 3, boyLevel: 3, boyEnd: 3,
};

export const WHO = (m: Moment): Who => (m.startsWith('boy') ? 'boy' : 'mirka');

/** The boy's answer to a Mirka line, when he has one. */
export const REPLY: Partial<Record<Moment, Moment>> = { open: 'boyOpen', peck: 'boyPeck', level: 'boyLevel', end: 'boyEnd' };

/** Every variant of a moment, in this page's language. */
export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(
  (Object.keys(COUNT) as Moment[]).map(m => [m, Array.from({ length: COUNT[m] }, (_, i) => t(`say.${m}.${i + 1}` as Key))]),
) as Record<Moment, string[]>;
