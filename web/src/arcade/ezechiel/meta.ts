/**
 * What Rzeka Ezechiela remembers between sessions, and the pure rules of its meta game (DESIGN §18):
 *
 *   the places     where the leaves are laid, in turn (the body's places, or a matter of the heart with a label of at
 *                  most 40 characters — the label stays on the device, in this progress only)
 *   the breath     the rest's pattern (kit/breath.ts) and the breaths in a rest (0 = auto)
 *   the trees      the leaves ever grown (the banks keep them: "their leaves will not wither", Ezek 47:12) and how
 *                  many leaves were laid at each place
 *   records        the most leaves per session length, the deepest water reached, the longest calm
 *
 * Version 1 from the start; any field of a wrong type is repaired rather than trusted.  No DOM, no randomness.
 */
import { BREATH_DEFAULT, breathOk, breathRest, cleanBreath, stepBreath, type BreathPattern, type BreathPhase } from '../kit/breath';
import { LABEL_MAX, PLACES, type PlaceId } from './content';
import { RULES, curve } from './rules';

export interface EzechielProgress {
  ver: 1;
  /** sessions saved */
  sessions: number;
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  /** the places the leaves are laid on, in turn (at least one) */
  places: PlaceId[];
  /** a matter of the heart, in the player's words (≤ 40 characters; only on this device) */
  label: string;
  /** the rest's breath and the breaths in a rest (0: auto) */
  breath: BreathPattern;
  restBreaths: number;
  /** the leaves grown by focus, all time; the leaves laid at each place */
  leaves: number;
  laid: Record<PlaceId, number>;
  /** the most leaves per session length (s); the deepest mark the water reached (0–4); the river reached, times */
  best: Record<string, number>;
  deepest: number;
  rivers: number;
  /** the longest calm in one stretch (s) */
  abideBest: number;
  /** first-time explanations and story cards already given */
  seen: string[];
  /** the last session's planned length (s) */
  lastLen: number;
}

const zeros = (): Record<PlaceId, number> => Object.fromEntries(PLACES.map(p => [p, 0])) as Record<PlaceId, number>;

export function freshProgress(): EzechielProgress {
  return {
    ver: 1, sessions: 0, pushes: 0, places: ['heart'], label: '', breath: { ...BREATH_DEFAULT }, restBreaths: 0,
    leaves: 0, laid: zeros(), best: {}, deepest: 0, rivers: 0, abideBest: 0, seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = 0): number => Math.max(lo, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isPlace = (v: unknown): v is PlaceId => (PLACES as readonly unknown[]).includes(v);

/** A label as kept: one line, trimmed, at most 40 characters (by code points, so an emoji is not cut in half). */
export function cleanLabel(v: unknown): string {
  if (typeof v !== 'string') return '';
  const one = v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return [...one].slice(0, LABEL_MAX).join('').trim();
}

/** Bring a loaded save to version 1, in place (idempotent): every field of a wrong type is repaired. */
export function migrate(p: EzechielProgress): EzechielProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (raw.ver !== 1) {
    const keep = { sessions: int(raw.sessions), pushes: int(raw.pushes) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, keep);
    return p;
  }
  p.sessions = int(raw.sessions);
  p.pushes = int(raw.pushes);
  const places = Array.isArray(raw.places) ? [...new Set(raw.places.filter(isPlace))] : [];
  p.places = places.length ? places : [...f.places];
  p.label = cleanLabel(raw.label);
  p.breath = cleanBreath(raw.breath);
  p.restBreaths = Math.min(RULES.restBreathsMax, int(raw.restBreaths));
  p.leaves = int(raw.leaves);
  const laid = zeros();
  if (isObj(raw.laid)) for (const k of PLACES) laid[k] = int(raw.laid[k]);
  p.laid = laid;
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) best[k] = Math.floor(num(v));
  p.best = best;
  p.deepest = Math.min(4, int(raw.deepest));
  p.rivers = int(raw.rivers);
  p.abideBest = Math.max(0, num(raw.abideBest));
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))] : [];
  p.lastLen = int(raw.lastLen);
  p.ver = 1;
  return p;
}

/** The most leaves of any session length (null: never played). */
export function bestOf(p: EzechielProgress): number | null {
  const vals = Object.values(p.best).filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

/** The record key for a planned length: sessions are compared with sessions of the same length. */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec / 30) * 30);

/** Add or take away a place of the list (the progress card); the list never goes empty. False when nothing changed. */
export function togglePlace(p: EzechielProgress, place: unknown): boolean {
  if (!isPlace(place)) return false;
  const i = p.places.indexOf(place);
  if (i >= 0) {
    if (p.places.length <= 1) return false;
    p.places.splice(i, 1);
  } else p.places.push(place);
  return true;
}

/** The matter of the heart's label (the progress card); false when it did not change. */
export function setLabel(p: EzechielProgress, v: unknown): boolean {
  const l = cleanLabel(v);
  if (l === p.label) return false;
  p.label = l;
  return true;
}

/** The place of the n-th leaf of a session (0-based): the list in turn. */
export const placeAt = (p: EzechielProgress, n: number): PlaceId => p.places[((n % p.places.length) + p.places.length) % p.places.length] ?? 'heart';

/** The rest's breath, cleaned. */
export const breathOf = (p: EzechielProgress): BreathPattern => cleanBreath(p.breath);

/** The breaths of a rest the auto setting gives for a planned length (the player's last one by default). */
export const autoBreaths = (p: EzechielProgress, plannedSec = p.lastLen || 600): number =>
  breathRest(breathOf(p), curve(RULES.restTarget, plannedSec), RULES.restMin).cycles;

/** A rest of the player's setting for a planned length: whole breaths and seconds. */
export function restOf(p: EzechielProgress, plannedSec = p.lastLen || 600): { cycles: number; sec: number } {
  const b = breathOf(p);
  const n = p.restBreaths > 0 ? p.restBreaths : autoBreaths(p, plannedSec);
  return { cycles: n, sec: n * (b.in + b.holdIn + b.out + b.holdOut) };
}

/** One phase of the breath moved by a second (the card's steppers); false when it would leave a breath under 2 s. */
export function stepBreathOf(p: EzechielProgress, phase: BreathPhase, delta: number): boolean {
  const next = stepBreath(breathOf(p), phase, delta);
  if (!breathOk(next)) return false;
  p.breath = next;
  return true;
}

/** A whole pattern (a preset chip); false for one that cannot guide a breath. */
export function setBreath(p: EzechielProgress, b: BreathPattern): boolean {
  if (!breathOk(b)) return false;
  p.breath = { ...b };
  return true;
}

/** The breaths in a rest: 0 = auto, else 1…12. */
export function setRestBreaths(p: EzechielProgress, n: number): void {
  p.restBreaths = Math.max(0, Math.min(RULES.restBreathsMax, Math.round(Number.isFinite(n) ? n : 0)));
}

/** Remember a first-time thing; true when it was new. */
export function markSeen(p: EzechielProgress, what: string): boolean {
  if (p.seen.includes(what)) return false;
  p.seen.push(what);
  return true;
}

/** All the leaves ever laid. */
export const laidAll = (p: EzechielProgress): number => PLACES.reduce((s, k) => s + (p.laid[k] ?? 0), 0);
