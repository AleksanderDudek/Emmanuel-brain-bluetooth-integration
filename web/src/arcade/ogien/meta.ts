/**
 * What Ogień, ogień, ogień remembers between sessions, and the pure rules of its meta game:
 *
 *   the sky       every session's highest fire becomes a star in the player's own night sky (the lobby's
 *                 picture and the progress card): a spark a faint red star, Pentecost a radiant gold one
 *   the gallery   the forms seen (each fire and its variants) with their verses; a fire's second picture
 *                 unlocks after it was reached in three sessions, or in a second round of the ladder
 *   records       the session's sparks per session length, the highest fire (as a ladder index: round × 7
 *                 + fire), the fastest change out of each fire, changes and whole ladders, sparks in all
 *
 * Version 1 from the start.  The placeholder's save (`{ ver: 1, sessions: n }`, from before the game was
 * built) keeps its session count; any field of a wrong type is repaired rather than trusted.  No DOM, no
 * randomness.
 */
import { RUNGS, RUNG_IDS, type RungId } from './content';
import { RULES } from './rules';

export interface SkyStar {
  /** the session it was lit in (1, 2, …): it fixes the star's place in the sky */
  n: number;
  /** the session's highest fire as a ladder index (round × 7 + fire) */
  top: number;
  /** the session's sparks */
  sparks: number;
  /** the day ("YYYY-MM-DD") */
  day: string;
}

export interface OgienProgress {
  ver: 1;
  /** sessions saved */
  sessions: number;
  /** push blocks begun, all time: every 4th is blind (smoke) from the 3rd session */
  pushes: number;
  /** sparks in all */
  total: number;
  /** the best session's sparks per session length (s) */
  best: Record<string, number>;
  /** the highest fire ever as a ladder index (−1: none yet) */
  bestTop: number;
  /** per fire: sessions in which it was reached */
  reached: Record<string, number>;
  /** the forms seen, "fire:variant" */
  forms: string[];
  /** per fire: the fastest change out of it (s of play from reaching it) */
  fastest: Record<string, number>;
  changes: number;
  /** whole ladders (Pentecost's ring filled) */
  cycles: number;
  sky: SkyStar[];
  /** the session length last played (s) */
  lastLen: number;
  /** first-time explanations already given (coach marks) and first-time story cards */
  seen: string[];
}

export function freshProgress(): OgienProgress {
  return {
    ver: 1, sessions: 0, pushes: 0, total: 0, best: {}, bestTop: -1, reached: {}, forms: [], fastest: {}, changes: 0, cycles: 0,
    sky: [], lastLen: 0, seen: [],
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = 0): number => Math.max(lo, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const RUNG_SET = new Set<string>(RUNG_IDS);

function counts(v: unknown, pick: (x: number) => boolean = x => x > 0): Record<string, number> {
  const out: Record<string, number> = {};
  if (isObj(v)) for (const [k, x] of Object.entries(v)) if (typeof x === 'number' && Number.isFinite(x) && pick(x)) out[k] = x;
  return out;
}

function readStar(v: unknown): SkyStar | null {
  if (!isObj(v)) return null;
  const n = int(v.n, 0, 0), top = Math.floor(num(v.top, -1));
  if (n < 1 || top < 0) return null;
  return { n, top: Math.min(top, 7 * 99 + 6), sparks: int(v.sparks), day: typeof v.day === 'string' ? v.day.slice(0, 10) : '' };
}

/**
 * Bring a loaded save to version 1, in place (idempotent).  The placeholder's save keeps its session count
 * and starts fresh; a version-1 save keeps everything, with its types repaired.
 */
export function migrate(p: OgienProgress): OgienProgress {
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
  p.total = int(raw.total);
  p.best = counts(raw.best);
  p.bestTop = Math.max(-1, Math.floor(num(raw.bestTop, -1)));
  p.reached = Object.fromEntries(Object.entries(counts(raw.reached)).filter(([k]) => RUNG_SET.has(k)).map(([k, v]) => [k, Math.floor(v)]));
  p.forms = Array.isArray(raw.forms) ? [...new Set(raw.forms.filter((x): x is string => typeof x === 'string' && isForm(x)))] : [];
  p.fastest = Object.fromEntries(Object.entries(counts(raw.fastest)).filter(([k]) => RUNG_SET.has(k)));
  p.changes = int(raw.changes);
  p.cycles = int(raw.cycles);
  p.sky = Array.isArray(raw.sky) ? raw.sky.map(readStar).filter((s): s is SkyStar => !!s).slice(-RULES.skyMax) : [];
  p.lastLen = int(raw.lastLen);
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((x): x is string => typeof x === 'string'))] : [];
  // a session count below the sky's (a save written by hand, a newer game's): the sky is the truth
  const lastStar = p.sky.length ? p.sky[p.sky.length - 1].n : 0;
  if (p.sessions < lastStar) p.sessions = lastStar;
  for (const k of Object.keys(raw)) if (!(k in f)) delete raw[k];
  return p;
}

