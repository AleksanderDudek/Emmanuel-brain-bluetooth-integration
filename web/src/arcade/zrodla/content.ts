/**
 * Źródła's data: the road's fifteen stations (the Songs of Ascents, Psalms 120–134) and the passage
 * a station card shows where scripture.ts holds one, Kumka's lines by moment, and the strategies the
 * panel shows in each block ("W głowie": what to do in the head, never how the mechanic works).
 * The words live in the catalog (i18n.ts), in this page load's language.
 */
import type { PassageId } from '../kit/scripture';
import { t, type Key } from './i18n';
import { RULES } from './rules';

/** The road's stations, one per Song of Ascents. */
export const STATIONS: readonly string[] = Array.from({ length: RULES.stations }, (_, i) => t(`station.${i}` as Key));
export const psalmOf = (station: number): number => 120 + Math.min(RULES.stations - 1, Math.max(0, station));
export const stationName = (station: number): string => STATIONS[Math.min(RULES.stations - 1, Math.max(0, station))];

/** The passage a station's card shows, where the Songs of Ascents have one in scripture.ts. */
export const STATION_VERSE: Readonly<Partial<Record<number, PassageId>>> = {
  1: 'psa121.1-2', 6: 'psa126.5', 7: 'psa127.1', 11: 'psa131.2', 13: 'psa133.3',
};

/** The moments Kumka the tree frog talks at. */
export const MOMENTS = [
  'open', 'warm', 'count', 'push', 'blind', 'rest', 'good', 'still', 'loop', 'pool', 'near', 'spill', 'win', 'big', 'garden',
  'bloom', 'fast', 'bomb', 'station', 'end', 'idle',
] as const;
export type Moment = (typeof MOMENTS)[number];

const three = (m: Moment): readonly string[] => [1, 2, 3].map(i => t(`say.${m}.${i}` as Key));
export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(MOMENTS.map(m => [m, three(m)])) as Record<Moment, readonly string[]>;

/** "W głowie": the block's strategy (the panel and the banner show it). */
export const TIPS = {
  warmup: t('tip.warmup'),
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3')],
} as const;
