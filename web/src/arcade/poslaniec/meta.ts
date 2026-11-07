/**
 * What Posłaniec remembers between sessions (version 2) and the pure rules of its meta game:
 *
 *   the road to the seven churches   metres add up across sessions; Ephesus is where the letters set
 *                                    out, each next city a leg further, a second journey after Laodicea
 *   the drachmas                     in hand (they buy the upgrades) and all ever
 *   the upgrades                     satchel, sandals, seal and wings: each level lengthens them
 *   the missions                     sets of three; a set done raises the permanent score multiplier
 *   the day's word                   letters on the road spell it; done once a day, a streak of days
 *   records                          the best session score, the best run, the longest run
 *
 * An old save (version 1, metres as the headline) is migrated in place on first use: the record and
 * the sessions are kept (the old record in metres becomes the longest run and the score's floor),
 * the road and the drachmas carry over, everything else starts fresh.  No DOM.
 */
import { IN_ONE_RUN, UP_IDS, missionSet, upPrice, type Mission, type UpId } from './content';
import { CITY_IDS } from './content';
import { RULES } from './rules';

export interface PoslaniecProgress {
  ver: 2;
  /** sessions saved, runs begun (all time) */
  sessions: number;
  runs: number;
  /** metres run, all time: the road to the churches */
  metres: number;
  /** drachmas in hand, and all ever gathered */
  drachmas: number;
  drachmasAll: number;
  /** upgrade levels (0…RULES.upMax) */
  ups: Record<UpId, number>;
  /** mission sets done (the multiplier is 1 + this) and the open set's counts */
  sets: number;
  mprog: number[];
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  /** records: the best session's score, the best run's score, the longest run (m) */
  best: number;
  bestRun: number;
  bestMetres: number;
  /** all-time tallies for the card */
  flights: number;
  fires: number;
  stations: number;
  /** the day's word: the day, letters gathered that day, done; the streak of days done */
  wordDay: string;
  wordGot: number;
  wordDone: boolean;
  wordStreak: number;
  wordLast: string;
  /** what the coach marks have explained already (controls, power-ups, the wings, the towers) */
  taught: string[];
}

const freshUps = (): Record<UpId, number> => Object.fromEntries(UP_IDS.map(id => [id, 0])) as Record<UpId, number>;

export function freshProgress(): PoslaniecProgress {
  return {
    ver: 2, sessions: 0, runs: 0, metres: 0, drachmas: 0, drachmasAll: 0, ups: freshUps(), sets: 0, mprog: [0, 0, 0],
    pushes: 0, best: 0, bestRun: 0, bestMetres: 0, flights: 0, fires: 0, stations: 0,
    wordDay: '', wordGot: 0, wordDone: false, wordStreak: 0, wordLast: '', taught: [],
  };
}

