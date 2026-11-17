/**
 * What Rzeki żywej wody remembers between sessions, and the pure rules of its meta game:
 *
 *   the map         which of the four maps the way walks (all 17 stations by default; the twelve of picture 2;
 *                   picture 1's subtle system; the seven with the hands and the feet)
 *   the way         down, up, or down and then up (the lobby's card chooses; both by default)
 *   where it goes on  the station the last session stopped at, the way it was going and the light it had gathered
 *                   there (`pos`): the next session continues from it; the card can start from the top or from any
 *                   station of the album ("Zacznij tutaj")
 *   own words       the player's own words of prayer (≤ 120 characters, plain text), shown at every station instead
 *                   of the built-in prayer; kept only in this device's progress
 *   the map of light  how many times each station was lit going down and thanked going up — the figure in the
 *                   lobby shows the stations lit across sessions, the album shows each one's glass
 *   records         the best drops per session length, the whole ways down and up, the longest calm abiding in one
 *                   stretch, all the drops and the abiding seconds ever
 *   the chorale     the quiet chorale in the background, on or off
 *   the breath      the rest's breath: four phases of 0–15 s each (in, hold, out, hold empty; kit/breath.ts), 4 · 6
 *                   by default, and how many whole breaths a rest lasts (0: as many as come nearest 26 s)
 *
 * Version 3 (2026-11-17, round 11: the breath pattern and the rest's breaths).  A version-2 save keeps everything
 * and gets the default breath; a version-1 save (seven places) keeps everything too: its places' counts move to the
 * stations they became (content.ts `V1_PLACES`).  The placeholder's save keeps its count; any field of a wrong type
 * is reset rather than trusted.  No DOM, no randomness.
 */
import { BREATH_DEFAULT, breathOk, breathRest, breathRestOf, cleanBreath, stepBreath, type BreathPattern, type BreathPhase } from '../kit/breath';
import { MAP, MAPS, STATIONS, V1_PLACES, WAYS, cleanOwn, legs, route, windowTier, type Dir, type MapId, type StationId, type Tier, type Way } from './content';
import { RULES } from './rules';

/** Where the way goes on: a map's route going `dir`, its `idx`-th station, the light gathered there. */
export interface RzekiPos { map: MapId; dir: Dir; idx: number; fill: number }

export interface RzekiProgress {
  ver: 3;
  /** sessions saved */
  sessions: number;
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  /** the map the way walks, and the way */
  map: MapId;
  way: Way;
  /** where the next session goes on (null: from the top of the map) */
  pos: RzekiPos | null;
  /** the player's own words ('' = the prayer of each station) */
  own: string;
  /** each station: times lit going down, and thanked going up */
  down: Record<StationId, number>;
  up: Record<StationId, number>;
  /** whole ways walked, all time */
  descents: number;
  ascents: number;
  /** the best drops per session length (s) */
  best: Record<string, number>;
  /** all the drops ever gathered */
  drops: number;
  /** the longest calm abiding in one stretch (s), and all the abiding seconds ever */
  abideBest: number;
  abideAll: number;
  /** the quiet chorale in the background */
  song: boolean;
  /** first-time explanations and story cards already given */
  seen: string[];
  /** the last session's planned length (s) */
  lastLen: number;
  /** the rest's breath: four phases, each 0…15 whole seconds */
  breath: BreathPattern;
  /** whole breaths in each rest (1…12), or 0: as many as come nearest RULES.restTarget s */
  restBreaths: number;
}

const zeros = (): Record<StationId, number> => Object.fromEntries(STATIONS.map(s => [s, 0])) as Record<StationId, number>;

