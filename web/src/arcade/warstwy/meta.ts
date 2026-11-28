/**
 * What Warstwy światła remembers between sessions (DESIGN §28), and the pure rules of its meta:
 *
 *   records   the most threads of light in one session, threads in all (drawn with focus), things the Light took by
 *             grace, layers cleansed, sessions in which every thing of every layer was drawn with focus, sessions
 *   the pace  focus-seconds a sighted second, learnt half-way per session (rules.ts `learnPace`): the next session
 *             fits its things to it
 *   own words "Co dziś oddajesz?" — one short line per layer, kept only in this progress on this device (§18.3 "names
 *             stay home"), shown in that layer's rests, never in a session's result
 *   the breath the rests' breath (kit/breath.ts)
 *
 * Anything broken becomes a fresh progress keeping only a session count; every field of a wrong type is repaired, never
 * trusted.  No DOM, no randomness.
 */
import { BREATH_PRESETS, cleanBreath, type BreathPattern } from '../kit/breath';
import { LAYER_IDS, cleanOwn, type LayerId } from './content';
import { cleanPace } from './rules';

export interface WarstwyProgress {
  ver: 1;
  sessions: number;
  /** the most threads of light in one session */
  best: number;
  /** all time: things drawn with focus, things taken by grace, layers cleansed, sessions all drawn with focus */
  threads: number;
  grace: number;
  layers: number;
  whole: number;
  /** focus-seconds a sighted second (null: not learnt yet) */
  pace: number | null;
  /** "Co dziś oddajesz?" per layer ('' for none), and whether they show in the session */
  own: Record<LayerId, string>;
  ownOn: boolean;
  breath: BreathPattern;
  /** first-time explanations given */
  seen: string[];
  /** the last session's length (s): the lobby's guess before the length buttons are read */
  lastLen: number;
}

/** The meditation's default breath: in 5, out 5 — six breaths a minute, even (the series' choice). */
export const BREATH_DEF: BreathPattern = BREATH_PRESETS.even;

const noOwn = (): Record<LayerId, string> => Object.fromEntries(LAYER_IDS.map(id => [id, ''])) as Record<LayerId, string>;

export function freshProgress(): WarstwyProgress {
  return {
    ver: 1, sessions: 0, best: 0, threads: 0, grace: 0, layers: 0, whole: 0, pace: null, own: noOwn(), ownOn: true,
    breath: { ...BREATH_DEF }, seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0): number => Math.max(0, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Bring a loaded save to version 1, in place (idempotent): every field repaired; a broken save keeps its session count. */
export function migrate(p: WarstwyProgress): WarstwyProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (raw.ver !== 1) {
    const sessions = int(raw.sessions);
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, { sessions });
    return p;
  }
  p.sessions = int(raw.sessions);
  p.best = int(raw.best);
  p.threads = int(raw.threads);
  p.grace = int(raw.grace);
  p.layers = int(raw.layers);
  p.whole = int(raw.whole);
  p.pace = raw.pace === null || raw.pace === undefined || typeof raw.pace !== 'number' || !Number.isFinite(raw.pace) || raw.pace <= 0 ? null : cleanPace(raw.pace);
  const own = noOwn();
  if (isObj(raw.own)) for (const id of LAYER_IDS) own[id] = cleanOwn(raw.own[id]);
  p.own = own;
  p.ownOn = typeof raw.ownOn === 'boolean' ? raw.ownOn : true;
  p.breath = cleanBreath(raw.breath);
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))].slice(0, 40) : [];
  p.lastLen = int(raw.lastLen);
  return p;
}

/** The best so far (null: never played). */
export const bestOf = (p: WarstwyProgress): number | null => (p.sessions > 0 ? p.best : null);

/** A layer's own line, as the session shows it ('' when none, or own lines are off). */
export const ownLine = (p: WarstwyProgress, id: LayerId): string => (p.ownOn ? p.own[id] ?? '' : '');

/** Keep a layer's own line (cleaned; '' clears it). */
export function setOwn(p: WarstwyProgress, id: LayerId, line: string): void {
  if (!LAYER_IDS.includes(id)) return;
  p.own[id] = cleanOwn(line);
}

/** Forget every own line. */
export function forgetOwn(p: WarstwyProgress): void {
  p.own = noOwn();
}

/** How many layers have an own line. */
export const ownCount = (p: WarstwyProgress): number => LAYER_IDS.filter(id => !!p.own[id]).length;

export function setBreath(p: WarstwyProgress, b: BreathPattern): void {
  p.breath = cleanBreath(b);
}
