/**
 * A session's music: which of the player's tracks play, in what order, and where the ambient music
 * (the game's own, synthesised) carries the rest — at the start, between two tracks, and at the end.
 *
 * Tracks are whole pieces: a song is never cut to fit (DESIGN.md §21.4).  The plan picks, at random,
 * a set that fills the session well, preferring tracks the player has not heard lately (rotation);
 * the ambient music takes whatever time is left over, spread over the intro, the bridges and the close.
 * Pure and seeded: the same inputs give the same plan.
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
  /** how many random orders to try (more: a fuller fit) */
  samples?: number;
}

export interface Slot { id: string; sec: number; /** planned start, seconds into the session */ at: number }

export interface MusicPlan {
  /** ambient before the first track (s) */
  intro: number;
  /** ambient between two tracks (s) */
  gap: number;
  /** the least ambient after the last track (s): the close is never a song cut short */
  outro: number;
  slots: Slot[];
  /** seconds of tracks */
  music: number;
  /** why there are no tracks: none allowed, or none fits in the session */
  empty: null | 'none' | 'short';
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** How steeply a fuller set is preferred (its share of the best fill, to this power). */
const FILL_STEEP = 6;
/** Seconds of lately-heard music that cut a set's chance to 1/e. */
const STALE_SEC = 120;

/** The least ambient around the tracks for a session of `total` seconds: [intro, gap, outro]. */
export function frame(total: number): [number, number, number] {
  return [
    Math.round(clamp(total * 0.07, 20, 60)),
    Math.round(clamp(total * 0.025, 15, 25)),
    Math.round(clamp(total * 0.1, 30, 90)),
  ];
}

/** The longest single track that fits in a session of `total` seconds. */
export const longestFit = (total: number): number => { const [i, , o] = frame(total); return Math.max(0, total - i - o); };

/** A recently heard track weighs less in the draw: last session ¼, two ago ½, three ago ¾. */
const weight = (ago: number | undefined): number => (ago === undefined || ago >= 4 ? 1 : 0.25 * Math.max(1, ago));

/** Efraimidis–Spirakis: a random order where heavier items tend to come first. */
function weightedOrder<T>(items: readonly T[], w: (x: T) => number, rng: () => number): T[] {
  return items
    .map(x => ({ x, k: Math.pow(Math.max(1e-9, rng()), 1 / Math.max(1e-6, w(x))) }))
    .sort((a, b) => b.k - a.k)
    .map(e => e.x);
}

interface Candidate { picked: Track[]; fill: number; stale: number }

/**
 * The session's music.  Many random orders (recently heard tracks drawn later) are packed greedily; each
 * distinct set of tracks then gets a chance that grows steeply with how well it fills the session and
 * shrinks with how much of it the player heard lately — so the plan is random, fits well, and over a few
 * sessions every track that fits takes its turn (a pure "fullest fit" would leave the same chant out).
 */
export function planMusic(o: PlanOptions): MusicPlan {
  const total = Math.max(0, o.total);
  const [intro0, gap0, outro0] = frame(total);
  const tracks = o.tracks.filter(t => t.sec > 0);
  const room = total - intro0 - outro0;
  const none = (empty: 'none' | 'short'): MusicPlan => ({ intro: total, gap: gap0, outro: 0, slots: [], music: 0, empty });
  if (!tracks.length) return none('none');
  if (!tracks.some(t => t.sec <= room)) return none('short');

  const recent = o.recent ?? {};
  const samples = Math.max(1, o.samples ?? 240);
  const sets = new Map<string, Candidate>();
  let bestFill = 0;
  for (let s = 0; s < samples; s++) {
    const order = weightedOrder(tracks, t => weight(recent[t.id]), o.rng);
    const picked: Track[] = [];
    let used = 0;
    for (const t of order) {
      const need = t.sec + (picked.length ? gap0 : 0);
      if (used + need <= room) { picked.push(t); used += need; }
    }
    const key = picked.map(t => t.id).sort().join('|');
    if (sets.has(key)) continue;
    // how much of the music the player heard lately (seconds, weighted by how lately)
    const stale = picked.reduce((a, t) => a + t.sec * (1 - weight(recent[t.id])), 0);
    sets.set(key, { picked, fill: used, stale });
    bestFill = Math.max(bestFill, used);
  }
  const cands = [...sets.values()];
  const chance = cands.map(c => Math.pow(c.fill / bestFill, FILL_STEEP) * Math.exp(-c.stale / STALE_SEC));
  let r = o.rng() * chance.reduce((a, b) => a + b, 0);
  let pick = cands[cands.length - 1];
  for (let i = 0; i < cands.length; i++) { r -= chance[i]; if (r <= 0) { pick = cands[i]; break; } }

  // the leftover goes to the ambient: the bridges grow a little, the intro and the close take the rest
  const n = pick.picked.length;
  let left = room - pick.fill;
  const gap = n > 1 ? gap0 + Math.max(0, Math.min((left * 0.3) / (n - 1), 45 - gap0)) : gap0;
  left -= (gap - gap0) * Math.max(0, n - 1);
  const intro = intro0 + left * 0.4;
  const outro = outro0 + left * 0.6;
  const slots: Slot[] = [];
  let at = intro;
  for (const t of pick.picked) { slots.push({ id: t.id, sec: t.sec, at: Math.round(at) }); at += t.sec + gap; }
  return {
    intro: Math.round(intro), gap: Math.round(gap), outro: Math.round(outro), slots,
    music: pick.picked.reduce((a, t) => a + t.sec, 0), empty: null,
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
