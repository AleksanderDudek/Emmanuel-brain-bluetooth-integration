/**
 * Koła światła's content (DESIGN.md §28): the twelve wheels of the well-known chart — a person seen in profile, the
 * first wheel opening down between the legs, the seventh up from the crown, the five between opening to the front and
 * to the back — their order, colours, petals and passages; the qualities a wheel is brought to right working in; the
 * narrator's moments.  All passages by id from the generated src/content/scripture.ts, never typed.
 *
 * The names are the ones the founder chose in round 10 for Rzeki żywej wody (rzeki/i18n.ts `name.*`), so the two
 * meditations speak alike.  What the screens say (§18.3): light, not energy; the prayer has a Thou (the Father,
 * through Jesus, in the Spirit) and receives each place's gift; the light pictures attention, never grace.
 */
import type { PassageId } from '../kit/scripture';

/** The seven centres, from the base up (the ids are Rzeki's stations, for the names). */
export type CentreId = 'root' | 'sacral' | 'plexus' | 'heart' | 'throat' | 'brow' | 'crown';
export const CENTRES: readonly CentreId[] = ['root', 'sacral', 'plexus', 'heart', 'throat', 'brow', 'crown'];

/** Where a wheel opens: down between the legs, to the front, to the back, up from the crown. */
export type Side = 'down' | 'front' | 'back' | 'up';

export type WheelId =
  | 'root' | 'sacralF' | 'sacralB' | 'plexusF' | 'plexusB' | 'heartF' | 'heartB' | 'throatF' | 'throatB' | 'browF' | 'browB' | 'crown';

export interface Wheel {
  id: WheelId;
  centre: CentreId;
  side: Side;
  /** the centre's number in the chart (1 the base … 7 the crown) */
  num: number;
}

/** The way: one after another, from the base up — 1, 2 front, 2 back, … 6 back, 7. */
export const WHEELS: readonly Wheel[] = [
  { id: 'root', centre: 'root', side: 'down', num: 1 },
  { id: 'sacralF', centre: 'sacral', side: 'front', num: 2 },
  { id: 'sacralB', centre: 'sacral', side: 'back', num: 2 },
  { id: 'plexusF', centre: 'plexus', side: 'front', num: 3 },
  { id: 'plexusB', centre: 'plexus', side: 'back', num: 3 },
  { id: 'heartF', centre: 'heart', side: 'front', num: 4 },
  { id: 'heartB', centre: 'heart', side: 'back', num: 4 },
  { id: 'throatF', centre: 'throat', side: 'front', num: 5 },
  { id: 'throatB', centre: 'throat', side: 'back', num: 5 },
  { id: 'browF', centre: 'brow', side: 'front', num: 6 },
  { id: 'browB', centre: 'brow', side: 'back', num: 6 },
  { id: 'crown', centre: 'crown', side: 'up', num: 7 },
];
export const WHEEL_IDS: readonly WheelId[] = WHEELS.map(w => w.id);
export const wheelOf = (id: WheelId): Wheel => WHEELS.find(w => w.id === id)!;
/** The other wheel of the same centre (null for the base and the crown). */
export function partnerOf(id: WheelId): WheelId | null {
  const w = wheelOf(id);
  if (w.side !== 'front' && w.side !== 'back') return null;
  return `${w.centre}${w.side === 'front' ? 'B' : 'F'}` as WheelId;
}

/**
 * The colours of the tradition in clean, luminous tones: `hue` the wheel's light, `deep` its jewel when it is whole
 * (round 2), `core` the white-hot middle, `dull` the colour it starts from (a grey of its own hue).
 */
export interface Hue { hue: string; deep: string; core: string; dull: string }
export const HUE: Readonly<Record<CentreId, Hue>> = {
  root: { hue: '#ff5a64', deep: '#c8183a', core: '#ffe2dc', dull: '#6e4a50' },
  sacral: { hue: '#ffa04a', deep: '#e0661a', core: '#fff0dc', dull: '#6e5a48' },
  plexus: { hue: '#ffde5a', deep: '#e8ae12', core: '#fffbe2', dull: '#6c654a' },
  heart: { hue: '#5ee89e', deep: '#1aa864', core: '#eafff2', dull: '#4a6656' },
  throat: { hue: '#62c8ff', deep: '#1f84d8', core: '#e6f7ff', dull: '#4a5e6e' },
  brow: { hue: '#8c88ff', deep: '#4a40d8', core: '#eceaff', dull: '#56546e' },
  crown: { hue: '#d6b4ff', deep: '#9a62ee', core: '#fff8ff', dull: '#625a6e' },
};

/** The petals of each wheel's first ring (my own drawing: the tradition's counts for 1–5, eight and twenty above). */
export const PETALS: Readonly<Record<CentreId, number>> = { root: 4, sacral: 6, plexus: 10, heart: 12, throat: 16, brow: 8, crown: 20 };

