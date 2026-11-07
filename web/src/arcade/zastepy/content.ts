/**
 * Zastępy's data with words (the catalog in i18n.ts holds them in this page's language): the host's
 * and the demons' names, the ages of the fortress and their story cards, the strategies for each
 * kind of block (what to do in the head, never "concentrate harder"), the coach marks, and what
 * Tymek — a cadet of the host who keeps its chronicle, polishes the trumpet and does not like the
 * hounds — says at each moment of a session (several variants per moment, so a session never
 * repeats a line).
 */
import { t, type Key } from './i18n';
import type { Teach } from './meta';
import { DEMON_IDS, HOST_IDS, RULES, type DemonId, type HostId } from './rules';

export const HOST_NAME: Readonly<Record<HostId, string>> = Object.fromEntries(HOST_IDS.map(id => [id, t(`unit.${id}` as Key)])) as Record<HostId, string>;
export const DEMON_NAME: Readonly<Record<DemonId, string>> = Object.fromEntries(DEMON_IDS.map(id => [id, t(`demon.${id}` as Key)])) as Record<DemonId, string>;

/** The ages of the fortress (stone, cedar, bronze, gold, pearl), their story cards and the passage each card carries. */
export const AGES: readonly string[] = Array.from({ length: RULES.ageMax + 1 }, (_, i) => t(`age.${i}` as Key));
export const AGE_STORY: readonly string[] = Array.from({ length: RULES.ageMax + 1 }, (_, i) => t(`story.age.${i}` as Key));

/** Strategies to try in each kind of block. */
export const TIPS = {
  warmup: t('tip.warmup'),
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;

/** The coach marks' words (the counter's names its demon and its card). */
export const HINTS: Readonly<Record<Exclude<Teach, 'counter' | 'boss'>, string>> = {
  card: t('hint.card'), pillar: t('hint.pillar'), trumpet: t('hint.trumpet'), upgrade: t('hint.upgrade'), rest: t('hint.rest'),
};

/** The moments Tymek speaks at. */
export type Moment =
  | 'open' | 'push' | 'blind' | 'good' | 'rest' | 'calm' | 'counter' | 'near' | 'big' | 'trumpet' | 'pillar'
  | 'boss' | 'warn' | 'blocked' | 'won' | 'lost' | 'age' | 'end';

const COUNT: Readonly<Record<Moment, number>> = {
  open: 4, push: 4, blind: 3, good: 4, rest: 3, calm: 3, counter: 4, near: 3, big: 3, trumpet: 3, pillar: 3,
  boss: 3, warn: 3, blocked: 3, won: 4, lost: 3, age: 3, end: 3,
};

/** Every variant of a moment, in this page's language. */
export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(
  (Object.keys(COUNT) as Moment[]).map(m => [m, Array.from({ length: COUNT[m] }, (_, i) => t(`say.${m}.${i + 1}` as Key))]),
) as Record<Moment, string[]>;
