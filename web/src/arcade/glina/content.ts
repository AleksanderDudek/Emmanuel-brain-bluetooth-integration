/**
 * Glina's data: the twelve forms of the Book of Vessels (their heights, outlines, glazes, what the
 * hands add at the cut, the page verses), the street's three households and their four-step
 * stories, the glazes, the kiln gifts with their published odds, the day's gifts at the gate, the
 * coaching lines, and the passages a session may close with.  Everything a designer may tune
 * without touching the rules (sim.ts, clay.ts, meta.ts); the words live in the catalog (i18n.ts).
 */
import type { PassageId } from '../kit/scripture';
import { profileFrom } from './clay';
import { t, type Key } from './i18n';

export type HouseId = 'karczma' | 'piekarnia' | 'mlodzi';
export type FormId = 'kubek' | 'misa' | 'dzbanek' | 'miska' | 'garnek' | 'dzbanuszek'
  | 'miednica' | 'sloj' | 'lampka' | 'dzban' | 'donica' | 'zapis';
export type GlazeId = 'biel' | 'miod' | 'seledyn' | 'kobalt' | 'zelazo';
export type KilnGift = 'blush' | 'speckle' | 'moon';
export type GiftId = 'seledyn' | 'kobalt' | 'zelazo' | 'kot' | 'migdal' | 'mata' | 'dzwonek' | 'figi' | 'oliwki' | 'chleb';
export type ChapterId = 'stol' | 'dom';
/** What the hands add at the cut (drawn by vessel.ts). */
export type Attachment = 'handle' | 'lip' | 'smallHandle' | 'flange' | 'rolled' | 'nozzle' | 'twoHandles' | 'lid';

export interface Form {
  id: FormId;
  chapter: ChapterId;
  house: HouseId;
  /** its step in the household's story (1..4) */
  step: number;
  /** nominal height (cm) */
  N: number;
  /** the target outline (radius ÷ height) at the 16 rings */
  q: Float64Array;
  glaze: GlazeId;
  attach: readonly Attachment[];
  /** the page's verse in the Postępy panel (null: the page carries only its use line) */
  verse: PassageId | null;
  /** 1 = the easiest (Złota godzina picks among the three easiest open forms) */
  ease: number;
  /** as inside a sentence; cap() for a label */
  name: string;
  use: string;
}

type Row = [FormId, ChapterId, HouseId, number, number, [number, number][], GlazeId, Attachment[], PassageId | null, number];

/** §3.10 of the design: id, chapter, household and step, N, the outline's control points, glaze, attachments, verse, ease. */
const ROWS: readonly Row[] = [
  ['kubek', 'stol', 'karczma', 1, 11, [[0, 0.36], [0.1, 0.37], [0.5, 0.4], [0.9, 0.43], [1, 0.45]], 'biel', [], 'mat10.42', 1],
  ['misa', 'stol', 'piekarnia', 1, 13, [[0, 0.4], [0.2, 0.53], [0.6, 0.8], [1, 1.0]], 'miod', [], 'mat6.11', 3],
  ['dzbanek', 'stol', 'mlodzi', 1, 20, [[0, 0.28], [0.25, 0.42], [0.45, 0.44], [0.7, 0.3], [0.85, 0.2], [1, 0.24]], 'kobalt', ['handle', 'lip'], null, 6],
  ['miska', 'stol', 'mlodzi', 2, 8, [[0, 0.42], [0.15, 0.6], [0.45, 0.92], [0.8, 1.1], [1, 1.16]], 'seledyn', [], null, 2],
  ['garnek', 'stol', 'karczma', 3, 16, [[0, 0.4], [0.3, 0.55], [0.55, 0.58], [0.8, 0.5], [0.9, 0.46], [1, 0.52]], 'zelazo', [], null, 5],
  ['dzbanuszek', 'stol', 'piekarnia', 3, 12, [[0, 0.22], [0.25, 0.4], [0.45, 0.42], [0.65, 0.26], [0.8, 0.12], [1, 0.15]], 'miod', ['smallHandle'], '1ki17.14', 8],
  ['miednica', 'dom', 'karczma', 2, 11, [[0, 0.95], [0.3, 1.15], [0.7, 1.35], [0.9, 1.45], [1, 1.6]], 'biel', ['flange'], 'gen18.4', 4],
  ['sloj', 'dom', 'piekarnia', 2, 20, [[0, 0.4], [0.2, 0.46], [0.6, 0.48], [0.85, 0.45], [0.93, 0.4], [1, 0.43]], 'biel', ['rolled'], '1ki17.14', 4],
  ['lampka', 'dom', 'piekarnia', 4, 9, [[0, 0.3], [0.3, 0.55], [0.6, 0.6], [0.85, 0.4], [1, 0.18]], 'zelazo', ['nozzle'], 'psa119.105', 7],
  ['dzban', 'dom', 'karczma', 4, 34, [[0, 0.2], [0.2, 0.3], [0.45, 0.34], [0.7, 0.28], [0.85, 0.14], [0.95, 0.12], [1, 0.16]], 'biel', ['twoHandles'], null, 9],
  ['donica', 'dom', 'mlodzi', 3, 22, [[0, 0.4], [0.3, 0.48], [0.7, 0.58], [0.92, 0.64], [1, 0.7]], 'zelazo', ['rolled'], 'mic4.4', 3],
  ['zapis', 'dom', 'mlodzi', 4, 26, [[0, 0.28], [0.15, 0.32], [0.75, 0.33], [0.85, 0.28], [0.93, 0.2], [1, 0.21]], 'kobalt', ['lid'], 'jer32.14', 6],
];