/** The petals of a wheel's ring — the outer ring (round 1), the inner ring (2) and the corona of rays (3) alike. */
export const petalsOf = (id: WheelId): number => PETALS[wheelOf(id).centre];

/** Every petal of a whole round (all twelve wheels): 4 + 2 × (6 + 10 + 12 + 16 + 8) + 20 = 128. */
export const ROUND_PETALS = WHEELS.reduce((n, w) => n + PETALS[w.centre], 0);

/**
 * The qualities a wheel is brought to right working in.  Round 1: its axis steadies (the wobble settles), its turn
 * becomes calm, even and clockwise as seen from outside (a wheel turning the wrong way slows, stops and turns round),
 * its petals even out, its colour clears and brightens, its mouth opens (or gathers) to a healthy size.  Round 2: the
 * inner ring of petals unfolds and the colour deepens to its jewel.  Round 3: a corona of fine rays, and a soft halo.
 */
export type Quality = 'axis' | 'turn' | 'petals' | 'colour' | 'size' | 'inner' | 'deep' | 'rays' | 'halo';
export const ROUND_QUALITIES: Readonly<Record<1 | 2 | 3, readonly Quality[]>> = {
  1: ['axis', 'turn', 'petals', 'colour', 'size'],
  2: ['inner', 'deep'],
  3: ['rays', 'halo'],
};

/**
 * A round's qualities in `k` steps (1 ≤ k ≤ the round's count): neighbours merge so a short session asks fewer steps
 * of a wheel — round 1 in 2 steps: axis and turn, then petals, colour and size.
 */
export function stepsOf(round: 1 | 2 | 3, k: number): Quality[][] {
  const q = ROUND_QUALITIES[round];
  const n = Math.max(1, Math.min(q.length, Math.round(Number.isFinite(k) ? k : 1)));
  if (round === 1) {
    const PARTS: Readonly<Record<number, readonly (readonly Quality[])[]>> = {
      1: [['axis', 'turn', 'petals', 'colour', 'size']],
      2: [['axis', 'turn'], ['petals', 'colour', 'size']],
      3: [['axis', 'turn'], ['petals', 'colour'], ['size']],
      4: [['axis'], ['turn'], ['petals', 'colour'], ['size']],
      5: [['axis'], ['turn'], ['petals'], ['colour'], ['size']],
    };
    return PARTS[n].map(s => [...s]);
  }
  return n === 1 ? [[...q]] : q.map(x => [x]);
}

/** The passage that rests on each wheel's place (Rzeki's for the seven, and their back: what carries from behind). */
export const WHEEL_VERSE: Readonly<Record<WheelId, PassageId>> = {
  root: 'col2.7',
  sacralF: 'jhn7.38-39',
  sacralB: 'isa58.11',
  plexusF: 'eph3.16',
  plexusB: 'psa18.32',
  heartF: 'rom5.5',
  heartB: 'eph3.17',
  throatF: 'psa141.3',
  throatB: 'isa30.21',
  browF: 'eph1.18',
  browB: 'psa139.12',
  crown: 'php4.7',
};

/** The root (the registry's): "the whole body… through the work of each individual part" (Eph 4:16). */
export const ROOT: PassageId = 'eph4.16';

/** The passages of the frame's moments, said in turn session by session (verseFor). */
export const VERSES = {
  /** the arrival: before and behind (Isa 58:8 — the light breaks forth, the glory of the LORD the rear guard) */
  arrive: ['isa58.8', 'eph4.16'],
  /** the full field: one body of many parts */
  field: ['eph4.16', '1co12.12', 'rom12.4-5', 'mat6.22'],
  /** the closing card and result().verse, in turn */
  close: ['eph4.16', '1co12.12', 'rom12.4-5', 'isa58.8', 'num6.24-26'],
} as const satisfies Record<string, readonly PassageId[]>;
export type VerseKey = keyof typeof VERSES;

/** Every passage the meditation can show (the tests check each exists in all four languages). */
export const ALL_VERSES: readonly PassageId[] = [...new Set<PassageId>([ROOT, ...Object.values(WHEEL_VERSE), ...Object.values(VERSES).flat()])];

/** The passage of a moment for the n-th session (1-based), `k` more along for a later showing in it. */
export function verseFor(key: VerseKey, session: number, k = 0): PassageId {
  const list: readonly PassageId[] = VERSES[key];
  const n = Math.max(1, Math.floor(Number.isFinite(session) ? session : 1)) - 1 + Math.max(0, Math.floor(k));
  return list[n % list.length];
}

/** What the narrator speaks about (talk.ts; the lines are in i18n.ts as `say.<moment>.<n>`). */
export const MOMENTS = [
  'arrive', 'first', 'next', 'wheelTrue', 'pair', 'wait', 'valve', 'round2', 'round3', 'abide',
  'field', 'fieldWhole', 'fieldPart', 'close',
] as const;
export type Moment = (typeof MOMENTS)[number];