const num = (v: unknown, def = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const int = (v: unknown, def = 0): number => Math.max(0, Math.floor(num(v, def)));
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Bring a loaded save to version 2, in place (it was merged over fresh defaults, so fields of the old
 * version may sit beside the new ones, with other types).  Idempotent; never throws.
 */
export function migrate(p: PoslaniecProgress): PoslaniecProgress {
  const raw = p as unknown as Record<string, unknown>;
  // an old save merged over fresh defaults carries `ver: 2` from them, so tell it by its own fields
  if (raw.ver !== 2 || raw.v !== undefined || (raw.best !== null && typeof raw.best === 'object')) {
    // version 1: `best` was a record of metres per session length
    const old = raw.best;
    const oldBest = old && typeof old === 'object' ? Math.max(0, ...Object.values(old as Record<string, unknown>).map(v => num(v))) : num(old);
    const keep = { sessions: int(raw.sessions), metres: int(raw.metres), drachmas: int(raw.drachmas), pushes: int(raw.pushes) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(raw, freshProgress(), keep, {
      drachmasAll: keep.drachmas, best: Math.round(oldBest), bestMetres: Math.round(oldBest),
    });
    return p;
  }
  // version 2: make every field the right type (a hand-edited or damaged save never crashes the game)
  const f = freshProgress();
  for (const k of ['sessions', 'runs', 'metres', 'drachmas', 'drachmasAll', 'sets', 'pushes', 'best', 'bestRun', 'bestMetres', 'flights', 'fires', 'stations', 'wordGot', 'wordStreak'] as const) {
    (raw as Record<string, number>)[k] = int(raw[k], f[k]);
  }
  for (const k of ['wordDay', 'wordLast'] as const) (raw as Record<string, string>)[k] = str(raw[k]);
  raw.wordDone = raw.wordDone === true;
  const ups = raw.ups && typeof raw.ups === 'object' ? raw.ups as Record<string, unknown> : {};
  p.ups = Object.fromEntries(UP_IDS.map(id => [id, Math.min(RULES.upMax, int(ups[id]))])) as Record<UpId, number>;
  const mp = Array.isArray(raw.mprog) ? raw.mprog : [];
  p.mprog = [0, 1, 2].map(i => int(mp[i]));
  p.taught = Array.isArray(raw.taught) ? (raw.taught as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  return p;
}

// ── the road to the seven churches ───────────────────────────────
/** One journey's length: Ephesus to Laodicea (m). */
export const LAP = RULES.legs.reduce((s, l) => s + l, 0);

export interface RouteAt {
  /** the journey (1 = the first) */
  lap: number;
  /** the last city reached (0 = Ephesus) and the next */
  city: number;
  next: number;
  /** metres into the leg toward `next`, and the leg's length */
  into: number;
  leg: number;
}

/** Where `metres` (all time) put the messenger on the road. */
export function routeAt(metres: number): RouteAt {
  const m = Math.max(0, Math.floor(metres));
  const lap = Math.floor(m / LAP) + 1;
  let rest = m % LAP;
  let city = 0;
  for (const leg of RULES.legs) {
    if (rest < leg) return { lap, city, next: city + 1, into: rest, leg };
    rest -= leg;
    city++;
  }
  return { lap, city: 0, next: 1, into: 0, leg: RULES.legs[0] };
}

/** The cities reached between two totals, in order; Laodicea (6) closes a journey. */
export function citiesBetween(from: number, to: number): { lap: number; city: number }[] {
  const out: { lap: number; city: number }[] = [];
  if (to <= from) return out;
  const marks: number[] = [];
  let acc = 0;
  for (const leg of RULES.legs) marks.push((acc += leg));
  for (let lap = Math.floor(Math.max(0, from) / LAP); lap * LAP < to; lap++) {
    marks.forEach((mk, i) => {
      const at = lap * LAP + mk;
      if (at > from && at <= to) out.push({ lap: lap + 1, city: i + 1 });
    });
  }
  return out;
}

/** The postcards owned: every city reached on any journey (Ephesus from the start). */
export function postcards(metres: number): boolean[] {
  const r = routeAt(metres);
  return CITY_IDS.map((_, i) => r.lap > 1 || i <= r.city);
}

// ── the multiplier and the missions ──────────────────────────────
/** The permanent score multiplier: 1 + the sets done, up to RULES.multMax. */
export const multOf = (p: PoslaniecProgress): number => Math.min(RULES.multMax, 1 + p.sets);

/** The open set. */
export const openSet = (p: PoslaniecProgress): Mission[] => missionSet(p.sets);

/** Is mission i of the open set done? */
export const missionDone = (p: PoslaniecProgress, i: number): boolean => (p.mprog[i] ?? 0) >= openSet(p)[i].target;

/**
 * Count `n` toward every open mission of `kind` (`value` mode for the in-one-run kinds: the run's
 * current figure, kept as the best).  Returns the indices that became done now.  When all three are
 * done the set closes: the multiplier rises and the next set opens (`setDone` true).
 */
export function countMission(p: PoslaniecProgress, kind: Mission['kind'], n: number): { done: number[]; setDone: boolean } {
  const set = openSet(p);
  const done: number[] = [];
  set.forEach((m, i) => {
    if (m.kind !== kind) return;
    const before = p.mprog[i] ?? 0;
    if (before >= m.target) return;
    const after = IN_ONE_RUN.has(kind) ? Math.max(before, Math.floor(n)) : before + n;
    p.mprog[i] = Math.min(m.target, after);
    if (p.mprog[i] >= m.target) done.push(i);
  });
  if (set.every((m, i) => (p.mprog[i] ?? 0) >= m.target)) {
    p.sets++;
    p.mprog = [0, 0, 0];
    return { done, setDone: true };
  }
  return { done, setDone: false };
}

// ── upgrades ─────────────────────────────────────────────────────
/** Seconds a power-up lasts at an upgrade level. */
export const powerSecFor = (level: number): number => RULES.powerSec + RULES.powerStep * Math.max(0, level);
/** The flight's stretch at a wings level (s). */
export const flightSecFor = (level: number): number => RULES.flightSec + Math.max(0, level);

/** Buy the next level of `id` if the drachmas in hand allow; true when bought. */
export function buyUp(p: PoslaniecProgress, id: UpId): boolean {
  const price = upPrice(p.ups[id] ?? 0);
  if (price === null || p.drachmas < price) return false;
  p.drachmas -= price;
  p.ups[id] = (p.ups[id] ?? 0) + 1;
  return true;
}

// ── the day's word ───────────────────────────────────────────────
/** Start the day's hunt over on a new day (the streak breaks only when a day was missed). */
export function wordToday(p: PoslaniecProgress, day: string): void {
  if (p.wordDay === day) return;
  p.wordDay = day;
  p.wordGot = 0;
  p.wordDone = false;
}

/** The day before "YYYY-MM-DD". */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** The word was completed today: the streak grows (a missed day starts it over). */
export function wordComplete(p: PoslaniecProgress, day: string): void {
  if (p.wordDone && p.wordDay === day) return;
  p.wordDone = true;
  p.wordStreak = p.wordLast === dayBefore(day) ? p.wordStreak + 1 : 1;
  p.wordLast = day;
}
