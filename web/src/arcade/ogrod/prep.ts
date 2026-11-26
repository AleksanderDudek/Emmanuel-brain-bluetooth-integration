/**
 * Ogród o świcie's preparation (DESIGN.md §23): what the player brings into the garden, chosen in the lobby — the way
 * (which stations), and for each station its words: the feelings, the kind word, what to step back from and the week's
 * boundary, the stones, the lanterns' names, the seeds, how the dawn calls the player, and "how heavy is the heart" before.
 * Everything here stays on the device (the game's progress); own words and names never go into `result()`.  The unsent
 * letter is not here at all (letter.ts keeps it in memory only).
 *
 * CONTRACT (lead): builder B owns this file and fills it (the word sets in words.ts, the lobby in prep-panel.ts); builder
 * A's meta.ts keeps `prep: GardenPrep` in the progress (fresh `freshPrep()`, migrate with `cleanPrep()`), and the
 * session reads `prepView(prep)` once at its start.  After a session A keeps `weekOf(prep, day, walked)` as the progress'
 * `week` (migrate with `cleanWeek()`); prep-panel.ts `weekCard` shows it.  Change these shapes only through the status
 * files.
 *
 * The rest of the file is the lobby's grammar of changes (pure functions on a GardenPrep, each keeping the limits), so
 * the panel only draws and the tests can walk every choice without a DOM.
 */
import { dayKey } from '../kit/progress';
import { fmtDate } from '../../i18n';
import { t } from './prep-i18n';
import { STATIONS, recommended, type StationId } from './stations';
import { FRIENDS_MAX, PAIRS, PICK, WORDS, isWord, ownWord, wordText, type WordSet } from './words';
import type { Week } from './prep-panel';

/** A word the player chose: one of a set's (`k`: its key in words.ts, shown in the page's language) or their own (`o`). */
export type Word = { k: string } | { o: string };

/** A stone: what is let go of, and whether the player is ready to let it fall today ("not yet" holds it, gently). */
export interface Stone { w: Word; ready: boolean }

/** A lantern: who it is lit for.  'me' and 'all' are always there; 'friend' names (own words); 'hurt' is optional. */
export interface Lantern { who: 'me' | 'friend' | 'hurt' | 'all'; name?: string }

export interface GardenPrep {
  v: 1;
  /** the stations chosen, in any order (stations.ts `stationsFor` orders and fits them); null: the recommended way */
  way: StationId[] | null;
  /** lzy: 1–3 feelings */
  feelings: Word[];
  /** dlon: the kind word (and the harsh one it answers, when the player picked a pair) */
  kind: { harsh: Word | null; kind: Word };
  /** furtka: what keeps reopening the wound (1–4), and the week's boundary (a set's key, or null) */
  bounds: Word[];
  intention: string | null;
  /** kamienie: 1–3 stones */
  stones: Stone[];
  /** latarnie: the people who hold the player (≤ 5 names) and whether to light one for the one who hurt them */
  friends: string[];
  hurt: boolean;
  /** nasiona: 1–3 seeds (values, strengths, what the player loves doing) */
  seeds: Word[];
  /** świt: how the dawn calls the player (own word, optional) */
  name: string;
  /** "how heavy is your heart now", 0–10, before the next session (null: not asked / skipped); the session clears it */
  before: number | null;
}

/** What the session shows: the preparation resolved to text in the page's language. */
export interface PrepView {
  feelings: string[];
  harsh: string | null;
  kind: string;
  bounds: string[];
  intention: string | null;
  stones: { text: string; ready: boolean }[];
  /** in the order they are lit: me first, the friends, the one who hurt (when chosen), all with a broken heart last */
  lanterns: { who: Lantern['who']; text: string }[];
  seeds: string[];
  name: string | null;
  before: number | null;
}

