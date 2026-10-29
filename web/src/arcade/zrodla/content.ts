/**
 * Źródła's data: the road's five stages (Songs of Ascents, Ps 120–124) with their eight valley
 * recipes each, the day's shared valley and the evening oasis, the album "Studnie i źródła", the
 * day's trees, the depth ladder and the short lines the game shows during play.  Everything a
 * designer may tune without touching the rules (sim.ts, valley.ts); the words themselves live in
 * the catalog (i18n.ts), in the language of this page load.
 */
import { t } from './i18n';

/** A valley to generate (valley.ts): its size and what it holds. */
export interface Recipe {
  cols: number;
  rows: number;
  /** edge springs and wells inside (both are sources) */
  springs: number;
  wells: number;
  fields: number;
  /** one field gets a second inlet from another source's channels (a meeting pool) */
  meeting: boolean;
  rocks: number;
  /** pre-set stones beyond the springs' mouth stones */
  preset: number;
  /** four-way rosettes allowed */
  fourMax: number;
  /** branching bias 0..1 */
  tee: number;
  /** the oasis: this share of the turnable stones is pre-set instead of `preset` */
  presetShare?: number;
}

type R = [cols: number, rows: number, springs: number, wells: number, fields: number, meeting: 0 | 1, rocks: number, preset: number, four?: number, tee?: number];

const recipe = (stageTee: number) => ([cols, rows, springs, wells, fields, meeting, rocks, preset, four = 0, tee = stageTee]: R): Recipe =>
  ({ cols, rows, springs, wells, fields, meeting: meeting === 1, rocks, preset, fourMax: four, tee });

/** A stage of the road: a landscape name, the Song of Ascents it walks, and eight valleys rising and falling in difficulty. */
export interface Stage { readonly name: string; readonly psalm: number; readonly recipes: readonly (Recipe | 'lesson')[] }

const s1 = recipe(0.3), s2 = recipe(0.35), s345 = recipe(0.45);

export const STAGES: readonly Stage[] = [
  {
    name: t('stage.1'), psalm: 120, recipes: [
      'lesson',
      s1([4, 4, 1, 0, 2, 0, 1, 2]), s1([4, 4, 1, 0, 2, 0, 2, 1]), s1([5, 4, 1, 0, 3, 0, 1, 2]), s1([5, 4, 1, 0, 3, 0, 1, 1, 0, 0.35]),
      s1([5, 5, 1, 0, 3, 0, 2, 2, 0, 0.35]), s1([4, 4, 1, 0, 2, 0, 1, 3]), s1([5, 5, 2, 0, 3, 1, 2, 2]),
    ],
  },
  {
    name: t('stage.2'), psalm: 121, recipes: [
      s2([5, 4, 2, 0, 3, 1, 1, 2]), s2([5, 5, 1, 0, 4, 0, 2, 2, 0, 0.4]), s2([5, 5, 2, 0, 3, 1, 2, 1]), s2([5, 5, 2, 0, 4, 0, 1, 1, 0, 0.4]),
      s2([6, 5, 2, 0, 4, 1, 2, 2, 0, 0.4]), s2([6, 5, 2, 0, 4, 0, 2, 1, 0, 0.45]), s2([5, 4, 1, 0, 3, 0, 1, 3]), s2([6, 5, 3, 0, 4, 1, 2, 2]),
    ],
  },
  {
    name: t('stage.3'), psalm: 122, recipes: [
      s345([5, 5, 2, 0, 3, 0, 1, 2, 1]), s345([5, 5, 2, 0, 4, 1, 2, 1, 1]), s345([6, 5, 2, 0, 4, 0, 2, 1, 1]), s345([6, 5, 2, 0, 4, 1, 1, 1, 2]),
      s345([6, 5, 3, 0, 5, 1, 2, 1, 2]), s345([6, 5, 2, 0, 5, 0, 3, 0, 2, 0.55]), s345([5, 4, 2, 0, 3, 1, 1, 3, 1]), s345([6, 5, 3, 0, 5, 1, 2, 1, 2]),
    ],
  },
  {
    name: t('stage.4'), psalm: 123, recipes: [
      s345([5, 5, 1, 1, 3, 0, 1, 2]), s345([5, 5, 1, 1, 4, 1, 2, 1, 1]), s345([6, 5, 2, 1, 4, 1, 2, 1, 1]), s345([5, 5, 0, 2, 4, 1, 2, 1, 1]),
      s345([6, 5, 1, 2, 5, 1, 2, 1, 2]), s345([6, 5, 2, 1, 5, 0, 3, 0, 2, 0.55]), s345([5, 4, 1, 1, 3, 1, 1, 3]), s345([6, 5, 2, 1, 5, 1, 2, 1, 2]),
    ],
  },
  {
    name: t('stage.5'), psalm: 124, recipes: [
      s345([6, 5, 2, 1, 4, 1, 2, 2, 1]), s345([6, 5, 3, 0, 5, 1, 2, 1, 2]), s345([6, 5, 2, 1, 5, 1, 3, 1, 2]), s345([6, 5, 1, 2, 5, 1, 2, 0, 2]),
      s345([6, 5, 3, 0, 5, 1, 3, 0, 3, 0.55]), s345([6, 5, 2, 2, 5, 1, 3, 0, 3, 0.6]), s345([5, 5, 2, 0, 3, 1, 1, 3, 1]), s345([6, 5, 3, 1, 5, 1, 2, 1, 2]),
    ],
  },
];

