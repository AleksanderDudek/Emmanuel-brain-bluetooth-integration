/**
 * Ogród o świcie's way (DESIGN.md §23): the seven stations a player may walk between the arrival in the night garden
 * and the dawn that always closes it, in the order of the process — feel, soothe, say, protect, let go, bless, sow.
 * Which stations a session walks: the player's own choice from the lobby (prep.ts `way`), or the recommended way for
 * the session's length; never more than the length has room for (`stationsFor`).  Pure numbers — the lead's contract
 * between the meditation (rules.ts, sim.ts: builder A) and the lobby (prep.ts, panel.ts: builder B).
 */

/** The stations, in the way's order. */
export type StationId = 'lzy' | 'dlon' | 'list' | 'furtka' | 'kamienie' | 'latarnie' | 'nasiona';

export const STATIONS: readonly StationId[] = ['lzy', 'dlon', 'list', 'furtka', 'kamienie', 'latarnie', 'nasiona'];

/**
 * What each station is (the founder's list of practices → the garden's symbol):
 *   lzy       grief meditation, emotional processing — waves of feeling on the pond; the tears gathered as light (Ps 56:8)
 *   dlon      soothing touch, self-compassion — hands of light on the heart and the belly; a kind word instead of a harsh one
 *   list      journaling, the unsent letter — the letter folded into a paper boat that sails into the dawn (never saved)
 *   furtka    boundaries, digital distance — the garden's gate closed gently "for the time of healing"; a rose over it
 *   kamienie  forgiveness, letting go — a stone in the open hand, let fall into the pond when ready ("not yet" is fine)
 *   latarnie  loving-kindness, support — lanterns lit and blessed: me, the people who hold me, (the one who hurt me), all
 *   nasiona   identity, values, creative renewal — seeds of what is mine sown in the bed, watered by the gathered tears
 * The dawn (prayer, nature, renewal; Jn 20:15-16 — called by name in the garden) is not a choice: it closes every way.
 */
export const STATION_NOTE: Readonly<Record<StationId, string>> = {
  lzy: 'grief', dlon: 'soothing', list: 'letter', furtka: 'boundaries', kamienie: 'forgiveness', latarnie: 'blessing', nasiona: 'seeds',
};

/** The session's frame (s): the arrival, the dawn with its close, and the least a station takes. */
export const TIMING = {
  arrive: { share: 0.06, min: 20, max: 60 },
  dawn: { share: 0.14, min: 30, max: 110 },
  stationMin: 40,
  /** a test session (app:smoke plays 40 s): at most this long */
  testSec: 60,
} as const;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** The arrival's and the dawn's seconds in a session of `sec` (a test session: shares only). */
export function frameOf(sec: number): { arrive: number; dawn: number } {
  const T = Math.max(10, sec);
  if (T <= TIMING.testSec) return { arrive: T * 0.1, dawn: T * 0.2 };
  return {
    arrive: clamp(T * TIMING.arrive.share, TIMING.arrive.min, TIMING.arrive.max),
    dawn: clamp(T * TIMING.dawn.share, TIMING.dawn.min, TIMING.dawn.max),
  };
}

/** How many stations a session of `sec` has room for (at least one). */
export function stationRoom(sec: number): number {
  if (sec <= TIMING.testSec) return 1;
  const f = frameOf(sec);
  return Math.max(1, Math.floor((sec - f.arrive - f.dawn) / TIMING.stationMin));
}

/** The recommended way for a session's length: a little at 3 minutes, the whole way from 15. */
export function recommended(sec: number): StationId[] {
  if (sec <= 240) return ['lzy', 'dlon'];
  if (sec <= 420) return ['lzy', 'dlon', 'list'];
  if (sec <= 780) return ['lzy', 'dlon', 'list', 'kamienie', 'latarnie'];
  return [...STATIONS];
}

/** Which stations stay when a chosen way is longer than the session has room for: the heart of the process first. */
const KEEP: readonly StationId[] = ['lzy', 'dlon', 'list', 'latarnie', 'kamienie', 'nasiona', 'furtka'];

/**
 * The stations a session of `sec` walks, in the way's order: the player's `chosen` way (unknown ids and repeats
 * dropped; empty or null → the recommended way), trimmed to the room the length has — keeping first what `KEEP` puts
 * first.  A test session walks one station.
 */
export function stationsFor(sec: number, chosen: readonly string[] | null | undefined): StationId[] {
  const valid = (chosen ?? []).filter((s, i, a): s is StationId => (STATIONS as readonly string[]).includes(s) && a.indexOf(s) === i);
  const want = valid.length ? valid : recommended(sec);
  const room = stationRoom(sec);
  if (want.length <= room) return STATIONS.filter(s => want.includes(s));
  const kept = KEEP.filter(s => want.includes(s)).slice(0, room);
  return STATIONS.filter(s => kept.includes(s));
}