/** "ognisko:1" — a fire and its picture. */
export const formKey = (rung: number, variant: number): string => `${RUNGS[rung].id}:${variant}`;

function isForm(s: string): boolean {
  const [id, v] = s.split(':');
  const r = RUNGS.findIndex(x => x.id === id);
  const n = Number(v);
  return r >= 0 && Number.isInteger(n) && n >= 0 && n < RUNGS[r].variants;
}

/** Sessions a fire must have been reached in before its second picture shows. */
export const VARIANT_AT = 3;

/** How many pictures of a fire the player has unlocked (at least the first). */
export function unlocked(p: OgienProgress, rung: number): number {
  const spec = RUNGS[rung];
  let n = 1;
  for (let v = 1; v < spec.variants; v++) {
    if ((p.reached[spec.id] ?? 0) >= VARIANT_AT * v || p.forms.includes(formKey(rung, v))) n = v + 1;
  }
  return n;
}

/**
 * The picture a fire shows: the second round of the ladder (and every odd one) always the richer one; else,
 * once unlocked, the pictures take turns session by session.
 */
export function variantFor(p: OgienProgress, rung: number, cycle: number, session: number): number {
  const spec = RUNGS[rung];
  if (cycle % 2 === 1) return Math.min(spec.variants - 1, 1);
  const n = unlocked(p, rung);
  return n <= 1 ? 0 : Math.max(0, session) % n;
}

/** The session length key of the records. */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

export function bestFor(p: OgienProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: OgienProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}

/** A ladder index's fire (0..6) and round (0, 1, …). */
export const fireOf = (top: number): number => ((Math.floor(top) % RUNGS.length) + RUNGS.length) % RUNGS.length;
export const roundOf = (top: number): number => Math.max(0, Math.floor(top / RUNGS.length));

/** The forms the gallery shows: every fire's pictures, in order. */
export function allForms(): { rung: number; variant: number; key: string; id: RungId }[] {
  return RUNGS.flatMap((r, i) => Array.from({ length: r.variants }, (_, v) => ({ rung: i, variant: v, key: formKey(i, v), id: r.id })));
}

/**
 * Where a session's star sits in the sky (0..1 across and down) and how it shines: the place is fixed by the
 * session's number (a golden-angle spiral, jittered, so a sky of many sessions fills evenly and never moves),
 * the size and colour by the fire it reached.
 */
export function skyPlace(n: number): { x: number; y: number } {
  const g = 2.399963229728653;   // the golden angle
  const k = Math.max(1, n);
  const r = Math.sqrt((k % 160) / 160 + 0.003) * 0.5;
  const a = k * g;
  const h = (s: number) => {
    let x = Math.imul(k ^ s, 2654435761) >>> 0;
    x ^= x >>> 13;
    return (x % 1000) / 1000;
  };
  return { x: 0.5 + Math.cos(a) * r * 0.96 + (h(7) - 0.5) * 0.03, y: 0.5 + Math.sin(a) * r * 0.9 + (h(13) - 0.5) * 0.03 };
}

/** A star's look by its ladder index: radius factor 0..1 and colour [r, g, b]. */
export function starLook(top: number): { size: number; rgb: readonly [number, number, number]; rays: boolean } {
  const fire = fireOf(top), round = roundOf(top);
  const COLORS: readonly (readonly [number, number, number])[] = [
    [255, 150, 110], [255, 196, 120], [255, 214, 140], [255, 236, 190], [255, 248, 228], [190, 214, 255], [255, 226, 150],
  ];
  return { size: Math.min(1, 0.28 + fire * 0.11 + round * 0.08), rgb: COLORS[fire], rays: fire >= 4 || round > 0 };
}
