/**
 * What Brzemiona remembers between sessions, and the pure rules of its meta game:
 *
 *   the list        whom the player prays for: up to 12 entries — names (what they carry optional), "ja" (only when
 *                   the player puts themselves on it), kinds of burden, the whole world — kept only in this
 *                   device's progress (DESIGN §18.3 "names stay home"); empty: the six kinds and the world
 *   where it goes on  the next entry of the list (`next`) and a burden in progress (`pos`: its key, its circle and
 *                   the light turned there), so the next session continues with it
 *   the way         (round 16) "Moje brzemiona" (`own`, a fresh progress's) or "Za innych" (`others`, the
 *                   intercession — a round-15 save that played keeps it)
 *   my list         the own way's topics: up to 12 short phrases the player named or picked from the suggestions
 *                   (topics.ts), kept only here; empty: four gentle defaults (i18n `own.def.*`); where it goes on
 *                   (`own.next`, `own.pos`), as the intercession's list
 *   light only      the variant without smoke: only light flows from the Cross to them
 *   the breath      four phases of 0–15 s (kit/breath.ts), 5 · 5 by default (§18.4), and the breaths of a rest
 *   the counts      burdens carried in all, each kind's, the whole world reached, the most in one session per
 *                   length, the longest calm in a rest
 *
 * Version 2 (round 16: the way, the own list, `given`).  A version-1 save is round 15's: it keeps "Za innych" when it
 * played or kept a list (the way it played), else it starts "Moje brzemiona".  The placeholder's save (`{ best: null }`)
 * and anything broken become a fresh progress keeping only a session count; every field of a wrong type is repaired.
 * (Loading merges a save over fresh defaults, so the version — not a missing field — tells a round-15 save.)  No DOM,
 * no randomness.
 */
import { BREATH_PRESETS, breathOk, breathRest, breathRestOf, cleanBreath, stepBreath, type BreathPattern, type BreathPhase } from '../kit/breath';
import { DEFAULT_LIST, KINDS, LIST_MAX, cleanItem, cleanList, cleanName, cleanTopic, itemKey, topicItem, topicKey, type Item, type KindId, type Way } from './content';
import { RULES, restTargetFor } from './rules';

/** A burden in progress: its entry's key, its circle and the light turned there. */
export interface BrzPos { key: string; circle: number; x: number }

/** What the counts are kept by: each kind, a person, the player, the world. */
export type Tally = KindId | 'person' | 'me' | 'world';
export const TALLIES: readonly Tally[] = [...KINDS, 'person', 'me', 'world'];

/** The own way's list and where it goes on (as the intercession's `list`, `next`, `pos`). */
export interface OwnList {
  list: string[];
  next: number;
  pos: BrzPos | null;
}

export interface BrzProgress {
  ver: 2;
  sessions: number;
  pushes: number;
  /** the way the next session plays */
  way: Way;
  /** "Moje brzemiona": the player's topics */
  own: OwnList;
  /** "Za innych": whom the player prays for */
  list: Item[];
  /** the index of the next entry of the list (the default list when it is empty) */
  next: number;
  pos: BrzPos | null;
  lightOnly: boolean;
  breath: BreathPattern;
  /** whole breaths in each rest (1…12), or 0: as many as come nearest the session's rest length */
  restBreaths: number;
  /** burdens carried to the Cross, all time, and by what they were (the intercession) */
  carried: number;
  /** the player's own burdens given at the Cross, all time (the own way) */
  given: number;
  tally: Record<Tally, number>;
  /** circles widened to the whole world and turned, all time */
  worlds: number;
  /** the most burdens carried in one session, per session length (s) */
  best: Record<string, number>;
  /** the longest peace held in one stretch of a rest (s), all the seconds of it */
  calmBest: number;
  calmAll: number;
  seen: string[];
  lastLen: number;
}

const zeroTally = (): Record<Tally, number> => Object.fromEntries(TALLIES.map(k => [k, 0])) as Record<Tally, number>;

