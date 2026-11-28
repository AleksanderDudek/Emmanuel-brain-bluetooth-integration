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
import { AGES, type Age } from '../kit/ages';
import { LIFE_SETS } from './life-sets';
import { PLACES, type LifeKind, type LifeSet, type Place } from './life';
import { DAY_PARTS, type DayPart, type MomentKind, type Motif } from './moments';

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

// ── round 25: the film of a day (life.ts) ─────────────────────────

/**
 * Where the film shows a round 22 set moment (they stay the fallback for any gap in a group's sets): its place, or
 * 'work' — the group's day place (school, campus, office; a pensioner's garden).
 */
export const R22_PLACE: Readonly<Record<string, Place | 'work'>> = {
  coffee: 'kitchen', green: 'street', sun: 'street', bird: 'bedroom', seat: 'bus', message: 'street', water: 'kitchen',
  smile: 'shop', meal: 'table', praise: 'work', card: 'kitchen', flowers: 'park', quiet: 'park', sunset: 'street',
  home: 'table', bed: 'bedroom',
  parking: 'car', rain: 'street', delay: 'bus', spill: 'kitchen', missed: 'street', keys: 'bedroom', queue: 'shop',
  stain: 'work', doctor: 'counter', meeting: 'work', mistake: 'work', battery: 'street', cancel: 'park', bill: 'kitchen',
  traffic: 'car', cold: 'bedroom',
};

/** The day's place of each group (a round 22 moment of work or school is shown there). */
export const WORK_PLACE: Readonly<Record<Age, Place>> = { teen: 'school', young: 'campus', adult: 'office', mid: 'office', senior: 'garden' };

/**
 * The groups a round 22 set moment fits ([] every group): a teen does not park a car, pay the bills or sit in a work
 * meeting; the round 22 heavy moments are an adult's (11–19 meets only its own, written with a trusted adult in view).
 */
const NOT_TEEN: readonly Age[] = ['young', 'adult', 'mid', 'senior'];
export const R22_AGES: Readonly<Record<string, readonly Age[]>> = {
  coffee: NOT_TEEN, parking: NOT_TEEN, meeting: NOT_TEEN, mistake: NOT_TEEN, bill: NOT_TEEN, traffic: NOT_TEEN,
  diagnosis: NOT_TEEN, loss: NOT_TEEN, job: NOT_TEEN, breakup: NOT_TEEN, body: NOT_TEEN, lonely: NOT_TEEN, failure: NOT_TEEN, wait: NOT_TEEN,
};
export const r22Fits = (id: string, age: Age): boolean => {
  const a = R22_AGES[id];
  return !a || !a.length || a.includes(age);
};
/** Where a round 22 set moment is shown for a group. */
export const r22Place = (id: string, age: Age): Place => {
  const p = R22_PLACE[id] ?? 'street';
  return p === 'work' ? WORK_PLACE[age] : p;
};

/**
 * The route of a day, part by part (the film's order: within one part the camera only goes onward along it): the
 * morning from the bed to the day's place, noon at the day's place, the afternoon from it through the way home, the
 * evening at home.  A group's day uses the places its moments have.
 */
export const ROUTE: Readonly<Record<DayPart, readonly Place[]>> = {
  morning: ['bedroom', 'window', 'bathroom', 'kitchen', 'table', 'nursery', 'garden', 'street', 'park', 'bike', 'car', 'bus', 'school', 'campus', 'office', 'counter', 'shop'],
  noon: ['school', 'campus', 'office', 'counter', 'nursery', 'kitchen', 'table', 'shop', 'street', 'park', 'garden', 'bus', 'car', 'bike', 'bathroom', 'bedroom', 'window'],
  afternoon: ['school', 'campus', 'office', 'counter', 'nursery', 'street', 'bus', 'car', 'bike', 'shop', 'park', 'garden', 'kitchen', 'bathroom', 'table', 'bedroom', 'window'],
  evening: ['school', 'campus', 'office', 'counter', 'street', 'bus', 'car', 'bike', 'shop', 'park', 'garden', 'nursery', 'kitchen', 'bathroom', 'table', 'bedroom', 'window'],
};
/** A place's step along the route of a part of the day (0 first). */
export const routeRank = (place: Place, part: DayPart): number => {
  const i = ROUTE[part].indexOf(place);
  return i >= 0 ? i : PLACES.indexOf(place);
};

/** Where the film is in the parts of a session that have no moment: waking, the evening table, the window at night. */
export const PLACE_AT = { intro: 'bedroom', garland: 'table', prayer: 'table', close: 'window' } as const satisfies Record<string, Place>;

/** A group's set moments of a kind (its own and the shared pool, `ages: []`). */
export function lifeSets(age: Age, kind: LifeKind): LifeSet[] {
  return LIFE_SETS.filter(m => m.kind === kind && (!m.ages.length || m.ages.includes(age)));
}

/** The sense and given moments every group has at least (the plan is the same for every group: the smallest). */
export function lifeCounts(): { sense: number; given: number } {
  let sense = Infinity, given = Infinity;
  for (const a of AGES) {
    sense = Math.min(sense, lifeSets(a, 'sense').length);
    given = Math.min(given, lifeSets(a, 'given').length);
  }
  return { sense: Number.isFinite(sense) ? sense : 0, given: Number.isFinite(given) ? given : 0 };
}

/** A set moment of round 22 or of the groups' sets, by id (null: unknown). */
export function anySetById(id: string): SetMoment | LifeSet | null {
  return setById(id) ?? LIFE_SETS.find(m => m.id === id) ?? null;
}

/** The part of the day a moment of the sets belongs to (round 22's have one too). */
export const partIndex = (p: DayPart): number => DAY_PARTS.indexOf(p);

/** The small picture of a player's own moment, by its kind. */
export const OWN_MOTIF: Readonly<Record<MomentKind, Motif>> = { joy: 'sun', snag: 'rain', heavy: 'hand' };

/** What the narrator speaks about (talk.ts; the lines are in i18n.ts as `say.<what>.<n>`). */
export const SAYS = [
  'intro', 'introFirst',
  // a card comes: a joy, a snag, the player's own, one that came back — and (round 25) a thing taken for granted
  'arriveJoy', 'arriveSnag', 'arriveOwn', 'backYesterday', 'backLately', 'arriveGiven',
  // a heavy moment: the hurt said plainly
  'name',
  // the turn: what it asks, a choice made, no progress yet, turned
  'turnJoy', 'turnSnag', 'turnHeavy', 'wait', 'turned', 'turnedTrust', 'abide',
  // (round 25) a given moment's turn; a sense or a given moment received
  'turnGiven', 'turnedLife',
  // after: the light in the garland, or the pocket — and (round 25) after a sense or a given moment
  'savor', 'carry', 'savorSense', 'savorGiven',
  // the evening
  'evening', 'eveningQuiet', 'prayer', 'close',
] as const;
export type Say = (typeof SAYS)[number];
