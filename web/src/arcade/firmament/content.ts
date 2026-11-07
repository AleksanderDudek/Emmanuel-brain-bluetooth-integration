/**
 * Firmament's data: the strategies a block suggests (never "concentrate harder"), the telescope's
 * tools, and the constellations of the saga map — their names, their stories (Bible star stories,
 * told with passages that already exist in src/content/scripture.ts) and their figures on the map.
 * The words live in the catalog (i18n.ts), in this page's language.
 */
import type { PassageId } from '../kit/scripture';
import { t, type Key } from './i18n';

/** The telescope's tools: the hammer (one cell), the ray (a row), a shuffle, +5 moves, and a pulsar after a long hold. */
export type ToolKind = 'hammer' | 'ray' | 'shuffle' | 'moves' | 'pulsar';
/** Tools that need a cell (tap the tool, then the sky); the others act at once. */
export const AIMED: readonly ToolKind[] = ['hammer', 'ray', 'pulsar'];

export const TIPS = {
  warmup: ['tip.warmup.1'],
  obs: ['tip.obs.1', 'tip.obs.2', 'tip.obs.3', 'tip.obs.4', 'tip.obs.5'],
  blind: ['tip.blind.1', 'tip.blind.2'],
  night: ['tip.night.1', 'tip.night.2', 'tip.night.3'],
} as const satisfies Record<string, readonly Key[]>;

export const toolName = (k: ToolKind): string => t(`tool.${k}` as Key);

/** The six told constellations; the saga goes on with numbered ones after them. */
export interface Constellation {
  /** the passage its story card shows */
  verse: PassageId;
  /** eight stars (0..1 in a box) and the lines between them */
  stars: [number, number][];
  lines: [number, number][];
}

export const CONSTELLATIONS: readonly Constellation[] = [
  { verse: 'gen1.16', stars: [[0.08, 0.72], [0.22, 0.58], [0.36, 0.64], [0.48, 0.48], [0.6, 0.3], [0.78, 0.22], [0.92, 0.38], [0.76, 0.48]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 4]] },
  { verse: 'gen15.5', stars: [[0.5, 0.12], [0.36, 0.3], [0.64, 0.3], [0.24, 0.5], [0.5, 0.48], [0.76, 0.5], [0.36, 0.78], [0.66, 0.8]], lines: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 4], [2, 5], [4, 6], [4, 7]] },
  { verse: 'job38.7', stars: [[0.1, 0.5], [0.24, 0.32], [0.38, 0.5], [0.52, 0.3], [0.66, 0.5], [0.8, 0.3], [0.92, 0.5], [0.52, 0.76]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [2, 7], [4, 7]] },
  { verse: 'mat2.10', stars: [[0.5, 0.1], [0.5, 0.3], [0.32, 0.42], [0.68, 0.42], [0.5, 0.52], [0.36, 0.72], [0.64, 0.72], [0.5, 0.9]], lines: [[0, 1], [1, 2], [1, 3], [1, 4], [4, 5], [4, 6], [5, 7], [6, 7]] },
  { verse: 'dan12.3', stars: [[0.14, 0.24], [0.3, 0.36], [0.46, 0.26], [0.6, 0.42], [0.46, 0.6], [0.3, 0.7], [0.62, 0.8], [0.86, 0.66]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6], [6, 7], [3, 7]] },
  { verse: 'isa40.26', stars: [[0.12, 0.3], [0.28, 0.6], [0.44, 0.34], [0.58, 0.66], [0.72, 0.36], [0.88, 0.62], [0.44, 0.84], [0.72, 0.84]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [3, 6], [3, 7]] },
];

/** A constellation's figure: the told ones, then they come round again. */
export const figure = (c: number): Constellation => CONSTELLATIONS[((Math.floor(c) % CONSTELLATIONS.length) + CONSTELLATIONS.length) % CONSTELLATIONS.length];

/** A constellation's name; after the sixth they come round with a number ("Gwiazdy Abrahama 2"). */
export function constName(c: number): string {
  const k = Math.max(0, Math.floor(c));
  const round = Math.floor(k / CONSTELLATIONS.length);
  const name = t(`const.${k % CONSTELLATIONS.length}` as Key);
  return round ? `${name} ${round + 1}` : name;
}

/** A constellation's story card text (the told ones; later ones get a short line). */
export const storyText = (c: number): string => (c < CONSTELLATIONS.length ? t(`story.${c}` as Key) : t('story.more'));
