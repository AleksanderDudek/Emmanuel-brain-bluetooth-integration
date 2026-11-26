/**
 * What Złota passa remembers between sessions (DESIGN.md §26), and the pure rules of its meta:
 *
 *   records      the most wins in one session, wins in all, the longest run of wins in a session, trust in all,
 *                moments met, sessions
 *   the habit    the day-streak (rules.ts `streakAfter`: days in a row with a session, one missed day forgiven at most
 *                once a week — "His mercies are new every morning", Lam 3:22-23)
 *   my day       the player's own moments ("Mój dzień": a line, its kind, optionally their own win; ≤ 8) — own words
 *                only in this progress, on this device, never in a session's result; they come first, in turn
 *   the hard     "Także to, co trudne": off by default; only with it on does a heavy moment come (≤ 1 a day)
 *   carried      the set moments a session carried (focus did not turn them) — a few come back next time
 *
 * Anything broken becomes a fresh progress keeping only a session count; every field of a wrong type is repaired, never
 * trusted; text is cleaned (no control characters, one line, a length limit).  No DOM, no randomness.
 */
import type { MomentKind } from './moments';
import { RULES, cleanDay, streakAfter, type Streak } from './rules';
import { HEAVIES, setById } from './content';

export const KINDS: readonly MomentKind[] = ['joy', 'snag', 'heavy'];

/** One of the player's own moments: what happened, its kind, and their own win ('' none: the game offers some). */
export interface OwnMoment { id: string; text: string; kind: MomentKind; win: string }

export interface PassaProgress {
  ver: 1;
  sessions: number;
  /** the most wins in one session */
  best: number;
  /** all time: wins, the longest run in a session, wins of trust, moments met */
  wins: number;
  bestRun: number;
  trusts: number;
  moments: number;
  /** the day-streak */
  streak: Streak;
  /** "Mój dzień": the player's own moments, and the one that comes first next time (they come in turn) */
  own: OwnMoment[];
  ownNext: number;
  /** "Także to, co trudne": a heavy moment may come */
  hard: boolean;
  /** set moments carried last time (they may come back), the heavy set's turn, set moments played lately */
  carried: string[];
  heavyNext: number;
  recent: string[];
  /** first-time explanations given */
  seen: string[];
  /** the last session's length (s): the lobby's guess before the length buttons are read */
  lastLen: number;
}

export const freshStreak = (): Streak => ({ days: 0, last: '', grace: '', best: 0 });

export function freshProgress(): PassaProgress {
  return {
    ver: 1, sessions: 0, best: 0, wins: 0, bestRun: 0, trusts: 0, moments: 0, streak: freshStreak(), own: [], ownNext: 0,
    hard: false, carried: [], heavyNext: 0, recent: [], seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0): number => Math.max(0, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * A line the player typed, made safe to keep and show: a string, control and format characters and markup brackets
 * gone, one line of single spaces, at most `max` characters (whole code points).
 */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, max).join('').trim();
}

const OWN_ID = /^o\d{1,4}$/;

/** The next free own id ('o1', 'o2', …). */
function freeId(used: ReadonlySet<string>): string {
  for (let k = 1; ; k++) if (!used.has(`o${k}`)) return `o${k}`;
}

function cleanOwn(v: unknown): OwnMoment[] {
  if (!Array.isArray(v)) return [];
  const out: OwnMoment[] = [];
  const used = new Set<string>();
  for (const x of v) {
    if (out.length >= RULES.ownMax) break;
    if (!isObj(x)) continue;
    const text = cleanText(x.text, RULES.ownLen);
    if (!text) continue;
    const kind = (KINDS as readonly unknown[]).includes(x.kind) ? (x.kind as MomentKind) : 'joy';
    const id = typeof x.id === 'string' && OWN_ID.test(x.id) && !used.has(x.id) ? x.id : freeId(used);
    used.add(id);
    out.push({ id, text, kind, win: cleanText(x.win, RULES.winLen) });
  }
  return out;
}

function cleanStreak(v: unknown): Streak {
  if (!isObj(v)) return freshStreak();
  const last = cleanDay(v.last);
  const days = last ? int(v.days) : 0;
  return { days, last: days > 0 ? last : '', grace: cleanDay(v.grace), best: Math.max(int(v.best), days) };
}

