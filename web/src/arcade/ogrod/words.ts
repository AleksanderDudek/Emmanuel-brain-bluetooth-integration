/**
 * Ogród o świcie's word sets (DESIGN.md §23): what the player may bring to each station, each word under a stable key
 * (kept in the progress as `{ k }`, prep.ts `Word`) and shown in the page's language (prep-i18n.ts `w.<set>.<key>`).
 *
 *   feel    lzy       12 feelings of grief, relief among them ("every feeling may be here")
 *   harsh   dlon      8 harsh things a broken heart says to itself, each answered by …
 *   kind    dlon      … a kind, true word in the first person (never toxic positivity, never a gendered form)
 *   bound   furtka    10 things that keep reopening the wound
 *   int     furtka    8 small, concrete boundaries for the week (for the time of healing, not punishment)
 *   stone   kamienie  5 stones of resentment — toward the other, myself, what happened, God (a lament), others
 *   seed    nasiona   16 values, strengths and loves to sow
 *
 * Limits on what the player chooses and writes live here too, so the lobby, prep.ts and the tests agree.
 */
import { t, type Key } from './prep-i18n';
import type { StationId } from './stations';

export type WordSet = 'feel' | 'harsh' | 'kind' | 'bound' | 'int' | 'stone' | 'seed';

export const WORDS: Readonly<Record<WordSet, readonly string[]>> = {
  feel: ['smutek', 'zal', 'tesknota', 'zlosc', 'lek', 'wstyd', 'samotnosc', 'rozczarowanie', 'wina', 'pustka', 'zmeczenie', 'ulga'],
  harsh: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8'],
  kind: ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8'],
  bound: ['wiadomosci', 'zdjecia', 'profil', 'miejsca', 'piosenki', 'rozmowy', 'wspomnienia', 'pytania', 'znak', 'noc'],
  int: ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8'],
  stone: ['zal-osoba', 'zal-siebie', 'zal-stalo', 'zal-bog', 'zal-inni'],
  seed: [
    'czulosc', 'wiernosc', 'odwaga', 'humor', 'ciekawosc', 'tworczosc', 'muzyka', 'ruch',
    'przyroda', 'przyjazn', 'sluzba', 'wiara', 'cierpliwosc', 'prawda', 'goscinnosc', 'nauka',
  ],
};

/** The harsh word each kind word answers (the pairs share their number): h1 → k1 … h8 → k8. */
export const PAIRS: readonly (readonly [string, string])[] = WORDS.harsh.map((hk, i) => [hk, WORDS.kind[i]] as const);

/** How many the player picks, at least and at most (own words included). */
export const PICK: Readonly<Record<'feel' | 'bound' | 'stone' | 'seed', readonly [number, number]>> = {
  feel: [1, 3], bound: [1, 4], stone: [1, 3], seed: [1, 3],
};

/** An own word or a name: at most this many characters. */
export const OWN_LEN = 24;
/** The people a lantern is lit for (besides me and all). */
export const FRIENDS_MAX = 5;

/** Whether `k` is a key of `set`. */
export const isWord = (set: WordSet, k: unknown): k is string => typeof k === 'string' && WORDS[set].includes(k);

/** A set's word in the page's language. */
export const wordText = (set: WordSet, k: string): string => t(`w.${set}.${k}` as Key);

/** Own words are trimmed, inner spaces folded, cut to OWN_LEN characters (whole code points); '' when nothing is left. */
export function ownWord(s: unknown): string {
  if (typeof s !== 'string') return '';
  const one = s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...one].slice(0, OWN_LEN).join('').trim();
}

/** A station's name in the lobby (the dawn too). */
export const stationName = (id: StationId | 'swit'): string => t(`st.${id}` as Key);
/** What the station is, in one line. */
export const stationWhat = (id: StationId | 'swit'): string => t(`st.${id}.what` as Key);
