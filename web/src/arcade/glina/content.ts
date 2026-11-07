/**
 * Glina's data: the twelve forms the customers order (their heights, outlines, prices, what the
 * hands add, the order they unlock in), the glazes and patterns, the shop, the customers (three
 * regular households with four-step stories, the walk-ins, the market), the strategies for the
 * blocks, the cat's lines, and the passages a session may close with.  Everything a designer may
 * tune without touching the rules; the words live in the catalog (i18n.ts).
 */
import type { PassageId } from '../kit/scripture';
import { t, type Key } from './i18n';
import { profileFrom, targetOf, type Target } from './shape';

export type FormId = 'kubek' | 'misa' | 'dzbanek' | 'miska' | 'garnek' | 'dzbanuszek'
  | 'miednica' | 'sloj' | 'lampka' | 'dzban' | 'donica' | 'zapis';
export type GlazeId = 'biel' | 'miod' | 'zelazo' | 'seledyn' | 'kobalt' | 'oliwka' | 'turkus' | 'purpura';
export type PatternId = 'pas' | 'fala' | 'kropki' | 'zygzak' | 'galazka';
export type HouseId = 'karczma' | 'piekarnia' | 'mlodzi';
export type WalkId = 'pasterz' | 'baruch' | 'wdowa' | 'kupiec' | 'rybak';
export type CustomerId = HouseId | WalkId | 'targ';
export type KilnGift = 'blush' | 'speckle' | 'moon';
/** What the hands add once the piece is cut (drawn by vessel.ts). */
export type Attachment = 'handle' | 'lip' | 'smallHandle' | 'flange' | 'rolled' | 'nozzle' | 'twoHandles' | 'lid';

export interface Form {
  id: FormId;
  /** nominal height (cm) and the target outline (radius ÷ height) at the 16 rings */
  N: number;
  q: Float64Array;
  /** the base price (sykli) */
  price: number;
  attach: readonly Attachment[];
  /** 1 = the easiest; forms unlock in this order */
  ease: number;
  /** as inside a sentence; cap() for a label */
  name: string;
}

type Row = [FormId, number, [number, number][], number, Attachment[]];

const ROWS: readonly Row[] = [
  ['kubek', 11, [[0, 0.36], [0.1, 0.37], [0.5, 0.4], [0.9, 0.43], [1, 0.45]], 1, []],
  ['miska', 8, [[0, 0.42], [0.15, 0.6], [0.45, 0.92], [0.8, 1.1], [1, 1.16]], 2, []],
  ['misa', 13, [[0, 0.4], [0.2, 0.53], [0.6, 0.8], [1, 1.0]], 3, []],
  ['donica', 20, [[0, 0.4], [0.3, 0.48], [0.7, 0.58], [0.92, 0.64], [1, 0.7]], 3, ['rolled']],
  ['miednica', 11, [[0, 0.95], [0.3, 1.15], [0.7, 1.35], [0.9, 1.45], [1, 1.6]], 4, ['flange']],
  ['sloj', 20, [[0, 0.4], [0.2, 0.46], [0.6, 0.48], [0.85, 0.45], [0.93, 0.4], [1, 0.43]], 4, ['rolled']],
  ['garnek', 16, [[0, 0.4], [0.3, 0.55], [0.55, 0.58], [0.8, 0.5], [0.9, 0.46], [1, 0.52]], 5, []],
  ['dzbanek', 20, [[0, 0.28], [0.25, 0.42], [0.45, 0.44], [0.7, 0.3], [0.85, 0.2], [1, 0.24]], 6, ['handle', 'lip']],
  ['zapis', 24, [[0, 0.28], [0.15, 0.32], [0.75, 0.33], [0.85, 0.28], [0.93, 0.2], [1, 0.21]], 6, ['lid']],
  ['lampka', 9, [[0, 0.3], [0.3, 0.55], [0.6, 0.6], [0.85, 0.4], [1, 0.18]], 7, ['nozzle']],
  ['dzbanuszek', 12, [[0, 0.22], [0.25, 0.4], [0.45, 0.42], [0.65, 0.26], [0.8, 0.12], [1, 0.15]], 8, ['smallHandle']],
  ['dzban', 30, [[0, 0.2], [0.2, 0.3], [0.45, 0.34], [0.7, 0.28], [0.85, 0.14], [0.95, 0.12], [1, 0.16]], 9, ['twoHandles']],
];

