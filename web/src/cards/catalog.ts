/**
 * The 32 exercise cards (src/cards/DESIGN.md §2): the user's "Wersja 4K" redraws of a spiral-bound
 * book's spreads, checked one by one against photos of the book.  Each card has its picture (a
 * preview that is cached offline, and the 4K original fetched on demand), the target times the
 * book prints under its animals (tortoise, dog, cheetah), what it trains, the two-screen games
 * built on it, and — for the ones whose redraw had to be corrected — what changed.
 */
import { gamesOfCard } from './games';
import type { CardKey } from './i18n-cards';

export type CardTag = 'trace' | 'both' | 'rules' | 'memory' | 'attention' | 'inhibition' | 'count';

export interface CardInfo {
  /** 1–32 */
  n: number;
  /** "07" */
  id: string;
  /** seconds for slow, medium, fast; two rows when each page has its own */
  times: [number, number, number][];
  tags: CardTag[];
  /** the redraw was corrected against the photo (the text is `fix.cNN`) */
  fixed: boolean;
  /** why there is no game, for the print-only cards */
  why?: 'trace' | 'unclear' | 'fingers' | 'faces';
}

const T = (...rows: [number, number, number][]) => rows;

/** Read from the photos' badges (two of them, 16 right and 24 right, are slightly blurred). */
const RAW: Omit<CardInfo, 'id' | 'fixed'>[] = [
  { n: 1, times: T([10, 9, 8]), tags: ['trace', 'both'], why: 'trace' },
  { n: 2, times: T([15, 13, 10]), tags: ['both', 'rules'] },
  { n: 3, times: T([15, 12, 10]), tags: ['rules', 'both'] },
  { n: 4, times: T([10, 9, 8]), tags: ['memory'] },
  { n: 5, times: T([15, 12, 9]), tags: ['both', 'attention'] },
  { n: 6, times: T([10, 8, 5]), tags: ['trace', 'both'], why: 'trace' },
  { n: 7, times: T([30, 20, 10]), tags: ['rules', 'attention'] },
  { n: 8, times: T([10, 8, 6], [30, 15, 5]), tags: ['attention', 'rules'] },
  { n: 9, times: T([10, 7, 5]), tags: ['memory', 'attention'] },
  { n: 10, times: T([20, 15, 10]), tags: ['both'] },
  { n: 11, times: T([15, 13, 11]), tags: ['trace', 'both'], why: 'trace' },
  { n: 12, times: T([10, 8, 6]), tags: ['memory', 'trace'] },
  { n: 13, times: T([30, 20, 15]), tags: ['rules', 'count'] },
  { n: 14, times: T([30, 25, 20]), tags: ['both', 'rules'] },
  { n: 15, times: T([25, 20, 15]), tags: ['trace', 'both'], why: 'trace' },
  { n: 16, times: T([30, 20, 15], [20, 15, 12]), tags: ['both', 'attention'] },
  { n: 17, times: T([10, 9, 7]), tags: ['attention'] },
  { n: 18, times: T([20, 18, 15]), tags: ['rules'] },
  { n: 19, times: T([25, 20, 15], [35, 30, 25]), tags: ['count', 'attention'] },
  { n: 20, times: T([25, 20, 15]), tags: ['inhibition', 'count'] },
  { n: 21, times: T([20, 15, 10]), tags: ['rules', 'both'] },
  { n: 22, times: T([15, 12, 10]), tags: ['both', 'inhibition'], why: 'unclear' },
  { n: 23, times: T([30, 15, 10]), tags: ['both', 'attention'] },
  { n: 24, times: T([20, 15, 10], [10, 8, 6]), tags: ['rules', 'memory'] },
  { n: 25, times: T([20, 13, 8]), tags: ['rules', 'both'] },
  { n: 26, times: T([15, 13, 10], [30, 25, 20]), tags: ['count'], why: 'fingers' },
  { n: 27, times: T([45, 40, 25]), tags: ['rules'] },
  { n: 28, times: T([30, 20, 15]), tags: ['rules', 'inhibition'], why: 'faces' },
  { n: 29, times: T([20, 16, 12]), tags: ['memory', 'rules'] },
  { n: 30, times: T([40, 30, 25]), tags: ['rules', 'both'] },
  { n: 31, times: T([50, 40, 35]), tags: ['rules'] },
  { n: 32, times: T([10, 9, 8]), tags: ['both', 'inhibition'] },
];

/** The cards whose redraw was corrected (src/cards/i18n-cards.ts `fix.cNN`). */
export const FIXED = new Set([2, 3, 8, 11, 12, 13, 14, 17, 18, 21, 22, 27, 29, 30, 31]);

export const CARDS: readonly CardInfo[] = RAW.map(c => ({ ...c, id: String(c.n).padStart(2, '0'), fixed: FIXED.has(c.n) }));

export const card = (n: number): CardInfo | undefined => CARDS[n - 1];

/** The card's picture: the light preview (cached for offline use) or the full 4K image. */
export const cardImage = (c: CardInfo, size: 'thumb' | 'full'): string =>
  `${import.meta.env.BASE_URL}cards/${size}/${c.id}.${size === 'thumb' ? 'webp' : 'png'}`;

/** The file name a downloaded card gets. */
export const cardFileName = (c: CardInfo): string => `emmanuel-karta-${c.id}.png`;

export const titleKey = (c: CardInfo) => `c${c.id}.title` as CardKey;
export const howKey = (c: CardInfo) => `c${c.id}.how` as CardKey;
export const fixKey = (c: CardInfo) => `fix.c${c.id}` as CardKey;

/** The two-screen games of a card (empty for the print-only ones). */
export const playable = (c: CardInfo) => gamesOfCard(c.n);
