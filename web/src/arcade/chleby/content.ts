/**
 * Chleby i ryby's data with words (the catalog in i18n.ts holds them in this page's language): the
 * lines under a block's name — what to do in the head (a concrete strategy, never "concentrate
 * harder") — the six hillsides of the path and their story cards, the upgrades' names, and what
 * Mirka the gull and the boy say at each moment of a session (several variants per moment, so a
 * session never repeats a line).
 */
import { t, type Key } from './i18n';
import type { Upgrade } from './rules';

/** Strategies to try in each kind of block. */
export const TIPS = {
  warmup: [t('tip.warmup.1'), t('tip.warmup.2'), t('tip.warmup.3')],
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
  stream: t('up.stream'), start: t('up.start'), fish: t('up.fish'), big: t('up.big'),
};
export const UP_TEXT: Readonly<Record<Upgrade, string>> = {
  stream: t('up.stream.text'), start: t('up.start.text'), fish: t('up.fish.text'), big: t('up.big.text'),
};

/** The moments the companion speaks at, and who speaks. */
export type Moment =
  | 'open' | 'push' | 'blind' | 'good' | 'rest' | 'steal' | 'laugh' | 'knock' | 'near' | 'big' | 'boss' | 'sated' | 'level' | 'end'
  | 'boyOpen' | 'boyKnock' | 'boyLevel' | 'boyEnd';
export type Who = 'mirka' | 'boy';

const COUNT: Readonly<Record<Moment, number>> = {
  open: 4, push: 5, blind: 3, good: 4, rest: 4, steal: 4, laugh: 3, knock: 4, near: 3, big: 3, boss: 3, sated: 3, level: 4, end: 3,
  boyOpen: 3, boyKnock: 3, boyLevel: 3, boyEnd: 3,
};

export const WHO: Readonly<Record<Moment, Who>> = {
  open: 'mirka', push: 'mirka', blind: 'mirka', good: 'mirka', rest: 'mirka', steal: 'mirka', laugh: 'mirka', knock: 'mirka',
  near: 'mirka', big: 'mirka', boss: 'mirka', sated: 'mirka', level: 'mirka', end: 'mirka',
  boyOpen: 'boy', boyKnock: 'boy', boyLevel: 'boy', boyEnd: 'boy',
};

/** The boy's answer to a Mirka line, when he has one. */
export const REPLY: Partial<Record<Moment, Moment>> = { open: 'boyOpen', knock: 'boyKnock', level: 'boyLevel', end: 'boyEnd' };

/** Every variant of a moment, in this page's language. */
export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(
  (Object.keys(COUNT) as Moment[]).map(m => [m, Array.from({ length: COUNT[m] }, (_, i) => t(`say.${m}.${i + 1}` as Key))]),
) as Record<Moment, string[]>;
