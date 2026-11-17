/**
 * What Światło ciała remembers between sessions (version 2, round 11), and the pure rules of its meta game:
 *
 *   the choice    the meditation chosen (narzady, miesnie, mozg, konczyny, rownowaga)
 *   the places    where each meditation goes on: its element and the light gathered there ("Kontynuuj")
 *   the album     how many times each element was lit by focus; how many times each meditation was walked whole
 *   records       the most lux per session length, all the lux ever, whether a real pulse was ever seen
 *   the music     the lullaby in the background, on or off
 *
 * A version-1 save (the nine loops) keeps its sessions, pushes, records, the song and what was already explained;
 * its body map becomes Równowaga's album (an organ lit at n depths counts as lit n times, so its next fact card is
 * one level deeper).  Any field of a wrong type is repaired rather than trusted.  No DOM, no randomness.
 */
import { ALL_IDS, LISTS, LOOPS, VARIANTS, count, type VariantId } from './content';

export interface Place { idx: number; fill: number }

export interface SwiatloProgress {
  ver: 2;
  sessions: number;
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  variant: VariantId;
  pos: Record<VariantId, Place>;
  /** element id → times lit by focus */
  lit: Record<string, number>;
  /** meditation → times walked whole */
  whole: Record<VariantId, number>;
  /** the most lux per session length (s), and all the lux ever */
  best: Record<string, number>;
  luxAll: number;
  pulseSeen: boolean;
  song: boolean;
  /** first-time explanations and story cards already given */
  seen: string[];
  lastLen: number;
}

const zeroPlaces = (): Record<VariantId, Place> => Object.fromEntries(VARIANTS.map(v => [v, { idx: 0, fill: 0 }])) as Record<VariantId, Place>;
const zeroWhole = (): Record<VariantId, number> => Object.fromEntries(VARIANTS.map(v => [v, 0])) as Record<VariantId, number>;

export function freshProgress(): SwiatloProgress {
  return {
    ver: 2, sessions: 0, pushes: 0, variant: 'narzady', pos: zeroPlaces(), lit: {}, whole: zeroWhole(), best: {}, luxAll: 0,
    pulseSeen: false, song: true, seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = 0): number => Math.max(lo, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const IDS = new Set(ALL_IDS);
const isVariant = (v: unknown): v is VariantId => (VARIANTS as readonly unknown[]).includes(v);

/** A saved place, repaired: an element inside the meditation, a fill in 0..1 (a full one starts again at 0). */
export function cleanPlace(v: unknown, variant: VariantId): Place {
  if (!isObj(v)) return { idx: 0, fill: 0 };
  const idx = Math.min(count(variant) - 1, int(v.idx));
  const fill = Math.max(0, Math.min(1, num(v.fill)));
  return { idx, fill: fill >= 1 ? 0 : fill };
}

function records(raw: unknown): Record<string, number> {
  const best: Record<string, number> = {};
  if (isObj(raw)) for (const [k, v] of Object.entries(raw)) if (num(v) > 0) best[k] = Math.floor(num(v));
  return best;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string'))] : []);

/** Bring a loaded save to version 2, in place (idempotent). */
export function migrate(p: SwiatloProgress): SwiatloProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (raw.ver !== 2) {
    // version 1 (the nine loops) or the placeholder's save: keep what still means something
    const v1 = raw.ver === 1;
    const lit: Record<string, number> = {};
    if (v1 && isObj(raw.map)) {
      for (const id of LOOPS) {
        const n = [1, 2, 3].filter(d => num((raw.map as Record<string, unknown>)[`${id}:${d}`]) > 0).length;
        if (n > 0) lit[`r.${id}`] = n;
      }
    }
    const keep: Partial<SwiatloProgress> = {
      sessions: int(raw.sessions), pushes: int(raw.pushes), lit,
      best: v1 ? records(raw.best) : {}, pulseSeen: raw.pulseSeen === true,
      song: typeof raw.song === 'boolean' ? raw.song : true,
      seen: v1 ? strings(raw.seen) : [],
    };
    if (v1 && int(raw.scans) > 0) keep.whole = { ...zeroWhole(), rownowaga: int(raw.scans) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, keep);
    return p;
  }
  p.sessions = int(raw.sessions);
  p.pushes = int(raw.pushes);
  p.variant = isVariant(raw.variant) ? raw.variant : f.variant;
  const pos = zeroPlaces();
  if (isObj(raw.pos)) for (const v of VARIANTS) pos[v] = cleanPlace(raw.pos[v], v);
  p.pos = pos;
  const lit: Record<string, number> = {};
  if (isObj(raw.lit)) for (const [k, v] of Object.entries(raw.lit)) if (IDS.has(k) && int(v) > 0) lit[k] = int(v);
  p.lit = lit;
  const whole = zeroWhole();
  if (isObj(raw.whole)) for (const v of VARIANTS) whole[v] = int(raw.whole[v]);
  p.whole = whole;
  p.best = records(raw.best);
  p.luxAll = int(raw.luxAll);
  p.pulseSeen = raw.pulseSeen === true;
  p.song = typeof raw.song === 'boolean' ? raw.song : f.song;
  p.seen = strings(raw.seen);
  p.lastLen = int(raw.lastLen);
  p.ver = 2;
  return p;
}

/** The best lux of any session length (null: never played). */
export function bestOf(p: SwiatloProgress): number | null {
  const vals = Object.values(p.best).filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

/** The record key for a planned length: sessions are compared with sessions of the same length. */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec / 30) * 30);

/** How many of a meditation's elements were ever lit by focus. */
export const litIn = (p: SwiatloProgress, v: VariantId): number => LISTS[v].reduce((n, e) => n + ((p.lit[e.id] ?? 0) > 0 ? 1 : 0), 0);

/** Choose a meditation (the lobby's card, the picker); false for an unknown one. */
export function choose(p: SwiatloProgress, v: unknown): boolean {
  if (!isVariant(v)) return false;
  p.variant = v;
  return true;
}

/** "Od początku": the chosen meditation starts again at its first element. */
export function restart(p: SwiatloProgress, v: VariantId = p.variant): void {
  p.pos[v] = { idx: 0, fill: 0 };
}

/** "Zacznij tutaj": the meditation starts at this element next time (it keeps the light gathered there if it is its place already). */
export function startAt(p: SwiatloProgress, v: VariantId, idx: number): boolean {
  if (!isVariant(v) || !Number.isFinite(idx) || idx < 0 || idx >= count(v)) return false;
  p.variant = v;
  if (p.pos[v].idx !== Math.floor(idx)) p.pos[v] = { idx: Math.floor(idx), fill: 0 };
  return true;
}

/** Remember a first-time thing; true when it was new. */
export function markSeen(p: SwiatloProgress, what: string): boolean {
  if (p.seen.includes(what)) return false;
  p.seen.push(what);
  return true;
}