export const FORMS: readonly Form[] = ROWS.map(([id, chapter, house, step, N, points, glaze, attach, verse, ease]) => ({
  id, chapter, house, step, N, q: profileFrom(points), glaze, attach, verse, ease,
  name: t(`form.${id}` as Key), use: t(`use.${id}` as Key),
}));

export const FORM: Readonly<Record<FormId, Form>> = Object.fromEntries(FORMS.map(f => [f.id, f])) as Record<FormId, Form>;

/** The street from the road: the inn, the bakery mid-street, the newlyweds at its end. */
export const HOUSES: readonly HouseId[] = ['karczma', 'piekarnia', 'mlodzi'];
export const HOUSE_NAME: Readonly<Record<HouseId, string>> = {
  karczma: t('house.karczma'), piekarnia: t('house.piekarnia'), mlodzi: t('house.mlodzi'),
};

/** Each household's four steps, in order (the forms whose `house` and `step` say so). */
export const STORY: Readonly<Record<HouseId, readonly FormId[]>> = Object.fromEntries(HOUSES.map(h => [h,
  FORMS.filter(f => f.house === h).sort((a, b) => a.step - b.step).map(f => f.id)])) as Record<HouseId, FormId[]>;

export const CHAPTERS: readonly { id: ChapterId; name: string; forms: readonly FormId[] }[] = [
  { id: 'stol', name: t('chapter.stol'), forms: FORMS.filter(f => f.chapter === 'stol').map(f => f.id) },
  { id: 'dom', name: t('chapter.dom'), forms: FORMS.filter(f => f.chapter === 'dom').map(f => f.id) },
];

/** The glazes; tin white and honey are open from the start, the others come as the day's gifts. */
export const GLAZES: readonly GlazeId[] = ['biel', 'miod', 'seledyn', 'kobalt', 'zelazo'];
export const START_GLAZES: readonly GlazeId[] = ['biel', 'miod'];
export const GLAZE_NAME: Readonly<Record<GlazeId, string>> = {
  biel: t('glaze.biel'), miod: t('glaze.miod'), seledyn: t('glaze.seledyn'), kobalt: t('glaze.kobalt'), zelazo: t('glaze.zelazo'),
};

/** Wall grades, from the band judges at the cut: mocna, zgrabna, cienka, skorupka (and their rendered thickness, cm). */
export const WALL_NAME: readonly string[] = [t('wall.0'), t('wall.1'), t('wall.2'), t('wall.3')];
export const WALL_CM: readonly number[] = [0.9, 0.6, 0.4, 0.25];

/** Glaze runs from the firing's G: krople, spływy (from 0.33), długie spływy (0.66), szklany płaszcz (0.9). */
export const RUN_BANDS: readonly number[] = [0, 0.33, 0.66, 0.9];
export const RUN_NAME: readonly string[] = [t('runs.0'), t('runs.1'), t('runs.2'), t('runs.3')];
export const runBand = (G: number): number => (G >= RUN_BANDS[3] ? 3 : G >= RUN_BANDS[2] ? 2 : G >= RUN_BANDS[1] ? 1 : 0);

