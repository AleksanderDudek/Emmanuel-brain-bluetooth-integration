/**
 * Firmament's data: the lines under a block's name (strategies to try, never "concentrate
 * harder"), the instruments' names and how to use them, the constellations' names.  The words live
 * in the catalog (i18n.ts), in this page's language.
 */
import type { ToolKind } from './board';
import { t } from './i18n';

export const TIPS = {
  warmup: [t('tip.warmup.1'), t('tip.warmup.2'), t('tip.warmup.3')],
  obs: [t('tip.obs.1'), t('tip.obs.2'), t('tip.obs.3'), t('tip.obs.4'), t('tip.obs.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  night: [t('tip.night.1'), t('tip.night.2'), t('tip.night.3')],
} as const;

export const TOOL_NAME: Readonly<Record<ToolKind, string>> = {
  comet: t('tool.comet'), ray: t('tool.ray'), swap: t('tool.swap'), nova: t('tool.nova'), pulsar: t('tool.pulsar'),
};

export const TOOL_USE: Readonly<Record<ToolKind, string>> = {
  comet: t('use.comet'), ray: t('use.ray'), swap: t('use.swap'), nova: t('use.nova'), pulsar: t('use.pulsar'),
};

const NAMES = [t('const.0'), t('const.1'), t('const.2'), t('const.3'), t('const.4'), t('const.5')];

/** A constellation's name; after the sixth they come round again with a number ("Orion 2"). */
export function constName(c: number): string {
  const k = Math.max(0, Math.floor(c));
  const round = Math.floor(k / NAMES.length);
  return round ? `${NAMES[k % NAMES.length]} ${round + 1}` : NAMES[k % NAMES.length];
}
