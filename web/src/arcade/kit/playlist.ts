/**
 * A session's music: which of the player's tracks play, and in what order — one after another, back to back, with a
 * gentle cross-fade between two, filling the session (DESIGN.md §28, superseding §21.4's whole tracks with ambient
 * bridges).  The game's own ambient music (synthesised) only opens the session for a few seconds, carries what a
 * track that cannot play leaves, and closes the last minute when no track is worth beginning there.
 *
 * The founder: "żeby ta lista układała się w wiele piosenek pod rząd (po prostu dopasować czas tych utworów tak, żeby
 * mieścił się w długości danej sesji + jakieś delikatne przejścia pomiędzy utworami)".  So the plan picks, at random,
 * a sequence whose tracks fit the session's time as closely as it can: whole tracks while one fits in the room left,
 * then either a short ambient close (≤ TAIL_MAX) or a last track that runs past the end and is faded out gently under
 * the session's close — the least of it lost; a track is never cut anywhere else.  Tracks heard lately are drawn later
 * (rotation).  When the tracks the player allows are fewer than the session holds, they come round again (never the
 * same one twice in a row while there are two).  Pure and seeded: the same inputs give the same plan.
 */

export interface Track {
  /** a stable id (a YouTube video id for YouTube tracks) */
  id: string;
  /** length in seconds */
  sec: number;
}

/** How many sessions ago each track last played (1 = the last session); absent = not lately. */
export type Recent = Record<string, number>;

export interface PlanOptions {
  /** the session's planned length (s) */
  total: number;
  /** the tracks the player allows (their order does not matter) */
  tracks: readonly Track[];
  rng: () => number;
  recent?: Recent;
  /** how many random orders to try (more: a closer fit) */
  samples?: number;
}

export interface Slot {
  id: string;
  sec: number;
  /** planned start, seconds into the session */
  at: number;
  /** seconds of it planned to be heard: the whole track, or up to the close for a last one faded under it */
  play: number;
}

