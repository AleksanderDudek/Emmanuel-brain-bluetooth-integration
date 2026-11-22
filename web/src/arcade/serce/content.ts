/**
 * What Z głowy do serca walks through (DESIGN.md §18): the descent's places from the brow (where the band sits) to
 * the heart, the heart, the heart's field round the whole person (circle 0, me), the five circles — family, friends,
 * the people I work with and meet, those who hurt me, the whole world — the one sun over all of them, the four
 * dimensions of Ephesians 3:18, and the return into the heart.  Each with its words' keys (i18n.ts), its verse (a
 * passage id: the texts come only from scripture.ts) and the strategy for the head in a push.
 *
 * The words of the heart ride the breath: the Jesus Prayer split on it (the default), "Jezu", "Abba, Ojcze",
 * "Maranatha", or the player's own words.  The blessings are original prayer words, one line per whole breath.
 */
import type { PassageId } from '../kit/scripture';
import { t, type Key } from './i18n';
import { RULES } from './rules';

/** The stages of the way, in order. `back` is the return into the heart; `more` lights more on the Earth after the way. */
export type StageId = 'descent' | 'heart' | 'field' | 'ring1' | 'ring2' | 'ring3' | 'ring4' | 'ring5' | 'sun' | 'pervade' | 'back' | 'more';
export const STAGES: readonly StageId[] = ['descent', 'heart', 'field', 'ring1', 'ring2', 'ring3', 'ring4', 'ring5', 'sun', 'pervade', 'back', 'more'];

/** The rings 1–5 (0 is the field round the figure itself: me). */
export type Ring = 1 | 2 | 3 | 4 | 5;
export const RINGS: readonly Ring[] = [1, 2, 3, 4, 5];
export const ringStage = (r: Ring): StageId => `ring${r}` as StageId;
export const stageRing = (s: StageId): Ring | null => (/^ring[1-5]$/.test(s) ? (Number(s[4]) as Ring) : null);

/** The descent's places (kit/figure PLACE), in order. */
export type PlaceId = (typeof RULES.descentPlaces)[number];
export const PLACES: readonly PlaceId[] = RULES.descentPlaces;

/** The kinds of rest: a stop on the descent, gratitude at the heart, a blessing, the sun's, the closing, the heart word. */
export type RestKind = 'stop' | 'grat' | 'bless' | 'sun' | 'amen' | 'word' | 'more';

/** How each ring's lamps look (the brief's "each its own, readable even at phone size"). */
export interface RingLook {
  /** the lamps' colour, lit */
  lamp: string;
  /** the ring's line colour, reached */
  line: string;
  /** how the lamps sit on the ring */
  layout: 'house' | 'pairs' | 'town' | 'thorns' | 'world';
}
export const RING_LOOK: Readonly<Record<Ring, RingLook>> = {
  1: { lamp: '#ffb766', line: '#ffcf96', layout: 'house' },
  2: { lamp: '#ffd36b', line: '#ffe0a0', layout: 'pairs' },
  3: { lamp: '#fff0c8', line: '#f4ead2', layout: 'town' },
  4: { lamp: '#ffc4d6', line: '#d9c7cf', layout: 'thorns' },
  5: { lamp: '#ffd27a', line: '#bfe0ff', layout: 'world' },
};

/** The lines of each ring's blessing (0 = me), one per whole breath. */
export const BLESS_LINES: Readonly<Record<0 | Ring, number>> = { 0: 3, 1: 2, 2: 2, 3: 2, 4: 3, 5: 2 };
export const blessLine = (ring: 0 | Ring, i: number): string => t(`bless.${ring}.${i + 1}` as Key);


// ── the words of the heart ──────────────────────────────────────
export type WordId = 'jesus' | 'name' | 'abba' | 'maranatha' | 'own';
export const WORDS: readonly WordId[] = ['jesus', 'name', 'abba', 'maranatha', 'own'];

/** Plain text for own words and names: no control characters, single spaces, at most `max` characters. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, max).join('').trim();
}
export const cleanOwn = (v: unknown): string => cleanText(v, RULES.ownMax);
export const cleanName = (v: unknown): string => cleanText(v, RULES.nameMax);

/**
 * The heart word split on the breath: what is said breathing in and breathing out.  Own words split at their first
 * comma or dash (both halves on both breaths when there is none); empty own words fall back to the Jesus Prayer.
 */
