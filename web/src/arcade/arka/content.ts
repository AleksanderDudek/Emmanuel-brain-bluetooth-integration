/**
 * Arka's data: the twelve kinds of the new land (their valley, the order they come out on the deck,
 * their young), the saga's levels (how big a board is, how full, which special animals it holds),
 * the chapters of the story, the homestead's stages and the lines that suggest a strategy.  Everything
 * a designer may want to tune without touching the rules (sim.ts, board.ts); the words live in the
 * catalog (i18n.ts), in the language of this page load.
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

/** After this many pairs of a kind have settled, its young appear in the valley. */
export const YOUNG_AT = 3;

/** How many kinds walk the deck at the saga's level `n`: three at first, one more every second level. */
export function kindsAt(n: number): number {
  return Math.min(KINDS.length, 3 + Math.floor((Math.max(1, Math.floor(n)) - 1) / 2));
}

// ── the saga ─────────────────────────────────────────────────────
export interface LevelSpec {
  n: number;
  cols: number;
  rows: number;
  /** how many animals (pieces) the generator aims for: an even number, two of a kind */
  animals: number;
  /** the share of animals that lead a file of their young (a long, bending piece), and its longest length */
  files: number;
  maxLen: number;
  /** special animals: sleepers (the first tap wakes them), turning goats, locked pens opened by a key */
  sleepy: number;
  turners: number;
  locks: number;
  /** how many kinds may walk this board */
  kinds: number;
  /** the roller-coaster's mark: a big board (a peak), an easy one (a breather), or a plain one */
  mood: 'big' | 'easy' | 'plain';
}

/**
 * The saga's level `n` (from 1): boards grow from 3×4 to 9×11 (by level ~24), fill up, get files of young from
 * level 4, sleepers from 5, turning goats from 8 and locked pens from 11.  Every fifth level is a
 * big one and the one after it a breather (the roller-coaster of §10.3.5).
 */
export function levelSpec(n: number): LevelSpec {
  const L = Math.max(1, Math.floor(n));
  const mood: LevelSpec['mood'] = L >= 5 && L % 5 === 0 ? 'big' : L >= 6 && L % 5 === 1 ? 'easy' : 'plain';
  const bump = mood === 'big' ? 1 : mood === 'easy' ? -1 : 0;
  const cols = clampInt(4 + Math.floor(L / 4) + bump, 3, 9);
  const rows = clampInt(5 + Math.floor(L / 3) + bump, 4, 11);
  const files = L < 4 ? 0 : Math.min(0.5, 0.15 + (L - 4) * 0.035);
  const maxLen = L < 4 ? 1 : Math.min(5, 2 + Math.floor((L - 4) / 4));
  const avgLen = 1 + files * (maxLen - 1) * 0.6;
  const fill = Math.min(0.78, 0.45 + L * 0.013) * (mood === 'easy' ? 0.85 : 1);
  let animals = Math.round((cols * rows * fill) / avgLen);
  if (L === 1) animals = 4;
  else if (L === 2) animals = 6;
  animals = Math.max(4, animals - (animals % 2));
  return {
    n: L, cols: L === 1 ? 3 : cols, rows: L === 1 ? 4 : rows, animals, files, maxLen,
    sleepy: L >= 5 && mood !== 'easy' ? 1 + (L >= 14 ? 1 : 0) : 0,
    turners: L >= 8 && mood !== 'easy' ? 1 + (L >= 16 ? 1 : 0) : 0,
    locks: L >= 11 && mood !== 'easy' ? 1 + (L >= 20 ? 1 : 0) : 0,
    kinds: kindsAt(L), mood,
  };
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** The level that introduces a special animal (a coach mark explains it the first time it walks a board). */
export const FIRST_OF = { file: 4, sleepy: 5, turner: 8, locked: 11 } as const;

// ── the story ────────────────────────────────────────────────────
/** Five levels make a chapter; the chapters follow Genesis 8 and then the new land. */
export const CHAPTER_LEN = 5;
export const CHAPTERS = 6;
export const chapterOf = (n: number): number => Math.floor((Math.max(1, n) - 1) / CHAPTER_LEN);
/** The chapter's title and its one or two sentences (chapters past the sixth are the new land's, numbered). */
export function chapter(i: number): { title: string; text: string } {
  if (i < CHAPTERS) return { title: t(`ch.${i + 1}` as 'ch.1'), text: t(`ch.${i + 1}.text` as 'ch.1.text') };
  return { title: t('ch.more', { n: i + 1 }), text: t('ch.more.text') };
}

// ── the homestead (built from stars) ─────────────────────────────
export type StageId = 'shelter' | 'fence' | 'well' | 'table' | 'garden' | 'house';

export interface Stage { id: StageId; name: string; short: string; at: number }

/** The family's homestead in the valley, raised by the stars of the saga (cumulative). */
export const STAGES: readonly Stage[] = ([
  ['shelter', 6], ['fence', 15], ['well', 27], ['table', 42], ['garden', 60], ['house', 81],
] as const).map(([id, at]) => ({ id, at, name: t(`home.${id}`), short: t(`home.${id}.short`) }));

// ── the lines under the block's name ─────────────────────────────
/** Strategies to try, never "concentrate harder"; the first Mgła and Tęcza ever explain themselves. */
export const TIPS = {
  warmup: t('tip.warm'),
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3'), t('tip.rest.4')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;