export const VALLEYS_PER_STAGE = 8;
/** The road's valleys; from here on, "doliny przy drodze": stage 5's recipes in turn, the seeds going on. */
export const ROAD_LENGTH = STAGES.length * VALLEYS_PER_STAGE;

/** "Dolina dnia": the same 5×5 for everyone each day (seeded by the date, no skill offset). */
export const DAILY: Recipe = { cols: 5, rows: 5, springs: 2, wells: 0, fields: 4, meeting: true, rocks: 2, preset: 1, fourMax: 1, tee: 0.4 };

/** "Oaza", the session's finisher: an easy valley of many sources at the camp's evening rest. */
export function oasisRecipe(roadIndex: number): Recipe {
  const wells = roadIndex >= 3 * VALLEYS_PER_STAGE ? 1 : 0;   // from stage 4 on, a well among the springs
  return { cols: 5, rows: 4, springs: 3 - wells, wells, fields: 3, meeting: true, rocks: 1, preset: 0, fourMax: 0, tee: 0.3, presetShare: 0.7 };
}

/** The sizes a skill offset steps through. */
export const SIZES: readonly (readonly [number, number])[] = [[4, 4], [5, 4], [5, 5], [6, 5]];

/** Jars that make each depth: ankle, knee, waist, river (levels 1–4). */
export const DEPTHS = [3, 8, 15, 25] as const;
/** How far a field's green may spread (cells) at its depth level 0..4; level 0 = wet but below the ankle. */
export const GREEN_CAP = [0.5, 1, 1.5, 2, 3] as const;
/** A spill's green tuft at most (cells). */
export const TUFT_CAP = 0.4;

/** The depth level 0..4 of a field holding `jars`. */
export function depthOf(jars: number): number {
  let level = 0;
  for (const d of DEPTHS) if (jars >= d - 1e-9) level++;
  return level;
}

export const DEPTH_NAME: readonly string[] = ['', t('depth.1'), t('depth.2'), t('depth.3'), t('depth.4')];

/** The album "Studnie i źródła": six places of water in Scripture. */
export interface AlbumCard { readonly id: number; readonly name: string; readonly caption: string; readonly ref: string }
export const ALBUM: readonly AlbumCard[] = ([0, 1, 2, 3, 4, 5] as const).map(id => ({
  id, name: t(`card.${id}.name`), caption: t(`card.${id}.caption`), ref: t(`card.${id}.ref`),
}));

/** The day's trees by the road (the kind comes from the date, the same for everyone). */
export type TreeKind = 'olive' | 'almond' | 'fig' | 'pomegranate' | 'palm' | 'tamarisk';
export const TREES: readonly { readonly kind: TreeKind; readonly name: string }[] = ([
  'olive', 'almond', 'fig', 'pomegranate', 'palm', 'tamarisk',
] as const).map((kind, i) => ({ kind, name: t(`tree.${i as 0 | 1 | 2 | 3 | 4 | 5}`) }));

/** The birds of Psalm 84:3, nesting in turn: sparrows first. */
export const BIRDS = ['sparrow', 'swallow'] as const;
export type Bird = (typeof BIRDS)[number];

/** The line under the block's name: strategies to try, never "concentrate harder". */
export const TIPS = {
  warmup: t('tip.warmup'),
  firstNurt: t('tip.firstNurt'),
  firstSela: t('tip.firstSela'),
  nurt: [t('tip.nurt.1'), t('tip.nurt.2'), t('tip.nurt.3'), t('tip.nurt.4'), t('tip.nurt.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  sela: [t('tip.sela.1'), t('tip.sela.2'), t('tip.sela.3')],
  oaza: t('tip.oaza'),
} as const;
