/**
 * Urodzaj's data: the fruit ladder of the good land (Deuteronomy 8:8's olive, vine, fig, pomegranate
 * and date, with the apple and the melon of the same land), the odds of a drop, the village table's
 * eight steps, the twelve guests and their looks, and the short lines the game shows during play.
 * Everything a designer may tune without touching the rules (sim.ts); the words themselves live in
 * the catalog (i18n.ts), in the language of this page load.
 */
import { t, type Key } from './i18n';

/** A fruit tier; `name` reads inside a sentence ("Pierwszy raz: figa"), cap() makes a label of it. */
export interface Fruit {
  tier: number;
  /** radius in W (the basket's inner width at the rim) */
  r: number;
  /** points for making it by a merge: k(k − 1) */
  pts: number;
  name: string;
  /** the mosaic's base, shadow and light tones */
  base: string;
  dark: string;
  light: string;
}

const LOOK: readonly [number, string, string, string][] = [
  [0.042, '#5E6B2E', '#3B4419', '#8C9A52'],   // olive: dark olive, pointed tip
  [0.052, '#5B3A6E', '#3A2148', '#8A68A0'],   // grape: a round purple bead
  [0.064, '#B07A35', '#7A4F1E', '#D9A866'],   // date: an amber capsule with ridges
  [0.079, '#A8A04A', '#6F6A28', '#CFC774'],   // fig: a green-gold teardrop
  [0.097, '#D9A63A', '#9C7020', '#F2CB6E'],   // apple: golden, a leaf and a stem
  [0.120, '#A3243B', '#6C1325', '#D2566A'],   // pomegranate: red with a crown
  [0.148, '#C9C27A', '#8E8A4A', '#E6E1A6'],   // melon: pale green, dark stripes
  [0.182, '#4B2E5A', '#2C1838', '#7A5690'],   // bunch of grapes
  [0.225, '#3E2350', '#22102F', '#6D4D86'],   // the great cluster, with gold leaf
];

export const MAX_TIER = 9;

export const FRUITS: readonly Fruit[] = LOOK.map(([r, base, dark, light], i) => ({
  tier: i + 1, r, pts: (i + 1) * i, name: t(`fruit.${i + 1}` as Key), base, dark, light,
}));

export const fruit = (tier: number): Fruit => FRUITS[Math.max(1, Math.min(MAX_TIER, tier)) - 1];

/** The great cluster's bonus on top of its merge, and the breather of small drops after it. */
export const GREAT_BONUS = 150;
export const BREATHER = 8;

/** A drop's tier from its uniform `u`: tiers 1–4 at 32/30/22/16 %, or 1–2 at 55/45 % in a breather. */
export const DROP_ODDS: readonly number[] = [0.32, 0.30, 0.22, 0.16];
export const BREATHER_ODDS: readonly number[] = [0.55, 0.45];

export function tierFromU(u: number, breather: boolean): number {
  const odds = breather ? BREATHER_ODDS : DROP_ODDS;
  let acc = 0;
  for (let i = 0; i < odds.length; i++) {
    acc += odds[i];
    if (u < acc) return i + 1;
  }
  return odds.length;
}

// ── the table ────────────────────────────────────────────────────
export type TableStepId = 'obrus' | 'chleb' | 'oliwa' | 'misa' | 'lampki' | 'lawy' | 'muzyka' | 'pergola';
export interface TableStep { id: TableStepId; name: string; short: string }

export const TABLE_STEPS: readonly TableStep[] = (['obrus', 'chleb', 'oliwa', 'misa', 'lampki', 'lawy', 'muzyka', 'pergola'] as const)
  .map(id => ({ id, name: t(`table.${id}`), short: t(`table.${id}.short`) }));

/** Table points: 350 to start (half of the cloth, "for the calibration"), 700 a step, 150 for each day's loaf. */
export const TABLE_START = 350;
export const TABLE_STEP = 700;
export const LOAF_POINTS = 150;

// ── the guests ───────────────────────────────────────────────────
/** How far a guest came: the album's rarity, never a guest's worth. */
export type Tier = 'common' | 'rare' | 'epic' | 'legend';
export const TIERS: readonly Tier[] = ['common', 'rare', 'epic', 'legend'];
export const TIER_NAME: Record<Tier, string> = { common: t('tier.common'), rare: t('tier.rare'), epic: t('tier.epic'), legend: t('tier.legend') };
export const STORY_NAME = t('tier.story');
/** The album tile's class in styles.css (.arcade-album > div.rare …). */
export const TIER_CLASS: Record<Tier, string> = { common: '', rare: 'rare', epic: 'epic', legend: 'legend' };
/** The honest feat that brings a draw of each tier (published in the lobby). */
export const TIER_FEAT: Record<Tier, string> = { common: t('feat.common'), rare: t('feat.rare'), epic: t('feat.epic'), legend: t('feat.legend') };

export type GuestId = 'rut' | 'noemi' | 'piekarka' | 'pasterz' | 'wdowa' | 'chlopiec' | 'zniwiarka' | 'booz' | 'niewidomy' | 'lirnik' | 'przybysz' | 'rodzina';

