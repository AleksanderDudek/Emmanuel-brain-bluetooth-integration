/**
 * What Stop-klatka remembers between sessions (DESIGN.md §28), and the pure rules of its meta:
 *
 *   the group      the age group the stories are told for, and whether the player chose it (a first session asks on
 *                  its opening card when the lobby was not touched)
 *   the heavy      "Także trudniejsze sytuacje": off by default; only with it on does a heavy story come
 *   where next     for each group, the story the next session begins with (they are told in turn; kept by id, so a
 *                  story added later does not shift the place)
 *   records        moments mastered (freezes charged) in all and the most in one session, stories told, clarity held
 *   the pace       focus-seconds a sighted second the player gives in a freeze, learned up to each charge (§24.4b)
 *   named          the feelings the player named by a tap, and how often (no words of their own: the game has none)
 *
 * Anything broken becomes a fresh progress keeping only a session count; every field of a wrong type is repaired, never
 * trusted.  No DOM, no randomness.  The age group is shared on this device (kit/ages.ts, round 25): a fresh progress
 * takes the device's choice (made here or in Złota passa), and a choice made here is saved for every game.
 */
import { loadAge, saveAge } from '../kit/ages';
import { RULES, cleanPace } from './rules';
import { AGES, FEELINGS, type Age, type Feeling } from './story';
import { storyById } from './stories';

export interface StopProgress {
  ver: 1;
  sessions: number;
  age: Age;
  ageSet: boolean;
  heavy: boolean;
  /** per group: the id of the story the next session begins with ('' the first) */
  next: Record<Age, string>;
  /** freezes charged in all, the most in one session, stories told in all, clarity held in all (s) */
  mastered: number;
  best: number;
  told: number;
  held: number;
  /** the learned pace (0: none yet) */
  pace: number;
  /** feelings named by the player's own tap */
  named: Record<Feeling, number>;
  /** first-time explanations given */
  seen: string[];
  /** the last session's length (s): the lobby's guess before the length buttons are read */
  lastLen: number;
}

/** The group a session tells when none was ever chosen (a test, or the first card left without a tap). */
export const DEFAULT_AGE: Age = 'adult';

const freshNext = (): Record<Age, string> => ({ teen: '', young: '', adult: '', mid: '', senior: '' });
const freshNamed = (): Record<Feeling, number> => Object.fromEntries(FEELINGS.map(f => [f, 0])) as Record<Feeling, number>;

function blank(): StopProgress {
  return {
    ver: 1, sessions: 0, age: DEFAULT_AGE, ageSet: false, heavy: false, next: freshNext(), mastered: 0, best: 0, told: 0, held: 0,
    pace: 0, named: freshNamed(), seen: [], lastLen: 0,
  };
}

/** A new player's progress: the device's age group when one was chosen (here or in another game), else none yet. */
export function freshProgress(): StopProgress {
  const p = blank();
  const a = loadAge();
  if (a) {
    p.age = a;
    p.ageSet = true;
  }
  return p;
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0): number => Math.max(0, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const isAge = (v: unknown): v is Age => typeof v === 'string' && (AGES as readonly string[]).includes(v);

/** Bring a loaded save to version 1, in place (idempotent): every field repaired; a broken save keeps its session count. */
export function migrate(p: StopProgress): StopProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = blank();
  if (!isObj(raw) || raw.ver !== 1) {
    const sessions = isObj(raw) ? int(raw.sessions) : 0;
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, { sessions });
    return p;
  }
  const next = freshNext();
  if (isObj(raw.next)) {
    for (const a of AGES) {
      const id = raw.next[a];
      const s = typeof id === 'string' ? storyById(id) : null;
      next[a] = s && s.age === a ? s.id : '';
    }
  }
  const named = freshNamed();
  if (isObj(raw.named)) for (const k of FEELINGS) named[k] = int(raw.named[k]);
  const clean: StopProgress = {
    ver: 1,
    sessions: int(raw.sessions),
    age: isAge(raw.age) ? raw.age : DEFAULT_AGE,
    ageSet: raw.ageSet === true && isAge(raw.age),
    heavy: raw.heavy === true,
    next,
    mastered: int(raw.mastered),
    best: int(raw.best),
    told: int(raw.told),
    held: Math.max(0, num(raw.held)),
    pace: cleanPace(raw.pace),
    named,
    seen: Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string').map(s => s.slice(0, 40)))].slice(0, 40) : [],
    lastLen: int(raw.lastLen),
  };
  clean.mastered = Math.max(clean.mastered, clean.best);
  clean.told = Math.max(clean.told, clean.mastered);
  // only the known fields stay (anything else a save carries is dropped)
  for (const k of Object.keys(raw)) delete raw[k];
  Object.assign(p, clean);
  return p;
}

/** The best so far (null: never played). */
export const bestOf = (p: StopProgress): number | null => (p.sessions > 0 ? p.best : null);

/** The player picks a group (the lobby's chips or the first card): it is theirs from now on. */
export function setAge(p: StopProgress, a: unknown): boolean {
  if (!isAge(a)) return false;
  p.age = a;
  p.ageSet = true;
  saveAge(a);
  return true;
}

export function setHeavy(p: StopProgress, on: unknown): boolean {
  if (typeof on !== 'boolean') return false;
  p.heavy = on;
  return true;
}

/** The feelings named most often (by a tap), most first, at most `n`. */
export function topNamed(p: StopProgress, n = 3): Feeling[] {
  return FEELINGS.filter(f => p.named[f] > 0).sort((a, b) => p.named[b] - p.named[a] || FEELINGS.indexOf(a) - FEELINGS.indexOf(b)).slice(0, n);
}

/** Where a session begins in `order` for the player's group: after the last story told (the first when none). */
export function startIn(p: StopProgress, order: readonly { id: string }[], age: Age = p.age): number {
  const id = p.next[age];
  const i = id ? order.findIndex(s => s.id === id) : -1;
  return i >= 0 ? i : 0;
}

/** The pace after a session that measured `sec` sighted seconds giving `focusSec` focus-seconds. */
export function paceAfter(old: number, focusSec: number, sec: number): number {
  if (!(sec >= RULES.paceMinSec) || !(focusSec >= 0)) return cleanPace(old);
  const now = cleanPace(Math.max(RULES.paceMin, focusSec / sec));
  const was = cleanPace(old);
  return was ? cleanPace(was * (1 - RULES.paceKeep) + now * RULES.paceKeep) : now;
}
