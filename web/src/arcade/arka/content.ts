/**
 * Arka's data: the twelve kinds of the new land (their valley, the order they come out of the ark,
 * their young), the recipes of the holds (the session's sawtooth), the homestead's stages and the
 * lines that suggest a strategy.  Everything a designer may want to tune without touching the rules
 * (sim.ts, holds.ts); the words live in the catalog (i18n.ts), in the language of this page load.
 */
import { t } from './i18n';

export type KindId = 'sheep' | 'goat' | 'donkey' | 'cow' | 'horse' | 'camel' | 'ibex' | 'hyrax' | 'deer' | 'stork' | 'partridge' | 'lion';
export type ValleyId = 'laka' | 'wzgorza';

/** The kinds in the order they come out of the ark: the meadow first (Ps 104:14), then the hills (Ps 104:17-21). */
export const KINDS: readonly KindId[] = ['sheep', 'goat', 'donkey', 'cow', 'horse', 'camel', 'ibex', 'hyrax', 'deer', 'stork', 'partridge', 'lion'];

export interface Kind {
  id: KindId;
  valley: ValleyId;
  /** plural, as inside a sentence ("Nowi na pokładzie: krowy"); cap() makes a label of it */
  name: string;
  habitat: string;
  young: string;
}

export const KIND: Readonly<Record<KindId, Kind>> = Object.fromEntries(KINDS.map((id, i) => [id, {
  id, valley: i < 6 ? 'laka' : 'wzgorza', name: t(`kind.${id}`), habitat: t(`hab.${id}`), young: t(`young.${id}`),
}])) as Record<KindId, Kind>;

export const VALLEYS: readonly { id: ValleyId; name: string }[] = [
  { id: 'laka', name: t('valley.laka') },
  { id: 'wzgorza', name: t('valley.wzgorza') },
];

/** The first session brings three kinds. */
export const FIRST_KINDS = 3;
/** After this many pairs of a kind have settled, its young appear in the valley. */
export const YOUNG_AT = 3;

/**
 * How many kinds have come out of the ark by the player's `session`-th session: three in the first,
 * one more in each of the next three, then one every second session until all twelve are out.
 */
export function kindsAt(session: number): number {
  const s = Math.max(1, Math.floor(session));
  return Math.min(KINDS.length, s <= 4 ? s + FIRST_KINDS - 1 : 6 + Math.floor((s - 4) / 2));
}

/** The next kind to come out after `session`, and in how many sessions (null: all are out). */
export function nextKind(session: number): { kind: KindId; in: number } | null {
  const have = kindsAt(session);
  if (have >= KINDS.length) return null;
  let s = session + 1;
  while (kindsAt(s) <= have) s++;
  return { kind: KINDS[have], in: s - session };
}

// ── the holds ────────────────────────────────────────────────────
export type RecipeId = 'warm' | 'c1' | 'c2' | 'c3' | 'c4' | 'spike' | 'easy' | 'great' | 'daily';

export interface Recipe {
  id: RecipeId;
  cols: number;
  rows: number;
  pairs: number;
  /** the share of animals whose way out is blocked at the start */
  blocked: number;
  /** the most kinds "open" at once in the removal order (one animal out, its mate still on deck): 2 easy, 3 otherwise */
  open: number;
  /** the most different kinds in the hold (fewer when fewer have come out) */
  kinds: number;
}

export const RECIPES: Readonly<Record<RecipeId, Recipe>> = {
  warm: { id: 'warm', cols: 4, rows: 4, pairs: 3, blocked: 0, open: 2, kinds: 3 },
  c1: { id: 'c1', cols: 5, rows: 5, pairs: 4, blocked: 0.3, open: 2, kinds: 3 },
  c2: { id: 'c2', cols: 5, rows: 6, pairs: 5, blocked: 0.4, open: 2, kinds: 4 },
  c3: { id: 'c3', cols: 6, rows: 6, pairs: 6, blocked: 0.45, open: 3, kinds: 5 },
  c4: { id: 'c4', cols: 6, rows: 7, pairs: 7, blocked: 0.5, open: 3, kinds: 5 },
  spike: { id: 'spike', cols: 6, rows: 7, pairs: 8, blocked: 0.55, open: 3, kinds: 6 },
  easy: { id: 'easy', cols: 5, rows: 5, pairs: 4, blocked: 0.2, open: 2, kinds: 3 },
  great: { id: 'great', cols: 7, rows: 8, pairs: 10, blocked: 0.5, open: 3, kinds: 7 },
  daily: { id: 'daily', cols: 6, rows: 6, pairs: 6, blocked: 0.45, open: 3, kinds: 6 },
};

/** The sawtooth after the warm-up (and the day's hold): learning holds, a spike, an easy one, again. */
export const SAWTOOTH: readonly RecipeId[] = ['c1', 'c2', 'c3', 'spike', 'easy', 'c3', 'c4', 'spike', 'easy', 'c4'];

/** The warm-up's sheep sits on this cell, the one under the smoke test's tap (50 %, 60 %) in every layout. */
export const ANCHOR = { x: 2, y: 2 } as const;

// ── the homestead ────────────────────────────────────────────────
export type StageId = 'shelter' | 'fence' | 'well' | 'table' | 'garden' | 'house';

export interface Stage { id: StageId; name: string; short: string; at: number }

/** The family's homestead in the valley, built from planks, carved posts and the neighbours' gifts (points, cumulative). */
export const STAGES: readonly Stage[] = ([
  ['shelter', 6], ['fence', 14], ['well', 24], ['table', 36], ['garden', 50], ['house', 66],
] as const).map(([id, at]) => ({ id, at, name: t(`home.${id}`), short: t(`home.${id}.short`) }));

// ── the lines under the block's name ─────────────────────────────
/** Strategies to try, never "concentrate harder"; the first Day and Evening ever explain themselves. */
export const TIPS = {
  day: [t('tip.day.1'), t('tip.day.2'), t('tip.day.3'), t('tip.day.4')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  evening: [t('tip.evening.1'), t('tip.evening.2'), t('tip.evening.3')],
  firstDay: t('tip.firstDay'),
  firstEvening: t('tip.firstEvening'),
} as const;