export function freshProgress(): BrzProgress {
  return {
    ver: 2, sessions: 0, pushes: 0, way: 'own', own: { list: [], next: 0, pos: null },
    list: [], next: 0, pos: null, lightOnly: false, breath: { ...BREATH_PRESETS.even }, restBreaths: 0,
    carried: 0, given: 0, tally: zeroTally(), worlds: 0, best: {}, calmBest: 0, calmAll: 0, seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = 0): number => Math.max(lo, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function cleanPos(v: unknown): BrzPos | null {
  if (!isObj(v) || typeof v.key !== 'string' || !v.key) return null;
  return { key: v.key.slice(0, 64), circle: Math.max(0, Math.min(2, int(v.circle))), x: Math.max(0, Math.min(0.99, num(v.x))) };
}

/** The own list from anything saved: clean topics, none twice (whatever the case), at most LIST_MAX. */
export function cleanTopics(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const keys = new Set<string>();
  for (const x of v) {
    const s = cleanTopic(x);
    if (!s || keys.has(topicKey(s))) continue;
    keys.add(topicKey(s));
    out.push(s);
    if (out.length >= LIST_MAX) break;
  }
  return out;
}

function cleanOwn(v: unknown): OwnList {
  const o = isObj(v) ? v : {};
  const list = cleanTopics(o.list);
  const pos = cleanPos(o.pos);
  return { list, next: list.length ? int(o.next) % list.length : 0, pos: pos && pos.key.startsWith('t:') ? { ...pos, circle: Math.min(1, pos.circle) } : null };
}

/**
 * Bring a loaded save to version 2, in place (idempotent); the placeholder's or a broken save keeps its session count.
 * A version-1 save (round 15) keeps the intercession when it played or kept a list.
 */
export function migrate(p: BrzProgress): BrzProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (raw.ver !== 1 && raw.ver !== 2) {
    const keep = { sessions: int(raw.sessions), pushes: int(raw.pushes) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, keep);
    return p;
  }
  const tally = zeroTally();
  if (isObj(raw.tally)) for (const k of TALLIES) tally[k] = int(raw.tally[k]);
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (/^\d+$/.test(k) && num(v, -1) >= 0) best[k] = int(v);
  const list = cleanList(raw.list);
  const way: Way = raw.ver === 1 ? (int(raw.sessions) > 0 || list.length ? 'others' : 'own') : raw.way === 'others' ? 'others' : 'own';
  const fields: BrzProgress = {
    ver: 2,
    sessions: int(raw.sessions),
    pushes: int(raw.pushes),
    way,
    own: raw.ver === 1 ? { list: [], next: 0, pos: null } : cleanOwn(raw.own),
    list,
    next: int(raw.next),
    pos: cleanPos(raw.pos),
    lightOnly: raw.lightOnly === true,
    breath: cleanBreath(raw.breath),
    restBreaths: Math.max(0, Math.min(RULES.restBreathsMax, Math.round(num(raw.restBreaths)))),
    carried: int(raw.carried),
    given: int(raw.given),
    tally,
    worlds: int(raw.worlds),
    best,
    calmBest: Math.max(0, num(raw.calmBest)),
    calmAll: Math.max(0, num(raw.calmAll)),
    seen: Array.isArray(raw.seen) ? raw.seen.filter((s): s is string => typeof s === 'string').slice(0, 200) : [],
    lastLen: int(raw.lastLen),
  };
  for (const k of Object.keys(raw)) delete raw[k];
  Object.assign(p, fields);
  return p;
}

/** Mark a one-time thing as seen; true the first time. */
export function markSeen(p: BrzProgress, key: string): boolean {
  if (p.seen.includes(key)) return false;
  p.seen.push(key);
  return true;
}

/** The list the intercession walks: the player's, or the six kinds and the world when they saved none. */
export const queueOf = (p: BrzProgress): readonly Item[] => (p.list.length ? p.list : DEFAULT_LIST);

/**
 * The list the own way walks, as items: the player's topics, or `defaults` (four gentle topics in this language,
 * i18n `ownDefaults()`) when they named none.
 */
export const ownQueueOf = (p: BrzProgress, defaults: readonly string[]): readonly Item[] =>
  (p.own.list.length ? p.own.list : defaults).map(topicItem);

/** The queue of a way. */
export const wayQueue = (p: BrzProgress, way: Way, defaults: readonly string[]): readonly Item[] => (way === 'own' ? ownQueueOf(p, defaults) : queueOf(p));
/** The most burdens carried in one session (any length), or null before any session. */
export function bestOf(p: BrzProgress): number | null {
  const v = Object.values(p.best);
  return p.sessions > 0 ? (v.length ? Math.max(...v) : 0) : null;
}

/** The key the best is kept under: the session's planned length in seconds. */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The breath (repaired). */
export const breathOf = (p: BrzProgress): BreathPattern => cleanBreath(p.breath);

/** The rest after a circle for a session of `plannedSec`: the player's own count of breaths, or the auto one. */
export function restOf(p: BrzProgress, plannedSec: number, extra = 0): { cycles: number; sec: number } {
  const b = breathOf(p);
  const base = p.restBreaths > 0 ? breathRestOf(b, p.restBreaths) : breathRest(b, restTargetFor(plannedSec), RULES.restMin);
  return extra > 0 ? breathRestOf(b, base.cycles + extra) : base;
}

/** The auto count of breaths in a rest for a session of `plannedSec`. */
export const autoBreaths = (p: BrzProgress, plannedSec: number): number => breathRest(breathOf(p), restTargetFor(plannedSec), RULES.restMin).cycles;

export function setBreath(p: BrzProgress, b: BreathPattern): boolean {
  if (!breathOk(b)) return false;
  p.breath = { ...b };
  return true;
}

/** One phase stepped by `d` s; false (nothing changed) when the breath would be under 2 s. */
export function stepBreathOf(p: BrzProgress, phase: BreathPhase, d: number): boolean {
  const n = stepBreath(breathOf(p), phase, d);
  if (!breathOk(n)) return false;
  p.breath = n;
  return true;
}

export function setRestBreaths(p: BrzProgress, n: number): void {
  p.restBreaths = Math.max(0, Math.min(RULES.restBreathsMax, Math.round(n)));
}

// ── the list ─────────────────────────────────────────────────────
/** Add an entry (a person by name, the player, a kind, the world); false when full, empty or already there. */
export function addItem(p: BrzProgress, it: Item): boolean {
  const c = cleanItem(it);
  if (!c || p.list.length >= LIST_MAX || p.list.some(x => itemKey(x) === itemKey(c))) return false;
  p.list.push(c);
  return true;
}

/** Add a person by name (what they carry optional). */
export const addPerson = (p: BrzProgress, name: string, kind: KindId | null = null): boolean =>
  addItem(p, { who: 'person', name: cleanName(name), kind });

export function removeItem(p: BrzProgress, i: number): boolean {
  if (i < 0 || i >= p.list.length) return false;
  const [gone] = p.list.splice(i, 1);
  if (p.pos && p.pos.key === itemKey(gone)) p.pos = null;
  if (p.next > i) p.next--;
  if (p.next >= p.list.length) p.next = 0;
  return true;
}

/** Move an entry up (−1) or down (+1). */
export function moveItem(p: BrzProgress, i: number, d: -1 | 1): boolean {
  const j = i + d;
  if (i < 0 || j < 0 || i >= p.list.length || j >= p.list.length) return false;
  [p.list[i], p.list[j]] = [p.list[j], p.list[i]];
  return true;
}

/** Set what a person (or the player) carries. */
export function setKind(p: BrzProgress, i: number, kind: KindId | null): boolean {
  const it = p.list[i];
  if (!it || it.who === 'kind' || it.who === 'world') return false;
  it.kind = kind;
  return true;
}

/** Where the next session begins: the burden in progress (when its entry is still on the list), else the next entry. */
export function startOf(p: BrzProgress): { index: number; circle: number; x: number; resumed: boolean } {
  return startIn(queueOf(p), p.pos, p.next);
}

/** Where the own way's next session begins (the same rule on the own list). */
export function ownStartOf(p: BrzProgress, defaults: readonly string[]): { index: number; circle: number; x: number; resumed: boolean } {
  return startIn(ownQueueOf(p, defaults), p.own.pos, p.own.next);
}

function startIn(q: readonly Item[], pos: BrzPos | null, next: number): { index: number; circle: number; x: number; resumed: boolean } {
  if (pos) {
    const i = q.findIndex(it => itemKey(it) === pos.key);
    if (i >= 0) return { index: i, circle: pos.circle, x: pos.x, resumed: true };
  }
  return { index: q.length ? next % q.length : 0, circle: 0, x: 0, resumed: false };
}

/** Begin the next session from this entry (the card's "Zacznij od…"). */
export function setStart(p: BrzProgress, i: number): boolean {
  const q = queueOf(p);
  if (i < 0 || i >= q.length) return false;
  p.next = i;
  if (p.pos && p.pos.key !== itemKey(q[i])) p.pos = null;
  return true;
}

// ── the own list ─────────────────────────────────────────────────
/** Add a topic of the player's (typed or a suggestion); false when full, empty or already there (whatever the case). */
export function addTopic(p: BrzProgress, topic: string): boolean {
  const s = cleanTopic(topic);
  const L = p.own.list;
  if (!s || L.length >= LIST_MAX || L.some(x => topicKey(x) === topicKey(s))) return false;
  L.push(s);
  return true;
}

/**
 * A set of topics (a theme's, a stronghold's): `add` puts those not there yet at the end while there is room; `replace`
 * makes them the list (the list starts again from its first).  Returns how many were added.
 */
export function addTopics(p: BrzProgress, topics: readonly string[], mode: 'add' | 'replace'): number {
  if (mode === 'replace') {
    const keep = cleanTopics(topics);
    if (!keep.length) return 0;
    p.own.list = keep;
    p.own.next = 0;
    p.own.pos = null;
    return keep.length;
  }
  let n = 0;
  for (const s of topics) if (addTopic(p, s)) n++;
  return n;
}

/** How many of these topics `add` would put on the list now (the card's "Dodaj (3)"). */
export function topicsToAdd(p: BrzProgress, topics: readonly string[]): number {
  const have = new Set(p.own.list.map(topicKey));
  let n = 0;
  for (const s of topics) {
    const k = topicKey(s);
    if (!k || have.has(k) || p.own.list.length + n >= LIST_MAX) continue;
    have.add(k);
    n++;
  }
  return n;
}

export const hasTopic = (p: BrzProgress, topic: string): boolean => p.own.list.some(x => topicKey(x) === topicKey(topic));

export function removeTopic(p: BrzProgress, i: number): boolean {
  const o = p.own;
  if (i < 0 || i >= o.list.length) return false;
  const [gone] = o.list.splice(i, 1);
  if (o.pos && o.pos.key === itemKey(topicItem(gone))) o.pos = null;
  if (o.next > i) o.next--;
  if (o.next >= o.list.length) o.next = 0;
  return true;
}

/** Move a topic up (−1) or down (+1); where the list goes on follows the topic it pointed at. */
export function moveTopic(p: BrzProgress, i: number, d: -1 | 1): boolean {
  const o = p.own, j = i + d;
  if (i < 0 || j < 0 || i >= o.list.length || j >= o.list.length) return false;
  [o.list[i], o.list[j]] = [o.list[j], o.list[i]];
  if (o.next === i) o.next = j;
  else if (o.next === j) o.next = i;
  return true;
}

/** Begin the next own session from this topic (the card's "zacznij od tego"). */
export function setOwnStart(p: BrzProgress, i: number, defaults: readonly string[]): boolean {
  const q = ownQueueOf(p, defaults);
  if (i < 0 || i >= q.length) return false;
  p.own.next = i;
  if (p.own.pos && p.own.pos.key !== itemKey(q[i])) p.own.pos = null;
  return true;
}

/** The way the next session plays. */
export function setWay(p: BrzProgress, way: Way): boolean {
  if (way !== 'own' && way !== 'others') return false;
  p.way = way;
  return true;
}

/** The count kept for an item (a kind by its kind, a person and the player as such, the world). */
export function tallyOf(it: Item): Tally {
  if (it.who === 'kind' && it.kind) return it.kind;
  if (it.who === 'world') return 'world';
  return it.who === 'me' ? 'me' : 'person';
}