/** What a guest carries or wears: the one attribute that tells them apart (table.ts draws it). */
export type Attribute = 'sheaf' | 'veil' | 'loaf' | 'crook' | 'shawl' | 'jug' | 'sickle' | 'stalks' | 'staff' | 'lyre' | 'hat' | 'child';

export interface FigureLook {
  skin: string;
  tunic: string;
  /** a head-cloth (women, Naomi's grey veil), else hair */
  cloth: string | null;
  hair: string;
  attr: Attribute;
  /** a child's size */
  small: boolean;
}

export interface Guest {
  id: GuestId;
  /** null: a story guest (Ruth and Naomi come by the story, never by a draw) */
  tier: Tier | null;
  name: string;
  line: string;
  /** the paraphrase's reference for the people of the Book of Ruth ("Rt 2,17–18") */
  ref: string | null;
  look: FigureLook;
  /** the seat at the table (table.ts): 0–5 the back row, 6–9 the front row, 10 and 11 the ends */
  seat: number;
}

const guest = (id: GuestId, tier: Tier | null, seat: number, look: FigureLook, biblical = false): Guest => ({
  id, tier, seat, look, name: t(`guest.${id}` as Key), line: t(`guest.${id}.line` as Key), ref: biblical ? t(`guest.${id}.ref` as Key) : null,
});

/** Twelve people at one oval table: two of the Book of Ruth, five neighbours, three from nearby, one from afar, one from a far country. */
export const GUESTS: readonly Guest[] = [
  guest('rut', null, 2, { skin: '#C08A5E', tunic: '#8C6A3E', cloth: '#D9C9A3', hair: '#3A2418', attr: 'sheaf', small: false }, true),
  guest('noemi', null, 3, { skin: '#B07E58', tunic: '#5F5A6E', cloth: '#A8A4A0', hair: '#9A948C', attr: 'veil', small: false }, true),
  guest('piekarka', 'common', 1, { skin: '#C99468', tunic: '#B5523B', cloth: '#EFE4CC', hair: '#3A2418', attr: 'loaf', small: false }),
  guest('pasterz', 'common', 6, { skin: '#B98250', tunic: '#7F8A4A', cloth: null, hair: '#2E1E14', attr: 'crook', small: true }),
  guest('wdowa', 'common', 0, { skin: '#B88A66', tunic: '#4A4258', cloth: '#2A2622', hair: '#2A2622', attr: 'shawl', small: false }),
  guest('chlopiec', 'common', 7, { skin: '#A8744A', tunic: '#C8963E', cloth: null, hair: '#20140C', attr: 'jug', small: true }),
  guest('zniwiarka', 'common', 8, { skin: '#C48C5C', tunic: '#C8A060', cloth: '#B5523B', hair: '#3A2418', attr: 'sickle', small: false }),
  guest('booz', 'rare', 9, { skin: '#A97B55', tunic: '#2F4A7A', cloth: null, hair: '#6A5E50', attr: 'stalks', small: false }, true),
  guest('niewidomy', 'rare', 5, { skin: '#9E6E48', tunic: '#8E7FA8', cloth: null, hair: '#D9CCB0', attr: 'staff', small: false }),
  guest('lirnik', 'rare', 4, { skin: '#B3825A', tunic: '#5E6B2E', cloth: null, hair: '#2A1A10', attr: 'lyre', small: false }),
  guest('przybysz', 'epic', 10, { skin: '#8C5E3C', tunic: '#C9C27A', cloth: null, hair: '#20140C', attr: 'hat', small: false }),
  guest('rodzina', 'legend', 11, { skin: '#B07A50', tunic: '#A3243B', cloth: '#CFE3F2', hair: '#2E1E14', attr: 'child', small: false }),
];

export const guestById = (id: string): Guest | undefined => GUESTS.find(g => g.id === id);

/** A duplicate guest leaves grain; enough grain brings the next missing guest. */
export const DUPLICATE_GRAIN = 5;
export const CRAFT_GRAIN = 25;

/** The line under the block's name: strategies to try, never "concentrate harder". */
export const TIPS = {
  warmup: [t('tip.warmup.1'), t('tip.warmup.2'), t('tip.warmup.3')],
  zbior: [t('tip.zbior.1'), t('tip.zbior.2'), t('tip.zbior.3'), t('tip.zbior.4'), t('tip.zbior.5')],
  zbiorBlind: [t('tip.zbiorBlind.1'), t('tip.zbiorBlind.2')],
  rosa: [t('tip.rosa.1'), t('tip.rosa.2'), t('tip.rosa.3'), t('tip.rosa.4')],
  rosaBlind: [t('tip.rosaBlind.1'), t('tip.rosaBlind.2')],
  /** the first Zbiór and Rosa of the first two sessions explain themselves */
  firstZbior: t('tip.firstZbior'),
  firstRosa: t('tip.firstRosa'),
} as const;
