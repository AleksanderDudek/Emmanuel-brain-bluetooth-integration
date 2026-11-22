/**
 * Drzewo nad wodą's content (DESIGN.md §18): the nine fruits of the Spirit (Gal 5:22-23), each with its colour, its
 * shape and its bell; the layers of the soil the roots go down through to the hidden stream; the two postures; the
 * seasons; the passages each moment rests on; the narrator's moments and the strategies for the head.  Words live
 * in i18n.ts (keys only here); passages only by id (src/content/scripture.ts).
 */
import type { PassageId } from '../kit/scripture';

// ── the fruits of the Spirit ─────────────────────────────────────

/** The nine, in Galatians' order: love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, self-control. */
export const FRUITS = ['love', 'joy', 'peace', 'patience', 'kindness', 'goodness', 'faithfulness', 'gentleness', 'control'] as const;
export type FruitId = (typeof FRUITS)[number];

/** How a fruit is drawn: each its own shape (a jewel of light in that shape). */
export type FruitShape = 'pomegranate' | 'grapes' | 'olive' | 'fig' | 'peach' | 'pear' | 'date' | 'cherry' | 'almond';

export interface Fruit {
  /** its jewel colour and a lighter tint of it (the glow, the blossom) */
  color: string;
  light: string;
  shape: FruitShape;
  /** its bell on the pentatonic ladder (kit/audio `ladder`): the nine rise as they ripen in order */
  bell: number;
}

/**
 * Each fruit its own hue round the wheel and its own biblical shape: love the pomegranate (crimson), joy a cluster of
 * grapes (gold), peace the olive (sky), patience the fig (violet), kindness the peach (coral), goodness the pear
 * (lime), faithfulness the date of the palm (amber; Ps 92:12), gentleness a pair of cherries (rose), self-control the
 * almond (teal; Aaron's rod, Num 17:8).
 */
export const FRUIT: Readonly<Record<FruitId, Fruit>> = {
  love: { color: '#e8364f', light: '#ff9aa8', shape: 'pomegranate', bell: 5 },
  joy: { color: '#ffc63a', light: '#ffe7a0', shape: 'grapes', bell: 6 },
  peace: { color: '#7fcfff', light: '#d2efff', shape: 'olive', bell: 7 },
  patience: { color: '#9b6bff', light: '#d6c4ff', shape: 'fig', bell: 8 },
  kindness: { color: '#ff8a66', light: '#ffc9b5', shape: 'peach', bell: 9 },
  goodness: { color: '#b9e35a', light: '#e4f7b8', shape: 'pear', bell: 10 },
  faithfulness: { color: '#f0a23a', light: '#ffd9a0', shape: 'date', bell: 11 },
  gentleness: { color: '#ff7fc8', light: '#ffc6e7', shape: 'cherry', bell: 12 },
  control: { color: '#3fd6c0', light: '#b4f2e8', shape: 'almond', bell: 13 },
};

/** The fruit at a place in the order (wrapping round the nine). */
export const fruitAt = (i: number): FruitId => FRUITS[((Math.floor(i) % 9) + 9) % 9];

// ── the soil ─────────────────────────────────────────────────────

/** The layers from the ground line down to the stream (a longer session goes through more of them). */
export const LAYERS = ['humus', 'clay', 'stones', 'sand', 'gravel', 'rock'] as const;
export type LayerId = (typeof LAYERS)[number];

export interface Layer {
  /** the earth's colours: its top and its bottom */
  top: string;
  bottom: string;
  /** how many stones lie in it (per unit of the figure's height across), and their colour */
  stones: number;
  stone: string;
}

export const LAYER: Readonly<Record<LayerId, Layer>> = {
  humus: { top: '#3b2a1c', bottom: '#33241a', stones: 1, stone: '#5d5246' },
  clay: { top: '#6e4a2a', bottom: '#5c3d24', stones: 1.5, stone: '#7a6a58' },
  stones: { top: '#4f3d2b', bottom: '#463626', stones: 7, stone: '#8a8478' },
  sand: { top: '#8a6a40', bottom: '#755a36', stones: 1.5, stone: '#9c9282' },
  gravel: { top: '#5a4a3a', bottom: '#4a3d31', stones: 5, stone: '#7d776c' },
  rock: { top: '#3f3833', bottom: '#35302c', stones: 2, stone: '#6a645e' },
};