export const FORMS: readonly Form[] = ROWS.map(([id, N, points, ease, attach]) => ({
  id, N, q: profileFrom(points), price: 8 + ease * 3, attach, ease, name: t(`form.${id}` as Key),
}));
export const FORM: Readonly<Record<FormId, Form>> = Object.fromEntries(FORMS.map(f => [f.id, f])) as Record<FormId, Form>;
export const FORM_IDS: readonly FormId[] = FORMS.map(f => f.id);

/** The order's target for a form. */
export const formTarget = (f: FormId): Target => targetOf(FORM[f].N, FORM[f].q);

/** Forms open from the start, then one more for every `FORM_STEP` stars earned, all time. */
export const FORMS_START = 4;
export const FORM_STEP = 6;

// ── glazes and patterns ─────────────────────────────────────────
export const GLAZES: readonly GlazeId[] = ['biel', 'miod', 'zelazo', 'seledyn', 'kobalt', 'oliwka', 'turkus', 'purpura'];
export const START_GLAZES: readonly GlazeId[] = ['biel', 'miod', 'zelazo'];
export const GLAZE_NAME: Readonly<Record<GlazeId, string>> = Object.fromEntries(GLAZES.map(g => [g, t(`glaze.${g}` as Key)])) as Record<GlazeId, string>;

export const PATTERNS: readonly PatternId[] = ['pas', 'fala', 'kropki', 'zygzak', 'galazka'];
export const START_PATTERNS: readonly PatternId[] = ['pas'];
export const PATTERN_NAME: Readonly<Record<PatternId, string>> = Object.fromEntries(PATTERNS.map(p => [p, t(`pattern.${p}` as Key)])) as Record<PatternId, string>;

export const KILN_GIFTS: readonly KilnGift[] = ['blush', 'speckle', 'moon'];
export const KILN_GIFT_NAME: Readonly<Record<KilnGift, string>> = { blush: t('gift.blush'), speckle: t('gift.speckle'), moon: t('gift.moon') };

// ── the shop (the lobby's card) ─────────────────────────────────
export type ShopItem =
  | { id: string; kind: 'glaze'; ref: GlazeId; price: number }
  | { id: string; kind: 'pattern'; ref: PatternId; price: number }
  | { id: string; kind: 'wheel' | 'kiln'; ref: number; price: number };

export const SHOP: readonly ShopItem[] = [
  { id: 'g.seledyn', kind: 'glaze', ref: 'seledyn', price: 40 },
  { id: 'p.fala', kind: 'pattern', ref: 'fala', price: 30 },
  { id: 'w.1', kind: 'wheel', ref: 1, price: 60 },
  { id: 'g.kobalt', kind: 'glaze', ref: 'kobalt', price: 60 },
  { id: 'k.1', kind: 'kiln', ref: 1, price: 80 },
  { id: 'p.kropki', kind: 'pattern', ref: 'kropki', price: 40 },
  { id: 'g.oliwka', kind: 'glaze', ref: 'oliwka', price: 70 },
  { id: 'w.2', kind: 'wheel', ref: 2, price: 140 },
  { id: 'p.zygzak', kind: 'pattern', ref: 'zygzak', price: 60 },
  { id: 'g.turkus', kind: 'glaze', ref: 'turkus', price: 100 },
  { id: 'k.2', kind: 'kiln', ref: 2, price: 180 },
  { id: 'p.galazka', kind: 'pattern', ref: 'galazka', price: 120 },
  { id: 'w.3', kind: 'wheel', ref: 3, price: 260 },
  { id: 'g.purpura', kind: 'glaze', ref: 'purpura', price: 220 },
  { id: 'k.3', kind: 'kiln', ref: 3, price: 320 },
];

// ── customers ────────────────────────────────────────────────────
export const HOUSES: readonly HouseId[] = ['karczma', 'piekarnia', 'mlodzi'];
export const WALKINS: readonly WalkId[] = ['pasterz', 'baruch', 'wdowa', 'kupiec', 'rybak'];

/** How a customer is drawn: the robe, the head (scarf, turban, cap, bare), the trim, a beard, the height. */
export interface Look { robe: string; head: 'scarf' | 'turban' | 'cap' | 'bare'; hcol: string; trim: string; beard: boolean; tall: number; two?: boolean }