/** Set moment ids from a saved list: known ones only, no repeats, at most `max`. */
function cleanIds(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((s): s is string => typeof s === 'string' && !!setById(s)))].slice(-max);
}

/** Bring a loaded save to version 1, in place (idempotent): every field repaired; a broken save keeps its session count. */
export function migrate(p: PassaProgress): PassaProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (!isObj(raw) || raw.ver !== 1) {
    const sessions = isObj(raw) ? int(raw.sessions) : 0;
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, { sessions });
    return p;
  }
  const clean: PassaProgress = {
    ver: 1,
    sessions: int(raw.sessions),
    best: int(raw.best),
    wins: int(raw.wins),
    bestRun: int(raw.bestRun),
    trusts: int(raw.trusts),
    moments: int(raw.moments),
    streak: cleanStreak(raw.streak),
    own: cleanOwn(raw.own),
    ownNext: int(raw.ownNext),
    hard: raw.hard === true,
    carried: cleanIds(raw.carried, RULES.carryKeep),
    heavyNext: int(raw.heavyNext) % HEAVIES.length,
    recent: cleanIds(raw.recent, RULES.recentMax),
    seen: Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string').map(s => s.slice(0, 40)))].slice(0, 40) : [],
    lastLen: int(raw.lastLen),
  };
  clean.wins = Math.max(clean.wins, clean.best);
  clean.moments = Math.max(clean.moments, clean.wins);
  clean.bestRun = Math.min(clean.bestRun, clean.best);
  clean.trusts = Math.min(clean.trusts, clean.wins);
  clean.ownNext = clean.own.length ? clean.ownNext % clean.own.length : 0;
  // only the known fields stay (anything else a save carries is dropped)
  for (const k of Object.keys(raw)) delete raw[k];
  Object.assign(p, clean);
  return p;
}

/** The best so far (null: never played). */
export const bestOf = (p: PassaProgress): number | null => (p.sessions > 0 ? p.best : null);

/** What a change to "Mój dzień" did. */
export type Change = 'ok' | 'empty' | 'max' | 'dup' | 'none';

/** Add an own moment (a line, its kind, optionally their own win). */
export function addOwn(p: PassaProgress, text: unknown, kind: unknown, win: unknown = ''): Change {
  const s = cleanText(text, RULES.ownLen);
  if (!s) return 'empty';
  if (p.own.length >= RULES.ownMax) return 'max';
  if (p.own.some(o => o.text.toLowerCase() === s.toLowerCase())) return 'dup';
  const k = (KINDS as readonly unknown[]).includes(kind) ? (kind as MomentKind) : 'joy';
  p.own.push({ id: freeId(new Set(p.own.map(o => o.id))), text: s, kind: k, win: cleanText(win, RULES.winLen) });
  return 'ok';
}

/** Change an own moment's line, kind or win (an empty line leaves the line as it was). */
export function editOwn(p: PassaProgress, id: string, patch: { text?: unknown; kind?: unknown; win?: unknown }): Change {
  const o = p.own.find(x => x.id === id);
  if (!o) return 'none';
  if (patch.text !== undefined) {
    const s = cleanText(patch.text, RULES.ownLen);
    if (!s) return 'empty';
    if (p.own.some(x => x !== o && x.text.toLowerCase() === s.toLowerCase())) return 'dup';
    o.text = s;
  }
  if (patch.kind !== undefined && (KINDS as readonly unknown[]).includes(patch.kind)) o.kind = patch.kind as MomentKind;
  if (patch.win !== undefined) o.win = cleanText(patch.win, RULES.winLen);
  return 'ok';
}

export function removeOwn(p: PassaProgress, id: string): Change {
  const i = p.own.findIndex(x => x.id === id);
  if (i < 0) return 'none';
  p.own.splice(i, 1);
  p.ownNext = p.own.length ? p.ownNext % p.own.length : 0;
  return 'ok';
}

/** "Zapomnij moje słowa": every own moment gone from this device. */
export function forgetOwn(p: PassaProgress): void {
  p.own.length = 0;
  p.ownNext = 0;
}

export function setHard(p: PassaProgress, on: unknown): boolean {
  if (typeof on !== 'boolean') return false;
  p.hard = on;
  return true;
}

/** The streak after today's session (into the progress). */
export function creditDay(p: PassaProgress, day: string): void {
  p.streak = streakAfter(p.streak, day);
}