export function freshProgress(): RzekiProgress {
  return {
    ver: 3, sessions: 0, pushes: 0, map: 'all', way: 'both', pos: null, own: '', down: zeros(), up: zeros(), descents: 0, ascents: 0,
    best: {}, drops: 0, abideBest: 0, abideAll: 0, song: true, seen: [], lastLen: 0, breath: { ...BREATH_DEFAULT }, restBreaths: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = 0): number => Math.max(lo, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Version 2's counts: one per station. */
function counts(v: unknown): Record<StationId, number> {
  const out = zeros();
  if (isObj(v)) for (const s of STATIONS) out[s] = int(v[s]);
  return out;
}

/** A version-1 save's counts (seven places) moved onto the stations they became. */
function countsV1(v: unknown): Record<StationId, number> {
  const out = zeros();
  if (isObj(v)) for (const [old, s] of Object.entries(V1_PLACES)) out[s] += int(v[old]);
  return out;
}

/** A saved position, checked against the map's route (null when it does not hold). */
export function cleanPos(v: unknown): RzekiPos | null {
  if (!isObj(v)) return null;
  const map = (MAPS as readonly unknown[]).includes(v.map) ? (v.map as MapId) : null;
  const dir = v.dir === 'down' || v.dir === 'up' ? v.dir : null;
  if (!map || !dir) return null;
  const idx = int(v.idx, -1, -1);
  if (idx < 0 || idx >= MAP[map].stations.length) return null;
  const fill = Math.max(0, Math.min(0.99, num(v.fill)));
  return { map, dir, idx, fill };
}

/** A saved count of breaths for a rest: 0 (auto) or 1…12. */
const breaths = (v: unknown): number => Math.max(0, Math.min(RULES.restBreathsMax, Math.round(num(v))));

/**
 * Bring a loaded save to version 3, in place (idempotent).  A version-2 save keeps everything and gets the default
 * breath; a version-1 save moves its seven places' counts onto the stations they became and keeps everything else;
 * the placeholder's save and anything older or broken keep their session count; every field of a wrong type is
 * repaired (the breath through the kit's `cleanBreath`).
 */
export function migrate(p: RzekiProgress): RzekiProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (raw.ver !== 1 && raw.ver !== 2 && raw.ver !== 3) {
    const keep = { sessions: int(raw.sessions), pushes: int(raw.pushes) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, keep);
    return p;
  }
  const v1 = raw.ver === 1;
  const fields: RzekiProgress = {
    ver: 3,
    sessions: int(raw.sessions),
    pushes: int(raw.pushes),
    map: !v1 && (MAPS as readonly unknown[]).includes(raw.map) ? (raw.map as MapId) : f.map,
    way: (WAYS as readonly unknown[]).includes(raw.way) ? (raw.way as Way) : f.way,
    pos: v1 ? null : cleanPos(raw.pos),
    own: cleanOwn(raw.own),
    down: v1 ? countsV1(raw.down) : counts(raw.down),
    up: v1 ? countsV1(raw.up) : counts(raw.up),
    descents: int(raw.descents),
    ascents: int(raw.ascents),
    best: {},
    drops: int(raw.drops),
    abideBest: Math.max(0, num(raw.abideBest)),
    abideAll: Math.max(0, num(raw.abideAll)),
    song: typeof raw.song === 'boolean' ? raw.song : f.song,
    seen: Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))] : [],
    lastLen: int(raw.lastLen),
    breath: { ...cleanBreath(raw.breath) },
    restBreaths: breaths(raw.restBreaths),
  };
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) fields.best[k] = Math.floor(num(v));
  for (const k of Object.keys(raw)) delete raw[k];
  Object.assign(p, fields);
  return p;
}

/** The best drops of any session length (null: never played). */
export function bestOf(p: RzekiProgress): number | null {
  const vals = Object.values(p.best).filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

/** The record key for a planned length: sessions are compared with sessions of the same length. */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec / 30) * 30);

/** How many times a station was lit (both ways together). */
export const timesLit = (p: RzekiProgress, s: StationId): number => (p.down[s] ?? 0) + (p.up[s] ?? 0);

/** The craft of a station's window from the times it was lit (0 plain … 3 golden tracery). */
export const tierOf = (p: RzekiProgress, s: StationId): Tier => windowTier(timesLit(p, s));

/** How many stations of a list (a map's, or all) were ever lit. */
export const stationsLit = (p: RzekiProgress, list: readonly StationId[] = STATIONS): number => list.reduce((n, s) => n + (timesLit(p, s) > 0 ? 1 : 0), 0);

/** A station's glow on the lobby's figure (0 never lit … 1 lit often): it grows with the times, softly. */
export const mapGlow = (p: RzekiProgress, s: StationId): number => {
  const n = timesLit(p, s);
  return n <= 0 ? 0 : Math.min(1, 0.35 + 0.65 * (1 - Math.exp(-n / 6)));
};

/** Count a station lit on a way (the session's tally reaches the progress once, at its end). */
export function countStation(p: RzekiProgress, s: StationId, dir: Dir, n = 1): void {
  const rec = dir === 'down' ? p.down : p.up;
  rec[s] = (rec[s] ?? 0) + Math.max(0, Math.floor(n));
}