/** The layers a session shows, from the top: the deepest always just above the stream. */
export function layersFor(n: number): LayerId[] {
  const k = Math.max(2, Math.min(LAYERS.length, Math.round(n)));
  switch (k) {
    case 2: return ['humus', 'stones'];
    case 3: return ['humus', 'clay', 'stones'];
    case 4: return ['humus', 'clay', 'stones', 'sand'];
    case 5: return ['humus', 'clay', 'stones', 'sand', 'gravel'];
    default: return [...LAYERS];
  }
}

// ── the posture, the seasons ─────────────────────────────────────

export const POSTURES = ['sit', 'stand'] as const;
export type Posture = (typeof POSTURES)[number];

export const SEASON_MODES = ['auto', 'spring', 'summer', 'autumn', 'winter'] as const;
export type SeasonMode = (typeof SEASON_MODES)[number];
export type Season = Exclude<SeasonMode, 'auto'>;
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** The calendar's season for a day "YYYY-MM-DD" (the northern year: March–May spring … December–February winter). */
export function seasonOfDay(day: string): Season {
  const m = Number(day.slice(5, 7));
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

// ── the stages ───────────────────────────────────────────────────

/** What a push grows: the roots, the tree (trunk, branches, crown), or a fruit. */
export type StationKind = 'roots' | 'trunk' | 'fruit';

/** The tree's parts by its growth (0..1 over the trunk stations): the trunk, then the branches, then the crown of leaves. */
export const TREE_PART = { trunk: 0.42, branches: 0.74 } as const;
export type TreePart = 'trunk' | 'branches' | 'crown';
export const treePart = (g: number): TreePart => (g < TREE_PART.trunk ? 'trunk' : g < TREE_PART.branches ? 'branches' : 'crown');

/**
 * What a rest is: between two root stations (`soil`), when the roots have reached the stream (`water`: water rises
 * through the roots into the figure), between two trunk stations (`tree`), when the crown is whole (`crown`), after a
 * fruit (`fruit`: its reflection), the safety valve's, and the last one (`wind`: wind and heat — the tree stands).
 */
export type RestKind = 'soil' | 'water' | 'tree' | 'crown' | 'fruit' | 'valve' | 'wind';

/** The passages each rest abides in (in turn, session by session); a fruit's rest reads its reflection instead. */
export const REST_VERSES: Readonly<Record<Exclude<RestKind, 'fruit'>, readonly PassageId[]>> = {
  soil: ['col2.7', 'eph3.17'],
  water: ['psa1.3'],
  tree: ['col2.6-7', 'psa92.12-13', 'isa61.3', 'psa104.16'],
  crown: ['gal5.22-23'],
  valve: ['isa40.31', 'mrk4.26-28'],
  wind: ['mat7.24-25', 'psa16.8', 'psa1.3'],
};

/** The closing card's passage, in turn session by session. */
export const CLOSE_VERSES: readonly PassageId[] = ['jer17.7', 'psa92.12-13'];

/** The passage a fruit's card shows (the fruit of the Spirit; after the ninth, John 15:5's "much fruit"). */
export const FRUIT_VERSE: PassageId = 'gal5.22-23';
export const HARVEST_VERSE: PassageId = 'jhn15.5';

// ── the voice ────────────────────────────────────────────────────

/** The narrator's moments (three lines each in every language, i18n `say.<moment>.<1..3>`). */
export const MOMENTS = [
  'open', 'posture', 'roots', 'stream', 'water', 'trunk', 'crown', 'fruit', 'harvest', 'wind', 'end', 'blind', 'blindEnd', 'nosignal', 'valve', 'good', 'wait',
] as const;
export type Moment = (typeof MOMENTS)[number];
export const LINE_COUNT = 3;

/** The strategies for the head in a push (`signal().task`): imagery and slow words, never "concentrate harder". */
export const TIPS = {
  posture: 'tip.posture',
  roots: ['tip.roots.1', 'tip.roots.2', 'tip.roots.3'],
  trunk: ['tip.trunk.1', 'tip.trunk.2', 'tip.trunk.3'],
  /** every third fruit push: the slow repetition of the fruit's prayer */
  repeat: 'tip.repeat',
  blind: ['tip.blind.1', 'tip.blind.2'],
  rest: ['tip.rest.1', 'tip.rest.2'],
  wind: 'tip.wind',
} as const;
