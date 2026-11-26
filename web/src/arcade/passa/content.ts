/**
 * Złota passa's content (DESIGN.md §26): the passages each part of the day rests on — all by passage id from the
 * generated src/content/scripture.ts, never typed — the moment sets' structure (what each moment is: its kind, the
 * small picture the street draws for it, its part of the day; the words are in sets.ts, four languages) and the
 * narrator's moments.
 *
 * Where a Christian stands (moments.ts, the lead's contract): not "the universe conspires for me" but Rom 8:28; never
 * "nothing bad has ever happened to me" but Gen 50:20 — the evil named, the good God brings out of it hoped for, not
 * pretended.  Gen 50:20 and the passages on trials (Rom 5:3-5, Jas 1:2-4, 2 Cor 4:17) close a day only after the player
 * asked for a hard thing and met it.
 */
import type { PassageId } from '../kit/scripture';
import type { DayPart, MomentKind, Motif } from './moments';

/** The root (the registry's): "all things work together for good to them that love God" (Rom 8:28). */
export const ROOT: PassageId = 'rom8.28';

/** The passages of each part of the day, in turn session by session (verseFor). */
export const VERSES = {
  /** dawn on the street: the root, the day the Lord has made, mercies new every morning */
  intro: ['rom8.28', 'psa118.24', 'lam3.22-23'],
  /** a heavy moment's name: near to the brokenhearted */
  name: ['psa34.18'],
  /** the garland over the evening street: the lines fallen in pleasant places; goodness and mercy all my days */
  garland: ['psa16.6', 'psa23.6'],
  /** the prayer of thanks */
  prayer: ['1th5.18', 'eph5.20'],
  /** the closing card and result().verse, in turn */
  close: ['rom8.28', '1th5.18', 'eph5.20', 'psa23.6', 'psa16.6', 'psa118.24', 'lam3.22-23'],
  /** the closing card after a day that met a heavy moment (the evil named; the good hoped for) */
  closeHeavy: ['gen50.20', 'rom5.3-5', '2co4.17', 'jas1.2-4'],
} as const satisfies Record<string, readonly PassageId[]>;
export type VerseKey = keyof typeof VERSES;

/** Every passage the game can show (the tests check each exists in all four languages). */
export const ALL_VERSES: readonly PassageId[] = [...new Set<PassageId>([ROOT, ...Object.values(VERSES).flat()])];

/** The passage of a part for the n-th session (1-based). */
export function verseFor(key: VerseKey, session: number): PassageId {
  const list: readonly PassageId[] = VERSES[key];
  const n = Math.max(1, Math.floor(Number.isFinite(session) ? session : 1)) - 1;
  return list[n % list.length];
}

/** A moment of the sets: what it is, without its words (sets.ts holds them). */
export interface SetMoment { id: string; kind: MomentKind; motif: Motif; part: DayPart }

const j = (id: string, motif: Motif, part: DayPart): SetMoment => ({ id, kind: 'joy', motif, part });
const s = (id: string, motif: Motif, part: DayPart): SetMoment => ({ id, kind: 'snag', motif, part });
const hv = (id: string, motif: Motif): SetMoment => ({ id, kind: 'heavy', motif, part: 'afternoon' });

/** Small goods: see them and give thanks (one win each — the gold side). */
export const JOYS: readonly SetMoment[] = [
  j('coffee', 'cup', 'morning'), j('green', 'light', 'morning'), j('sun', 'sun', 'morning'), j('bird', 'bird', 'morning'),
  j('seat', 'bus', 'morning'), j('message', 'phone', 'noon'), j('water', 'cup', 'noon'), j('smile', 'smile', 'noon'),
  j('meal', 'seed', 'noon'), j('praise', 'desk', 'afternoon'), j('card', 'letter', 'afternoon'), j('flowers', 'seed', 'afternoon'),
  j('quiet', 'clock', 'afternoon'), j('sunset', 'sun', 'evening'), j('home', 'hand', 'evening'), j('bed', 'door', 'evening'),
];

/** Small troubles: two sides — as it happened, and as a win (two or three reframes each). */
export const SNAGS: readonly SetMoment[] = [
  s('parking', 'car', 'morning'), s('rain', 'rain', 'morning'), s('delay', 'clock', 'morning'), s('spill', 'spill', 'morning'),
  s('missed', 'bus', 'morning'), s('keys', 'door', 'morning'), s('queue', 'queue', 'noon'), s('stain', 'spill', 'noon'),
  s('doctor', 'clinic', 'noon'), s('meeting', 'desk', 'afternoon'), s('mistake', 'desk', 'afternoon'), s('battery', 'phone', 'afternoon'),
  s('cancel', 'phone', 'afternoon'), s('bill', 'letter', 'afternoon'), s('traffic', 'car', 'evening'), s('cold', 'cup', 'evening'),
];

/**
 * What really hurts — only when the player asks for it in the lobby, at most one a day: the hurt named first, then
 * humble hopes (never a promise, never "that is why it happened to you") and always "not yet — I trust".
 */
export const HEAVIES: readonly SetMoment[] = [
  hv('diagnosis', 'clinic'), hv('loss', 'heart'), hv('job', 'desk'), hv('breakup', 'door'),
  hv('body', 'hand'), hv('lonely', 'phone'), hv('failure', 'seed'), hv('wait', 'clock'),
];

export const SETS: readonly SetMoment[] = [...JOYS, ...SNAGS, ...HEAVIES];
export const setById = (id: string): SetMoment | undefined => SETS.find(m => m.id === id);

/** The small picture of a player's own moment, by its kind. */
export const OWN_MOTIF: Readonly<Record<MomentKind, Motif>> = { joy: 'sun', snag: 'rain', heavy: 'hand' };

/** What the narrator speaks about (talk.ts; the lines are in i18n.ts as `say.<what>.<n>`). */
export const SAYS = [
  'intro', 'introFirst',
  // a card comes: a joy, a snag, the player's own, one that came back
  'arriveJoy', 'arriveSnag', 'arriveOwn', 'backYesterday', 'backLately',
  // a heavy moment: the hurt said plainly
  'name',
  // the turn: what it asks, a choice made, no progress yet, turned
  'turnJoy', 'turnSnag', 'turnHeavy', 'wait', 'turned', 'turnedTrust', 'abide',
  // after: the light in the garland, or the pocket
  'savor', 'carry',
  // the evening
  'evening', 'eveningQuiet', 'prayer', 'close',
] as const;
export type Say = (typeof SAYS)[number];
