/**
 * Ogród o świcie's content (DESIGN.md §23): the passages each moment of the way rests on — all by passage id from the
 * generated src/content/scripture.ts, never typed — and the narrator's moments.  The stations themselves (their order,
 * what each is, the session's frame) are the lead's contract in stations.ts; the player's words come from the
 * preparation (prep.ts, builder B).
 *
 * What the screens say (§18.3): God comforts, gathers the tears, calls by name and makes the garden grow; the player
 * feels, lets go, blesses, sows and entrusts.  The light pictures attention, never grace; no promise of healing.
 */
import type { PassageId } from '../kit/scripture';
import type { StationId } from './stations';

/** The root (the registry's): "weeping may stay for the night, but joy comes in the morning" (Ps 30:6). */
export const ROOT: PassageId = 'psa30.5';

/** The passages of each moment, said in turn session by session (verseFor). */
export const VERSES = {
  /** the night garden after rain: the root, near to the brokenhearted */
  arrive: ['psa30.5', 'psa34.18'],
  /** the stations' cards (the first settle rest of each), in turn */
  lzy: ['psa56.8', 'ecc3.4', 'mat5.4'],
  dlon: ['isa66.13', 'psa131.2', 'mat11.28'],
  list: ['psa62.8', '1pe5.7'],
  furtka: ['pro4.23', 'psa46.10'],
  kamienie: ['col3.13', 'eph4.32'],
  latarnie: ['ecc4.9-10', '2co1.4', 'rom12.15'],
  nasiona: ['psa126.5', 'psa139.14', 'isa58.11'],
  /** the dawn: the winter is past, the flowers appear */
  sunrise: ['sng2.11-12', 'isa35.1'],
  /** the gardener calls her by name; no name given: "I have called you by name" */
  call: ['jhn20.15-16'],
  name: ['isa43.1'],
  /** the prayer's word */
  prayer: ['lam3.22-23', 'zep3.17'],
  /** the closing card and result().verse, in turn */
  close: ['sng2.11-12', 'lam3.22-23', 'jhn16.22', 'isa58.11', 'rev21.4'],
} as const satisfies Record<string, readonly PassageId[]>;
export type VerseKey = keyof typeof VERSES;

/** Every passage the meditation can show (the tests check each exists in all four languages). */
export const ALL_VERSES: readonly PassageId[] = [...new Set<PassageId>([ROOT, ...Object.values(VERSES).flat()])];

/** The passage of a moment for the n-th session (1-based), and `k` more along for a second showing in it. */
export function verseFor(key: VerseKey, session: number, k = 0): PassageId {
  const list: readonly PassageId[] = VERSES[key];
  const n = Math.max(1, Math.floor(Number.isFinite(session) ? session : 1)) - 1 + Math.max(0, Math.floor(k));
  return list[n % list.length];
}

/** What the narrator speaks about (talk.ts; the lines are in i18n.ts as `say.<moment>.<n>`). */
export const MOMENTS = [
  'arrive',
  // each station's opening, its act (first and later), its settle, and the grace that finishes an act gently
  'lzy', 'lzyAct', 'lzySettle', 'lzyGrace',
  'dlon', 'dlonAct', 'dlonSettle', 'dlonGrace',
  'list', 'listAct', 'listSail', 'listSettle', 'listGrace',
  'furtka', 'furtkaAct', 'furtkaRose', 'furtkaSettle', 'furtkaGrace',
  'kamienie', 'kamienieAct', 'kamienieHold', 'kamienieSettle', 'kamienieKeep',
  'latarnie', 'latarnieAct', 'latarnieGrace',
  'nasiona', 'nasionaAct', 'nasionaTend', 'nasionaSettle', 'nasionaGrace',
  // focus waits, an act done early (abide)
  'wait', 'abide',
  // the dawn
  'sunrise', 'call', 'close',
] as const;
export type Moment = (typeof MOMENTS)[number];

/** Each station's opening moment is its own id. */
export const openMoment = (s: StationId): Moment => s;
