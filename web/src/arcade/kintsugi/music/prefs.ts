/**
 * What the player chose for Złote serce's music (kept in the game's progress, on this device only): tracks with the
 * ambient / the ambient only / silence, the one-time YouTube consent, the tracks switched off, up to twelve own
 * YouTube tracks (a video id, a length the player typed, a name), and the rotation's memory (kit/playlist.ts).
 * A saved value is never trusted: `cleanMusic` repairs it field by field.
 */
import { MAX_SESSION_SEC } from '../../../settings';
import { introOf, parseLength, type Recent, type Track } from '../../kit/playlist';
import { isVideoId, parseVideoId } from '../../kit/youtube';
import { BUILTIN, isBuiltin } from './tracks';

export type MusicMode = 'tracks' | 'ambient' | 'silence';
export const MODES: readonly MusicMode[] = ['tracks', 'ambient', 'silence'];

/** A track the player added (a YouTube video id, its length, a name they gave it). */
export interface OwnTrack { id: string; sec: number; title: string }

export interface MusicPrefs {
  mode: MusicMode;
  /** the player agreed, once, that the tracks play from YouTube */
  youtube: boolean;
  /** tracks switched off (built-in or own ids) */
  off: string[];
  own: OwnTrack[];
  /** the rotation's memory (kit/playlist.ts ageRecent) */
  recent: Recent;
}

/** At most this many own tracks; a name at most this long. */
export const OWN_MAX = 12;
export const TITLE_MAX = 60;
/** A length the player may type (kit/playlist.ts parseLength's bounds). */
const LEN_MIN = 20, LEN_MAX = 3 * 3600;

export const freshMusic = (): MusicPrefs => ({ mode: 'tracks', youtube: false, off: [], own: [], recent: {} });

/** A name as kept: one line, trimmed, at most TITLE_MAX characters (whole characters, not halves of a pair). */
export const cleanTitle = (s: unknown): string =>
  typeof s === 'string' ? [...s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, TITLE_MAX).join('').trim() : '';

function cleanOwn(v: unknown): OwnTrack[] {
  if (!Array.isArray(v)) return [];
  const out: OwnTrack[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (out.length >= OWN_MAX) break;
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim() : '';
    const sec = typeof o.sec === 'number' ? Math.round(o.sec) : NaN;
    if (!isVideoId(id) || isBuiltin(id) || seen.has(id)) continue;
    if (!Number.isFinite(sec) || sec < LEN_MIN || sec > LEN_MAX) continue;
    seen.add(id);
    out.push({ id, sec, title: cleanTitle(o.title) || id });
  }
  return out;
}

function cleanRecent(v: unknown): Recent {
  const out: Recent = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [id, ago] of Object.entries(v as Record<string, unknown>)) {
    if (!isVideoId(id) || typeof ago !== 'number' || !Number.isFinite(ago)) continue;
    const n = Math.round(ago);
    if (n >= 1 && n < 4) out[id] = n;
  }
  return out;
}

/**
 * A saved value, repaired field by field (never trusted).  An object is repaired in place and returned — the same
 * object — so whoever holds it keeps it: the lobby's music section edits the object it was given, even after the
 * game's own migration ran again over the progress (`p.music = cleanMusic(p.music)`).  Anything else: a fresh one.
 */
export function cleanMusic(v: unknown): MusicPrefs {
  const m = freshMusic();
  if (!v || typeof v !== 'object' || Array.isArray(v)) return m;
  const o = v as Record<string, unknown>;
  if (typeof o.mode === 'string' && (MODES as readonly string[]).includes(o.mode)) m.mode = o.mode as MusicMode;
  m.youtube = o.youtube === true;
  m.own = cleanOwn(o.own);
  const known = new Set([...BUILTIN.map(b => b.id), ...m.own.map(x => x.id)]);
  if (Array.isArray(o.off)) m.off = [...new Set(o.off.filter((id): id is string => typeof id === 'string' && known.has(id)))];
  m.recent = cleanRecent(o.recent);
  for (const k of Object.keys(o)) if (!Object.prototype.hasOwnProperty.call(m, k)) delete o[k];
  return Object.assign(o, m) as unknown as MusicPrefs;
}

/** Every track on the list: the founder's eleven, then the player's own. */
export const allTracks = (m: MusicPrefs): Track[] => [...BUILTIN.map(b => ({ id: b.id, sec: b.sec })), ...m.own.map(o => ({ id: o.id, sec: o.sec }))];

/** The tracks that may play: every track on the list not switched off. */
export const activeTracks = (m: MusicPrefs): Track[] => allTracks(m).filter(x => !m.off.includes(x.id));

export const isOn = (m: MusicPrefs, id: string): boolean => !m.off.includes(id);

export function setOn(m: MusicPrefs, id: string, on: boolean): void {
  m.off = on ? m.off.filter(x => x !== id) : m.off.includes(id) ? m.off : [...m.off, id];
}

export function setAll(m: MusicPrefs, on: boolean): void {
  m.off = on ? [] : allTracks(m).map(x => x.id);
}

export function setMode(m: MusicPrefs, mode: MusicMode): void {
  if (MODES.includes(mode)) m.mode = mode;
}

export type AddError = 'link' | 'length' | 'dup' | 'full';
export type AddResult = { ok: true; track: OwnTrack; tooLong: boolean } | { ok: false; error: AddError };

/** The room a session of `total` s has for one track whole: all of it after the ambient's short opening. */
export const roomFor = (total: number): number => Math.max(0, total - introOf(total));

/** Never heard whole: longer than even the longest session has room for (it plays only as a last track, faded). */
export const tooLong = (sec: number): boolean => sec > roomFor(MAX_SESSION_SEC);

/** Add an own track from what the player typed: a YouTube link (or id), a length ("4:39"), an optional name. */
export function addOwn(m: MusicPrefs, link: string, length: string, name: string, untitled: (id: string) => string): AddResult {
  if (m.own.length >= OWN_MAX) return { ok: false, error: 'full' };
  const id = parseVideoId(link);
  if (!id) return { ok: false, error: 'link' };
  if (isBuiltin(id) || m.own.some(o => o.id === id)) return { ok: false, error: 'dup' };
  const sec = parseLength(length);
  if (sec === null) return { ok: false, error: 'length' };
  const track: OwnTrack = { id, sec, title: cleanTitle(name) || cleanTitle(untitled(id)) || id };
  m.own = [...m.own, track];
  setOn(m, id, true);
  return { ok: true, track, tooLong: tooLong(sec) };
}

export function removeOwn(m: MusicPrefs, id: string): void {
  m.own = m.own.filter(o => o.id !== id);
  m.off = m.off.filter(x => x !== id);
  if (id in m.recent) {
    const r = { ...m.recent };
    delete r[id];
    m.recent = r;
  }
}
