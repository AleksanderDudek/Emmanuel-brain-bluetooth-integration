/**
 * What Światło w dłoniach remembers between sessions (DESIGN.md §18), on this device only, and the pure rules of its
 * small meta game:
 *
 *   names      up to 12 people the player prays for, each with an optional sore place (then a hand is laid there)
 *   selfPlace  where the hand rests in a prayer for oneself (the chest unless the player chose another place)
 *   walk       where the next prayer begins in the walk: the names (or "someone dear" when there are none) → oneself
 *              → the world, round again
 *   carry      a prayer the last session left unfinished: the ball's growth (and the rise, if it was being offered)
 *   breath     the breath of the hands: 5 in · 5 out (even, the default) or 4 in · 6 out (calm)
 *   tallies    prayers offered for others, for oneself, for the world; flames ever; the most flames per length
 *
 * Any field of a wrong type is repaired rather than trusted.  No DOM, no randomness.
 */
import { BREATH_PRESETS, type BreathPattern } from '../kit/breath';
import { isPlace, type HurtPlace, type Tally, type Who } from './content';
import { RULES } from './rules';

export interface PrayName { name: string; place: HurtPlace | null }
export type BreathId = 'even' | 'calm';
export const BREATHS: readonly BreathId[] = ['even', 'calm'];

export interface DlonieProgress {
  ver: 1;
  sessions: number;
  /** ball pushes begun, all time: every 3rd is blind from the 3rd session */
  balls: number;
  names: PrayName[];
  selfPlace: HurtPlace;
  walk: number;
  carry: { grow: number; rise: number } | null;
  breath: BreathId;
  offered: Record<Tally, number>;
  /** every prayer offered, all time (the rests' passages go round with it) */
  prayers: number;
  best: Record<string, number>;
  flamesAll: number;
  seen: string[];
  lastLen: number;
}

export function freshProgress(): DlonieProgress {
  return {
    ver: 1, sessions: 0, balls: 0, names: [], selfPlace: 'chest', walk: 0, carry: null, breath: 'even',
    offered: { others: 0, self: 0, world: 0 }, prayers: 0, best: {}, flamesAll: 0, seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0): number => Math.max(0, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** A name as kept: plain text, one line, at most `nameLen` characters, no surrounding space. */
export function cleanName(v: unknown): string {
  if (typeof v !== 'string') return '';
  const plain = [...v].map(ch => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 || ch === '<' || ch === '>' ? ' ' : ch)).join('');
  const one = plain.replace(/\s+/g, ' ').trim();
  return [...one].slice(0, RULES.nameLen).join('').trim();
}

/** Bring a loaded save into shape, in place (idempotent). */
export function migrate(p: DlonieProgress): DlonieProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (raw.ver !== 1) {
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f);
    return p;
  }
  p.sessions = int(raw.sessions);
  p.balls = int(raw.balls);
  const names: PrayName[] = [];
  if (Array.isArray(raw.names)) {
    for (const n of raw.names) {
      if (!isObj(n)) continue;
      const name = cleanName(n.name);
      if (name && names.length < RULES.namesMax) names.push({ name, place: isPlace(n.place) ? n.place : null });
    }
  }
  p.names = names;
  p.selfPlace = isPlace(raw.selfPlace) ? raw.selfPlace : f.selfPlace;
  p.walk = int(raw.walk) % walkOf(p).length;
  const c = raw.carry;
  p.carry = isObj(c) && (num(c.grow) > 0 || num(c.rise) > 0) ? { grow: clamp01(num(c.grow)), rise: clamp01(num(c.rise)) } : null;
  if (p.carry && p.carry.rise > 0) p.carry.grow = 1;
  if (p.carry && p.carry.rise >= 1) p.carry = null;
  p.breath = (BREATHS as readonly unknown[]).includes(raw.breath) ? raw.breath as BreathId : f.breath;
  const o = isObj(raw.offered) ? raw.offered : {};
  p.offered = { others: int(o.others), self: int(o.self), world: int(o.world) };
  p.prayers = int(raw.prayers);
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) best[k] = Math.floor(num(v));
  p.best = best;
  p.flamesAll = int(raw.flamesAll);
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))] : [];
  p.lastLen = int(raw.lastLen);
  p.ver = 1;
  return p;
}

/** The walk of a prayer after prayer: the names (or someone dear), oneself, the world. */
export function walkOf(p: Pick<DlonieProgress, 'names'>): Who[] {
  const people: Who[] = p.names.length ? p.names.map((_, i) => ({ kind: 'name' as const, i })) : [{ kind: 'dear', i: 0 }];
  return [...people, { kind: 'self', i: 0 }, { kind: 'world', i: 0 }];
}

/** The place a hand is laid on for this prayer, or null when the prayer is lifted up. */
export function placeOf(p: Pick<DlonieProgress, 'names' | 'selfPlace'>, who: Who): HurtPlace | null {
  if (who.kind === 'self') return p.selfPlace;
  if (who.kind === 'name') return p.names[who.i]?.place ?? null;
  return null;
}

/** Add a name (the card); false when it is empty, already there or the list is full. */
export function addName(p: DlonieProgress, raw: string): boolean {
  const name = cleanName(raw);
  if (!name || p.names.length >= RULES.namesMax) return false;
  if (p.names.some(n => n.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return false;
  p.names.push({ name, place: null });
  p.walk = Math.min(p.walk, walkOf(p).length - 1);
  return true;
}

/** Remove a name (the card); the walk keeps pointing at a sensible place. */
export function removeName(p: DlonieProgress, i: number): boolean {
  if (!Number.isInteger(i) || i < 0 || i >= p.names.length) return false;
  p.names.splice(i, 1);
  p.walk = Math.min(p.walk, walkOf(p).length - 1);
  p.carry = null;
  return true;
}

/** Set (or clear) the sore place of a name, or of oneself (i = −1). */
export function setPlace(p: DlonieProgress, i: number, place: HurtPlace | null): boolean {
  if (i === -1) {
    if (!place) return false;
    p.selfPlace = place;
    return true;
  }
  const n = p.names[i];
  if (!n || (place !== null && !isPlace(place))) return false;
  n.place = place;
  return true;
}

/** The breath pattern of a choice. */
export const breathOf = (id: BreathId): BreathPattern => (id === 'calm' ? BREATH_PRESETS.calm : BREATH_PRESETS.even);

/** The best flames of any session length (null: never played). */
export function bestOf(p: DlonieProgress): number | null {
  const vals = Object.values(p.best).filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

/** The record key for a planned length: sessions are compared with sessions of the same length. */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec / 30) * 30);

/** Remember a first-time thing; true when it was new. */
export function markSeen(p: DlonieProgress, what: string): boolean {
  if (p.seen.includes(what)) return false;
  p.seen.push(what);
  return true;
}
