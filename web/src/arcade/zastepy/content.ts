/**
 * Zastępy's data with words: the host's and the demons' names (the catalog in i18n.ts holds them in
 * this page's language), and the lines under a block's name — what to do in the head (a concrete
 * strategy, never "concentrate harder") and what the band drives in this block.
 */
import { t } from './i18n';
import { DEMON_IDS, HOST_IDS, type DemonId, type HostId } from './rules';

export const HOST_NAME: Readonly<Record<HostId, string>> = Object.fromEntries(HOST_IDS.map(id => [id, t(`unit.${id}`)])) as Record<HostId, string>;
export const DEMON_NAME: Readonly<Record<DemonId, string>> = Object.fromEntries(DEMON_IDS.map(id => [id, t(`demon.${id}`)])) as Record<DemonId, string>;

/** Strategies to try in each kind of block. */
export const TIPS = {
  warmup: [t('tip.warmup.1'), t('tip.warmup.2'), t('tip.warmup.3')],
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;