/** Kiln gifts per vessel at the opening (published in the lobby): one roll, doubled by a calm fire. */
export const KILN_GIFTS: readonly KilnGift[] = ['blush', 'speckle', 'moon'];
export const GIFT_ODDS: Readonly<Record<KilnGift, number>> = { blush: 0.12, speckle: 0.06, moon: 0.03 };
export const KILN_GIFT_NAME: Readonly<Record<KilnGift, string>> = { blush: t('gift.blush'), speckle: t('gift.speckle'), moon: t('gift.moon') };
/** Pity: a gift for sure after 4 vessels without one (one in every 5), moon white after 29 without it (one in 30). */
export const PITY_GIFT = 4;
export const PITY_MOON = 29;

/** The day's gifts at the gate, the same for everyone who comes that day, in turn over ten days. */
export const DAY_GIFTS: readonly GiftId[] = ['seledyn', 'kot', 'kobalt', 'migdal', 'figi', 'zelazo', 'mata', 'oliwki', 'dzwonek', 'chleb'];
export const DAY_GIFT_NAME: Readonly<Record<GiftId, string>> = {
  seledyn: t('daygift.seledyn'), kobalt: t('daygift.kobalt'), zelazo: t('daygift.zelazo'), kot: t('daygift.kot'), migdal: t('daygift.migdal'),
  mata: t('daygift.mata'), dzwonek: t('daygift.dzwonek'), figi: t('daygift.figi'), oliwki: t('daygift.oliwki'), chleb: t('daygift.chleb'),
};
/** The gifts that unlock a glaze; the treats stand on the bench for their day only. */
export const GIFT_GLAZE: Partial<Record<GiftId, GlazeId>> = { seledyn: 'seledyn', kobalt: 'kobalt', zelazo: 'zelazo' };
export const TREATS: readonly GiftId[] = ['figi', 'oliwki', 'chleb'];

/** Page marks (bits of Page.marks). */
export const MARK = {
  centre: 1 << 0, calm: 1 << 1, eggshell: 1 << 2, mantle: 1 << 3, second: 1 << 4,
  blush: 1 << 5, speckle: 1 << 6, moon: 1 << 7, porcelain: 1 << 8,
} as const;
export const glazeMark = (g: GlazeId): number => 1 << (9 + GLAZES.indexOf(g));
export const MARK_NAME: readonly [number, string][] = [
  [MARK.centre, t('mark.centre')], [MARK.calm, t('mark.calm')], [MARK.eggshell, t('mark.eggshell')], [MARK.mantle, t('mark.mantle')],
  [MARK.second, t('mark.second')], [MARK.blush, t('mark.blush')], [MARK.speckle, t('mark.speckle')], [MARK.moon, t('mark.moon')],
  [MARK.porcelain, t('mark.porcelain')],
];

/** The line under the block's name at its start: strategies to try, never "concentrate harder". */
export const TIPS = {
  throw: [t('tip.throw.1'), t('tip.throw.2'), t('tip.throw.3'), t('tip.throw.4')],
  fire: [t('tip.fire.1'), t('tip.fire.2'), t('tip.fire.3')],
  blind: t('tip.blind'),
  closed: t('tip.closed'),
} as const;

/** The first-ever session's hints, in the order they come. */
export type HintKey = 'pull' | 'shape' | 'line' | 'even' | 'over' | 'glaze' | 'kiln';
export const HINT: Readonly<Record<HintKey, string>> = {
  pull: t('hint.pull'), shape: t('hint.shape'), line: t('hint.line'), even: t('hint.even'), over: t('hint.over'), glaze: t('hint.glaze'), kiln: t('hint.kiln'),
};

/** The passages a session may close with, best fit first (sim.ts closingVerse); the lobby opens with Jeremiah 18:6. */
export const CLOSING: Readonly<Record<'second' | 'alive' | 'mantle' | 'calm' | 'clay' | 'work', PassageId>> = {
  second: 'jer18.4', alive: 'num6.24-26', mantle: 'isa61.3', calm: 'psa37.7', clay: '2co4.7', work: 'col3.23',
};