/** Choose the way (the lobby's card); false for an unknown value. */
export function setWay(p: RzekiProgress, way: unknown): boolean {
  if (!(WAYS as readonly unknown[]).includes(way)) return false;
  p.way = way as Way;
  return true;
}

/** Choose the map (the lobby's card); false for an unknown value.  Where the way goes on is kept: `startOf` reads it in the new map. */
export function setMap(p: RzekiProgress, map: unknown): boolean {
  if (!(MAPS as readonly unknown[]).includes(map)) return false;
  p.map = map as MapId;
  return true;
}

/** Keep the player's own words (cleaned: plain text, ≤ 120 characters; '' goes back to the prayer). */
export function setOwn(p: RzekiProgress, words: unknown): string {
  p.own = cleanOwn(words);
  return p.own;
}

/** "Zacznij tutaj": the next session starts at this station of the current map, on the way's first direction. */
export function setStart(p: RzekiProgress, s: StationId): boolean {
  const dir = legs(p.way)[0];
  const idx = route(p.map, dir).indexOf(s);
  if (idx < 0) return false;
  p.pos = { map: p.map, dir, idx, fill: 0 };
  return true;
}

/** "Od początku": the next session starts from the top of the map (the way's first station). */
export function clearStart(p: RzekiProgress): void {
  p.pos = null;
}

/**
 * Where the next session starts, read in the current map and way: the saved station (and the light gathered
 * there) when the map has it — on the saved direction when the way still walks it, else on the way's first —
 * otherwise the top of the way.  `leg` is the direction's place in the way (both: 0 down, 1 up).
 */
export function startOf(p: RzekiProgress): { leg: number; dir: Dir; idx: number; fill: number; station: StationId; resumed: boolean } {
  const ls = legs(p.way);
  const top = { leg: 0, dir: ls[0], idx: 0, fill: 0, station: route(p.map, ls[0])[0], resumed: false };
  const pos = p.pos;
  if (!pos) return top;
  const station = route(pos.map, pos.dir)[pos.idx];
  if (!station) return top;
  const leg = Math.max(0, ls.indexOf(pos.dir));
  const dir = ls[leg];
  const idx = route(p.map, dir).indexOf(station);
  if (idx < 0) return top;
  return { leg, dir, idx, fill: pos.fill, station, resumed: idx > 0 || pos.fill > 0 || leg > 0 };
}

/** Remember a first-time thing; true when it was new. */
export function markSeen(p: RzekiProgress, what: string): boolean {
  if (p.seen.includes(what)) return false;
  p.seen.push(what);
  return true;
}

// ── the breath ────────────────────────────────────────────────────

/** The rest's breath as saved (cleaned: each phase 0…15 s, a cycle of at least 2 s). */
export const breathOf = (p: RzekiProgress): BreathPattern => cleanBreath(p.breath);

/**
 * A rest of whole breaths for the saved pattern: the player's own count, or (0) as many as come nearest
 * RULES.restTarget seconds and at least RULES.restMin (4 · 6: 3 breaths, 30 s).
 */
export function restOf(p: RzekiProgress): { cycles: number; sec: number } {
  const b = breathOf(p);
  return p.restBreaths > 0 ? breathRestOf(b, p.restBreaths) : breathRest(b, RULES.restTarget, RULES.restMin);
}

/** The count a rest would have on "auto" (the lobby shows it beside the stepper). */
export const autoBreaths = (p: RzekiProgress): number => breathRest(breathOf(p), RULES.restTarget, RULES.restMin).cycles;

/**
 * Move one phase of the breath by `delta` seconds (the lobby's −/+): false — and nothing changes — when the
 * pattern would guide nothing (a whole cycle under 2 s).
 */
export function stepBreathOf(p: RzekiProgress, phase: BreathPhase, delta: number): boolean {
  const next = stepBreath(breathOf(p), phase, delta);
  if (!breathOk(next)) return false;
  p.breath = { ...next };
  return true;
}

/** Take a whole pattern (a preset); false for one that guides nothing. */
export function setBreath(p: RzekiProgress, b: BreathPattern): boolean {
  if (!breathOk(b)) return false;
  p.breath = { ...cleanBreath(b) };
  return true;
}

/** Whole breaths in a rest: 1…12, or 0 for "auto". */
export function setRestBreaths(p: RzekiProgress, n: number): void {
  p.restBreaths = breaths(n);
}