export const LOOK: Readonly<Record<CustomerId, Look>> = {
  karczma: { robe: '#8C3B22', head: 'turban', hcol: '#E9D8BC', trim: '#D9A441', beard: true, tall: 1.08 },
  piekarnia: { robe: '#D9A441', head: 'scarf', hcol: '#F4EFE6', trim: '#8A5A3C', beard: false, tall: 0.94 },
  mlodzi: { robe: '#4F7A3A', head: 'scarf', hcol: '#C4673F', trim: '#F2C48A', beard: false, tall: 0.98, two: true },
  pasterz: { robe: '#A9A35B', head: 'bare', hcol: '#3B2A22', trim: '#6B5B73', beard: false, tall: 0.82 },
  baruch: { robe: '#3F6E9C', head: 'cap', hcol: '#2C4E9E', trim: '#E9D8BC', beard: true, tall: 1.0 },
  wdowa: { robe: '#6B5B73', head: 'scarf', hcol: '#3B2A22', trim: '#A5C4AE', beard: false, tall: 0.92 },
  kupiec: { robe: '#7A2E5C', head: 'turban', hcol: '#F2C48A', trim: '#D9A441', beard: true, tall: 1.04 },
  rybak: { robe: '#5E7E8C', head: 'cap', hcol: '#8A5A3C', trim: '#E9D8BC', beard: true, tall: 1.0 },
  targ: { robe: '#B07A55', head: 'bare', hcol: '#3B2A22', trim: '#E9D8BC', beard: false, tall: 0.9 },
};

export const CUSTOMER_NAME: Readonly<Record<CustomerId, string>> = Object.fromEntries(
  ([...HOUSES, ...WALKINS, 'targ'] as CustomerId[]).map(c => [c, t(`who.${c}` as Key)])) as Record<CustomerId, string>;

/** Each household's four story steps: the form asked for, in order. */
export const STORY: Readonly<Record<HouseId, readonly FormId[]>> = {
  karczma: ['kubek', 'miednica', 'garnek', 'dzban'],
  piekarnia: ['misa', 'sloj', 'dzbanuszek', 'lampka'],
  mlodzi: ['miska', 'dzbanek', 'donica', 'zapis'],
};

/** A story step's line (house, step 1..4): the request, then the thanks. */
export const storyAsk = (h: HouseId, step: number): string => t(`story.${h}.${Math.min(4, Math.max(1, step))}` as Key);
export const storyThanks = (h: HouseId, step: number): string => t(`story.${h}.${Math.min(4, Math.max(1, step))}.done` as Key);

// ── the blocks' strategies (pure strategies, never the mechanic) ─
export const TIPS = {
  warm: t('tip.warm'),
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3'), t('tip.rest.4')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
} as const;

// ── the cat's moments ───────────────────────────────────────────
export type Moment = 'open' | 'warm' | 'push' | 'blind' | 'good' | 'master' | 'rest' | 'heat' | 'perfect' | 'miss'
  | 'sale3' | 'sale1' | 'color' | 'market' | 'gift' | 'newForm' | 'end' | 'idle' | 'sloppy';
export const MOMENTS: readonly Moment[] = ['open', 'warm', 'push', 'blind', 'good', 'master', 'rest', 'heat', 'perfect', 'miss',
  'sale3', 'sale1', 'color', 'market', 'gift', 'newForm', 'end', 'idle', 'sloppy'];
/** lines per moment in the catalog: cat.<moment>.1 … .n */
const LINE_N = 4;
export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(MOMENTS.map(m => [m,
  Array.from({ length: LINE_N }, (_, i) => t(`cat.${m}.${i + 1}` as Key))])) as Record<Moment, string[]>;

/** The customers' reactions at the sale, by stars, plus a few specifics. */
export type Reaction = 'r3' | 'r2' | 'r1' | 'rColor' | 'rHot' | 'rSoft' | 'rMaster';
export const REACT: Readonly<Record<Reaction, readonly string[]>> = Object.fromEntries((['r3', 'r2', 'r1', 'rColor', 'rHot', 'rSoft', 'rMaster'] as Reaction[])
  .map(r => [r, [1, 2, 3].map(i => t(`react.${r}.${i}` as Key))])) as Record<Reaction, string[]>;

/** The passages a session may close with (best fit first); the lobby opens with Jeremiah 18:6. */
export const CLOSING: Readonly<Record<'master' | 'story' | 'glaze' | 'calm' | 'clay' | 'work', PassageId>> = {
  master: 'jer18.4', story: 'num6.24-26', glaze: 'isa61.3', calm: 'psa37.7', clay: '2co4.7', work: 'col3.23',
};