/** The lists of words a station holds, and the set each one's keys come from. */
export type ListKey = 'feelings' | 'bounds' | 'seeds' | 'stones';
const SET_OF: Readonly<Record<ListKey, WordSet>> = { feelings: 'feel', bounds: 'bound', seeds: 'seed', stones: 'stone' };
const PICK_OF: Readonly<Record<ListKey, readonly [number, number]>> = { feelings: PICK.feel, bounds: PICK.bound, seeds: PICK.seed, stones: PICK.stone };
/** How many a list may hold, at least and at most. */
export const limitsOf = (list: ListKey): readonly [number, number] => PICK_OF[list];
/** The set a list's keys come from. */
export const setOf = (list: ListKey): WordSet => SET_OF[list];

/** The good defaults: pressing "Graj" straight away gives a whole session (one of each, a pair of words, a ready stone). */
export function freshPrep(): GardenPrep {
  return {
    v: 1, way: null, feelings: [{ k: 'smutek' }], kind: { harsh: { k: 'h1' }, kind: { k: 'k1' } }, bounds: [{ k: 'wiadomosci' }],
    intention: null, stones: [{ w: { k: 'zal-osoba' }, ready: true }], friends: [], hurt: false, seeds: [{ k: 'czulosc' }],
    name: '', before: null,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** A saved word made sound: a known key of `set`, or an own word (trimmed, ≤ OWN_LEN); null when neither. */
export function cleanWord(set: WordSet, x: unknown): Word | null {
  if (!isObj(x)) return null;
  if ('k' in x) return isWord(set, x.k) ? { k: x.k } : null;
  if ('o' in x) {
    const o = ownWord(x.o);
    return o ? { o } : null;
  }
  return null;
}

/** A word as the page shows it. */
export const wordOf = (set: WordSet, w: Word): string => ('k' in w ? wordText(set, w.k) : w.o);

/** Two words are the same when they read the same (an own "smutek" is the set's "smutek"). */
const same = (set: WordSet, a: Word, b: Word): boolean => wordOf(set, a).toLocaleLowerCase() === wordOf(set, b).toLocaleLowerCase();

function cleanList(set: WordSet, x: unknown, max: number): Word[] {
  const out: Word[] = [];
  for (const v of Array.isArray(x) ? x : []) {
    const w = cleanWord(set, v);
    if (w && !out.some(o => same(set, o, w)) && out.length < max) out.push(w);
  }
  return out;
}

function cleanNames(x: unknown): string[] {
  const out: string[] = [];
  for (const v of Array.isArray(x) ? x : []) {
    const n = ownWord(v);
    if (n && !out.some(o => o.toLocaleLowerCase() === n.toLocaleLowerCase()) && out.length < FRIENDS_MAX) out.push(n);
  }
  return out;
}

/** "How heavy" as a whole 0–10, else null. */
export function cleanBefore(x: unknown): number | null {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  const n = Math.round(x);
  return n >= 0 && n <= 10 ? n : null;
}

/** The way: known stations, once each, in the way's order; nothing left (or not a list) is the recommended way (null). */
export function cleanWay(x: unknown): StationId[] | null {
  if (!Array.isArray(x)) return null;
  const way = STATIONS.filter(s => x.includes(s));
  return way.length ? way : null;
}

const KEYS: readonly string[] = ['v', 'way', 'feelings', 'kind', 'bounds', 'intention', 'stones', 'friends', 'hurt', 'seeds', 'name', 'before'];

/**
 * A saved preparation repaired in place (the same object, when it is one): a field of the wrong type gets its fresh
 * value, unknown keys go (a letter never stays), unknown words drop out, own words and names are trimmed and cut,
 * lists keep their limits (an emptied list gets its default back), `way` keeps known stations, `before` a whole 0–10.
 */
export function cleanPrep(x: unknown): GardenPrep {
  const f = freshPrep();
  if (!isObj(x)) return f;
  const p = x;
  const feelings = cleanList('feel', p.feelings, PICK.feel[1]);
  const bounds = cleanList('bound', p.bounds, PICK.bound[1]);
  const seeds = cleanList('seed', p.seeds, PICK.seed[1]);
  const stones: Stone[] = [];
  for (const s of Array.isArray(p.stones) ? p.stones : []) {
    const w = isObj(s) ? cleanWord('stone', s.w) : null;
    if (w && !stones.some(o => same('stone', o.w, w)) && stones.length < PICK.stone[1]) stones.push({ w, ready: !(isObj(s) && s.ready === false) });
  }
  let kind = f.kind;
  if (isObj(p.kind)) {
    const k = cleanWord('kind', p.kind.kind);
    if (k) kind = { harsh: cleanWord('harsh', p.kind.harsh), kind: k };
  }
  const clean: GardenPrep = {
    v: 1,
    way: cleanWay(p.way),
    feelings: feelings.length ? feelings : f.feelings,
    kind,
    bounds: bounds.length ? bounds : f.bounds,
    intention: isWord('int', p.intention) ? p.intention : null,
    stones: stones.length ? stones : f.stones,
    friends: cleanNames(p.friends),
    hurt: p.hurt === true,
    seeds: seeds.length ? seeds : f.seeds,
    name: ownWord(p.name),
    before: cleanBefore(p.before),
  };
  for (const k of Object.keys(p)) if (!KEYS.includes(k)) delete p[k];
  return Object.assign(p, clean) as unknown as GardenPrep;
}

/** A sound copy of a preparation (the original is left as it is). */
const copyOf = (prep: GardenPrep): GardenPrep => cleanPrep(JSON.parse(JSON.stringify(prep ?? null)) as unknown);

/** The preparation as the session shows it, in the page's language (a broken one is read as its repaired copy). */
export function prepView(prep: GardenPrep): PrepView {
  const p = copyOf(prep);
  return {
    feelings: p.feelings.map(w => wordOf('feel', w)),
    harsh: p.kind.harsh ? wordOf('harsh', p.kind.harsh) : null,
    kind: wordOf('kind', p.kind.kind),
    bounds: p.bounds.map(w => wordOf('bound', w)),
    intention: p.intention ? wordText('int', p.intention) : null,
    stones: p.stones.map(s => ({ text: wordOf('stone', s.w), ready: s.ready })),
    lanterns: [
      { who: 'me', text: t('lan.me') },
      ...p.friends.map(name => ({ who: 'friend' as const, text: t('lan.friend', { name }) })),
      ...(p.hurt ? [{ who: 'hurt' as const, text: t('lan.hurt') }] : []),
      { who: 'all', text: t('lan.all') },
    ],
    seeds: p.seeds.map(w => wordOf('seed', w)),
    name: p.name || null,
    before: p.before,
  };
}

// ── the week (after a session) ──────────────────────────────────

/**
 * What a session leaves for the week (A's meta.ts keeps it as `week` after the session): the boundary when the gate
 * was walked, the friends when the lanterns were, the seeds (their words now) when the seeds were.  `walked`: the
 * stations the session walked (all of them when not given).
 */
export function weekOf(prep: GardenPrep, day: string = dayKey(), walked: readonly StationId[] = STATIONS): Week {
  const p = copyOf(prep);
  return {
    day,
    intention: walked.includes('furtka') ? p.intention : null,
    friends: walked.includes('latarnie') ? [...p.friends] : [],
    seeds: walked.includes('nasiona') ? p.seeds.map(w => wordOf('seed', w)) : [],
  };
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A saved week made sound, or null. */
export function cleanWeek(x: unknown): Week | null {
  if (!isObj(x) || typeof x.day !== 'string' || !DAY.test(x.day)) return null;
  return {
    day: x.day,
    intention: isWord('int', x.intention) ? x.intention : null,
    friends: cleanNames(x.friends),
    seeds: (Array.isArray(x.seeds) ? x.seeds : []).map(ownWord).filter(Boolean).slice(0, PICK.seed[1]),
  };
}

/** A day 'YYYY-MM-DD' as its year, month and day, or null. */
function dayParts(d: string): [number, number, number] | null {
  const m = d.match(DAY);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const dayNum = (d: string): number | null => {
  const p = dayParts(d);
  if (!p) return null;
  const v = Date.UTC(p[0], p[1] - 1, p[2]);
  return Number.isFinite(v) ? Math.round(v / 86_400_000) : null;
};

/** How many days ago the week began (null: no week or a broken day). */
export function weekAge(week: Week | null, today: string = dayKey()): number | null {
  const a = week ? dayNum(week.day) : null, b = dayNum(today);
  return a === null || b === null ? null : b - a;
}

export interface WeekLines {
  head: string;
  day: string;
  items: { kind: 'int' | 'friends' | 'seeds' | 'start'; text: string }[];
}

/** The week's card in words (null: no week, or one older than 7 days). */
export function weekLines(week: Week | null, today: string = dayKey()): WeekLines | null {
  const w = cleanWeek(week);
  const age = weekAge(w, today);
  const parts = w ? dayParts(w.day) : null;
  if (!w || !parts || age === null || age > 7 || age < -1) return null;
  const date = fmtDate(new Date(parts[0], parts[1] - 1, parts[2]), { weekday: 'long', day: 'numeric', month: 'long' });
  const items: WeekLines['items'] = [];
  if (w.intention) items.push({ kind: 'int', text: wordText('int', w.intention) });
  items.push({ kind: 'friends', text: w.friends.length ? t('wk.friends', { names: w.friends.join(', ') }) : t('wk.someone') });
  if (w.seeds.length) items.push({ kind: 'seeds', text: t('wk.seeds', { seeds: w.seeds.join(', ') }) });
  items.push({ kind: 'start', text: t('wk.start') });
  return { head: t('wk.head'), day: t('wk.day', { date }), items };
}

// ── the lobby's changes ─────────────────────────────────────────

/** What a change did: done, or why not (the list is full / at its least / the word is already there / nothing typed). */
export type Change = 'ok' | 'max' | 'min' | 'dup' | 'empty';

/** The stations the lobby shows switched on: the player's own way, else the recommended one for `sec`. */
export const wayOf = (p: GardenPrep, sec: number): StationId[] => (p.way ? [...p.way] : recommended(sec));

/** "Polecana droga" (null) or "Moja droga" (starting from the recommended way for `sec`). */
export function setWayMode(p: GardenPrep, own: boolean, sec: number): void {
  if (!own) p.way = null;
  else if (!p.way) p.way = recommended(sec);
}

/** A station's switch: the way becomes the player's own; the last station stays ('min'). */
export function toggleStation(p: GardenPrep, id: StationId, sec: number): Change {
  const way = wayOf(p, sec);
  const on = way.includes(id);
  if (on && way.length <= 1) return 'min';
  const next = on ? way.filter(s => s !== id) : [...way, id];
  p.way = STATIONS.filter(s => next.includes(s));
  return 'ok';
}

const wordsIn = (p: GardenPrep, list: ListKey): Word[] => (list === 'stones' ? p.stones.map(s => s.w) : p[list]);

/** Whether a set's word is chosen in a list. */
export const hasKey = (p: GardenPrep, list: ListKey, k: string): boolean => wordsIn(p, list).some(w => 'k' in w && w.k === k);

/** A set's word on or off in a list, within its limits. */
export function toggleKey(p: GardenPrep, list: ListKey, k: string): Change {
  const set = SET_OF[list];
  if (!isWord(set, k)) return 'empty';
  const [min, max] = PICK_OF[list];
  const words = wordsIn(p, list);
  const i = words.findIndex(w => 'k' in w && w.k === k);
  if (i >= 0) {
    if (words.length <= min) return 'min';
    removeAt(p, list, i);
    return 'ok';
  }
  if (words.some(w => same(set, w, { k }))) return 'dup';
  if (words.length >= max) return 'max';
  add(p, list, { k });
  return 'ok';
}

/** An own word added to a list (trimmed and cut), within its limits; one that reads as a set's word is that word. */
export function addOwnWord(p: GardenPrep, list: ListKey, text: string): Change {
  const o = ownWord(text);
  if (!o) return 'empty';
  const set = SET_OF[list];
  const words = wordsIn(p, list);
  if (words.some(w => same(set, w, { o }))) return 'dup';
  if (words.length >= PICK_OF[list][1]) return 'max';
  const k = WORDS[set].find(key => wordText(set, key).toLocaleLowerCase() === o.toLocaleLowerCase());
  add(p, list, k ? { k } : { o });
  return 'ok';
}

/** The i-th word of a list removed (never the last). */
export function removeWord(p: GardenPrep, list: ListKey, i: number): Change {
  const words = wordsIn(p, list);
  if (i < 0 || i >= words.length) return 'empty';
  if (words.length <= PICK_OF[list][0]) return 'min';
  removeAt(p, list, i);
  return 'ok';
}

function add(p: GardenPrep, list: ListKey, w: Word): void {
  if (list === 'stones') p.stones.push({ w, ready: true });
  else p[list].push(w);
}

function removeAt(p: GardenPrep, list: ListKey, i: number): void {
  if (list === 'stones') p.stones.splice(i, 1);
  else p[list].splice(i, 1);
}

/** A stone ready to fall today, or held ("not yet"). */
export function setReady(p: GardenPrep, i: number, ready: boolean): void {
  const s = p.stones[i];
  if (s) s.ready = ready;
}

/** The kind word: the i-th pair (0-based), with its harsh word or alone. */
export function setPair(p: GardenPrep, i: number, withHarsh: boolean): void {
  const pair = PAIRS[i];
  if (!pair) return;
  p.kind = { harsh: withHarsh ? { k: pair[0] } : null, kind: { k: pair[1] } };
}

/** The pair chosen (0-based), or -1 for own words. */
export function pairOf(p: GardenPrep): number {
  const k = p.kind.kind;
  return 'k' in k ? PAIRS.findIndex(x => x[1] === k.k) : -1;
}

/** The harsh word shown, or the kind word alone (for a set's pair; own words keep what was typed). */
export function setWithHarsh(p: GardenPrep, withHarsh: boolean): void {
  const i = pairOf(p);
  if (i >= 0) setPair(p, i, withHarsh);
}

/** Own words for the hand: the kind one is needed, the harsh one may be left empty. */
export function setOwnKind(p: GardenPrep, harsh: string, kind: string): Change {
  const k = ownWord(kind);
  if (!k) return 'empty';
  const hw = ownWord(harsh);
  p.kind = { harsh: hw ? { o: hw } : null, kind: { o: k } };
  return 'ok';
}

/** The week's boundary (a set's key) or none. */
export function setIntention(p: GardenPrep, k: string | null): void {
  p.intention = k !== null && isWord('int', k) ? k : null;
}

/** A name for a lantern (trimmed, ≤ OWN_LEN, ≤ FRIENDS_MAX, once). */
export function addFriend(p: GardenPrep, name: string): Change {
  const n = ownWord(name);
  if (!n) return 'empty';
  if (p.friends.some(f => f.toLocaleLowerCase() === n.toLocaleLowerCase())) return 'dup';
  if (p.friends.length >= FRIENDS_MAX) return 'max';
  p.friends.push(n);
  return 'ok';
}

export function removeFriend(p: GardenPrep, i: number): void {
  if (i >= 0 && i < p.friends.length) p.friends.splice(i, 1);
}

/** How the dawn calls the player (trimmed, ≤ OWN_LEN; '' for none). */
export function setName(p: GardenPrep, name: string): void {
  p.name = ownWord(name);
}

/** "How heavy" before the session, 0–10 or null. */
export function setBefore(p: GardenPrep, n: number | null): void {
  p.before = cleanBefore(n);
}

/** "Zapomnij moje słowa": every own word and name gone, the defaults back (the way and the 0–10 stay). */
export function forgetWords(p: GardenPrep): void {
  Object.assign(p, { ...freshPrep(), way: p.way, before: p.before });
}