export function heartWord(word: WordId, own: string): { in: string; out: string } {
  if (word === 'own') {
    const s = cleanOwn(own);
    if (!s) return heartWord('jesus', '');
    const m = s.match(/^(.+?[,;—–-])\s*(.+)$/);
    return m ? { in: m[1].trim(), out: m[2].trim() } : { in: s, out: s };
  }
  return { in: t(`word.${word}.in` as Key), out: t(`word.${word}.out` as Key) };
}

/** The word's name for the lobby's card. */
export const wordName = (w: WordId): string => t(`word.${w}` as Key);

// ── the verses (passage ids only) ───────────────────────────────
/** The verses of each stage and rest; the first of each list is shown, the next sessions take them in turn. */
export const VERSES = {
  root: ['1jn4.16'],
  descent: ['2co4.6', 'rom10.8', 'php4.7'],
  heart: ['rom5.5', 'ezk36.26', 'pro4.23'],
  grat: ['psa103.2', 'col3.15'],
  ring0: ['mrk12.31', 'psa139.14'],
  ring1: ['eph3.14-15'],
  ring2: ['jhn15.12'],
  ring3: ['gal6.10', 'rom12.18'],
  ring4: ['luk6.27-28', 'isa55.13', 'isa35.1', 'rom12.14'],
  ring5: ['jhn3.16', 'psa24.1'],
  sun: ['mat5.44-45'],
  pervade: ['eph3.18'],
  amen: ['num6.24-26'],
  closing: ['eph3.17-19', '1co13.13', 'col3.14'],
} as const satisfies Record<string, readonly PassageId[]>;
export type VerseKey = keyof typeof VERSES;

/** A verse of a list, by the session's number (in turn from session to session). */
export const verseFor = (k: VerseKey, session: number): PassageId => {
  const list = VERSES[k] as readonly PassageId[];
  return list[(Math.max(1, Math.floor(session)) - 1) % list.length];
};

/** Every passage the game names (the tests check each exists in four languages). */
export const ALL_VERSES: readonly PassageId[] = [...new Set(Object.values(VERSES).flat() as PassageId[])];

// ── the rings' words ────────────────────────────────────────────
export const ringName = (r: 0 | Ring): string => t(`ring.${r}` as Key);
/** "od kręgu przyjaciół" — where the next session goes on. */
export const fromRing = (r: Ring): string => t(`from.${r}` as Key);

/** The named arcs of ring 5 in long sessions (the people the world's light reaches by name). */
export const ARCS = ['suffer', 'lonely', 'sick', 'dying', 'born'] as const;
export type ArcId = (typeof ARCS)[number];
export const arcName = (a: ArcId): string => t(`arc.${a}` as Key);

/** Ephesians 3:18's four dimensions, as the pervading stage draws them. */
export const DIMS = ['width', 'length', 'height', 'depth'] as const;
export const dimName = (d: (typeof DIMS)[number]): string => t(`dim.${d}` as Key);

// ── the strategies for the head (the runner's panel line in a push) ─
/** The push's strategy: what to picture or say in the head now (one line, changes with the stage). */
export function pushTip(stage: StageId, place: PlaceId, n: number, who = ''): string {
  switch (stage) {
    case 'descent': return t(`tip.descent.${(n % 3) + 1}` as Key, { place: t(`place.${place}` as Key) });
    case 'heart': return t('tip.heart');
    case 'field': return t('tip.field');
    case 'ring4': return t('tip.ring4');
    case 'ring1': case 'ring2': case 'ring3': case 'ring5': return t(`tip.${stage}` as Key);
    case 'sun': return t('tip.sun');
    case 'pervade': return t('tip.pervade');
    case 'back': return t('tip.back');
    case 'more': return who ? t('tip.moreFor', { who }) : t('tip.more');
  }
}

/** The rest's strategy line. */
export function restTip(kind: RestKind, n: number): string {
  if (kind === 'grat') return t('tip.grat');
  if (kind === 'stop' || kind === 'word') return t('tip.word');
  return t(`tip.rest.${(n % 3) + 1}` as Key);
}