export interface MusicPlan {
  /** ambient before the first track (s) */
  intro: number;
  /** the cross-fade between two tracks (s): the next begins this long before the one before ends */
  fade: number;
  /** a last track that runs past the session's end fades out over this much of the close (s) */
  closeFade: number;
  slots: Slot[];
  /** seconds of tracks planned to be heard */
  music: number;
  /** ambient after the last track has ended, to the session's end (s; 0 when the last is faded under the close) */
  tail: number;
  /** seconds of the last track left unheard: it runs past the end and is faded (0 when it ends in the session) */
  cut: number;
  /** why there are no tracks: none allowed, or the session is too short for one (a test of a minute) */
  empty: null | 'none' | 'short';
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The cross-fade between two tracks (s). */
export const FADE = 5;
/** A last track that runs past the session's end fades out over this much of the close (s). */
export const CLOSE_FADE = 10;
/** With this little left (s), no track begins: the ambient carries the close (under the blessing). */
export const TAIL_MAX = 60;
/** Tracks play only in a session of at least this long (s): a test of a minute keeps the ambient alone. */
export const MIN_SESSION = 120;
/** The ambient opening while the first track loads (s): 4 % of the session, 8–20 s. */
export const introOf = (total: number): number => Math.round(clamp(total * 0.04, 8, 20));

/** A last track's lost seconds count fully against a plan, an ambient close's seconds a little less. */
const TAIL_COST = 0.6;
/** Seconds of misfit (lost or ambient) that cut a plan's chance to 1/e. */
const MISS_SEC = 40;
/** Seconds of lately-heard music that cut a plan's chance to 1/e. */
const STALE_SEC = 120;
/** A sequence never grows longer than this (a guard: an hour of the shortest allowed track is ~180). */
const MAX_SLOTS = 240;

/** A recently heard track weighs less in the draw: last session ¼, two ago ½, three ago ¾. */
const weight = (ago: number | undefined): number => (ago === undefined || ago >= 4 ? 1 : 0.25 * Math.max(1, ago));

/** Efraimidis–Spirakis: a random order where heavier items tend to come first. */
function weightedOrder<T>(items: readonly T[], w: (x: T) => number, rng: () => number): T[] {
  return items
    .map(x => ({ x, k: Math.pow(Math.max(1e-9, rng()), 1 / Math.max(1e-6, w(x))) }))
    .sort((a, b) => b.k - a.k)
    .map(e => e.x);
}

interface Candidate { seq: Track[]; tail: number; cut: number; stale: number; cost: number }

/**
 * One sequence from one random order: tracks in the order's turn while one fits whole in the room left (each begins
 * FADE before the one before ends) — or runs past the end by little, as the last; then, with more than TAIL_MAX
 * left, a last track of those that run past the end by the least; with less, the ambient's close.  When every allowed track has played and there is room still, a new
 * order of them follows (its first never the track just heard, while there are two).
 */
function sequence(tracks: readonly Track[], total: number, intro: number, w: (t: Track) => number, rng: () => number): { seq: Track[]; tail: number; cut: number } {
  const seq: Track[] = [];
  let pool = weightedOrder(tracks, w, rng);
  let at = intro;
  for (;;) {
    const room = total - at;
    if (seq.length && room <= TAIL_MAX) return { seq, tail: Math.max(0, room - FADE), cut: 0 };
    if (!pool.length) {
      pool = weightedOrder(tracks, w, rng);
      const last = seq[seq.length - 1];
      if (pool.length > 1 && last && pool[0].id === last.id) pool.push(pool.shift()!);
    }
    if (seq.length >= MAX_SLOTS) return { seq, tail: Math.max(0, room), cut: 0 };
    // the order's next track that fits whole — or that runs past the end by little, as the last
    const i = pool.findIndex(t => t.sec <= room || t.sec - room <= 2 * MISS_SEC);
    if (i >= 0) {
      const [t] = pool.splice(i, 1);
      seq.push(t);
      if (t.sec > room) return { seq, tail: 0, cut: t.sec - room };
      // a track that ends with nothing worth beginning after it closes the music, its own ending heard whole
      if (total - (at + t.sec) <= TAIL_MAX - FADE) return { seq, tail: Math.max(0, total - (at + t.sec)), cut: 0 };
      at += t.sec - FADE;
      continue;
    }
    // none fits whole: the last one runs past the end and fades under the close — the first in the order's turn of
    // those that lose little more than the closest one (so the last place rotates too; the draw weighs the loss)
    const least = Math.min(...pool.map(t => t.sec));
    const t = pool.find(x => x.sec - least <= 2 * MISS_SEC) ?? pool[0];
    seq.push(t);
    return { seq, tail: 0, cut: at + t.sec - total };
  }
}

/**
 * The session's music.  Many random orders (recently heard tracks drawn later) each give a sequence; each distinct
 * sequence then gets a chance that shrinks with how badly it fits the session's end (a last track's lost seconds,
 * or an ambient close) and with how much of it the player heard lately — so the plan is random, fits closely, and
 * over a few sessions every track takes its turn.
 */
export function planMusic(o: PlanOptions): MusicPlan {
  const total = Math.max(0, o.total);
  const intro = introOf(total);
  const tracks = o.tracks.filter(t => t.sec > 0);
  const none = (empty: 'none' | 'short'): MusicPlan => ({ intro: total, fade: FADE, closeFade: CLOSE_FADE, slots: [], music: 0, tail: 0, cut: 0, empty });
  if (!tracks.length) return none('none');
  if (total < MIN_SESSION) return none('short');

  const recent = o.recent ?? {};
  const w = (t: Track) => weight(recent[t.id]);
  const samples = Math.max(1, o.samples ?? 240);
  const seen = new Map<string, Candidate>();
  for (let s = 0; s < samples; s++) {
    const r = sequence(tracks, total, intro, w, o.rng);
    const key = r.seq.map(t => t.id).join('|');
    if (seen.has(key)) continue;
    // how much of the music the player heard lately (seconds, weighted by how lately; a track again in the same
    // session counts once)
    const stale = [...new Set(r.seq)].reduce((a, t) => a + t.sec * (1 - w(t)), 0);
    seen.set(key, { ...r, stale, cost: r.cut + TAIL_COST * r.tail });
  }
  const cands = [...seen.values()];
  const least = Math.min(...cands.map(c => c.cost));
  const chance = cands.map(c => Math.exp(-(c.cost - least) / MISS_SEC) * Math.exp(-c.stale / STALE_SEC));
  let r = o.rng() * chance.reduce((a, b) => a + b, 0);
  let pick = cands[cands.length - 1];
  for (let i = 0; i < cands.length; i++) { r -= chance[i]; if (r <= 0) { pick = cands[i]; break; } }

  const slots: Slot[] = [];
  let at = intro;
  for (const t of pick.seq) {
    slots.push({ id: t.id, sec: t.sec, at: Math.round(at), play: Math.max(0, Math.min(t.sec, total - at)) });
    at += t.sec - FADE;
  }
  return {
    intro, fade: FADE, closeFade: CLOSE_FADE, slots,
    music: slots.reduce((a, s) => a + s.play, 0) - FADE * Math.max(0, slots.length - 1),
    tail: Math.round(pick.tail), cut: Math.round(pick.cut), empty: null,
  };
}

/** After a session: the rotation's memory, one session older, with the tracks that played now at 1. */
export function ageRecent(recent: Recent, played: readonly string[]): Recent {
  const out: Recent = {};
  for (const [id, ago] of Object.entries(recent)) if (Number.isFinite(ago) && ago + 1 < 4) out[id] = ago + 1;
  for (const id of played) out[id] = 1;
  return out;
}

/** "4:39" */
export const mmss = (sec: number): string => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** "4:39", "4.39", "279" (seconds), "4m39s", "4 min" → seconds; null when it does not read as a track's length. */
export function parseLength(s: string): number | null {
  const v = s.trim().toLowerCase().replace(/\s+/g, '');
  const ok = (sec: number): number | null => (sec >= 20 && sec <= 3 * 3600 ? sec : null);
  let m = v.match(/^(\d{1,3})[:.,](\d{1,2})$/);
  if (m) return Number(m[2]) < 60 ? ok(Number(m[1]) * 60 + Number(m[2])) : null;
  if (/^\d{1,5}$/.test(v)) return ok(Number(v));
  m = v.match(/^(?:(\d{1,3})(?:m|min))?(?:(\d{1,2})(?:s|sek|sec))?$/);
  if (m && (m[1] || m[2])) return ok(Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0));
  return null;
}
