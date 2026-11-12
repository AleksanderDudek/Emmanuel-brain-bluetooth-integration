/**
 * What Ja jestem… remembers between sessions (DESIGN §13.8), and the pure rules of its meta loop:
 *
 *   the album       every declaration received — how many times, the most pieces lit, the aura's best
 *                   rays and rings, the first and the last day — and the player's own visions the same way
 *   the next vision by default the next declaration not yet received ("the record is always a unique
 *                   affirmation"); the player may choose one for the next session, pin one for every
 *                   session, or take an own picture
 *   the form        how Polish says it: "jestem silny" or "jestem silna" (asked once)
 *   the pace        mean cells lit per second of pouring, averaged over sessions: the next window is cut
 *                   into as many cells as the player can colour in the time — finer windows as they grow
 *
 * The own pictures and their words live in kit/images.ts (only on this device); the progress keeps only
 * their ids and counts.  `migrate` repairs any field of a wrong type, so an old or foreign save loads.
 */
import { clamp } from '../kit/juice';
import { DECL_ORDER, isDecl, type DeclId, type Form } from './content';
import { RULES } from './rules';

export interface AlbumEntry {
  /** times received */
  n: number;
  /** the most pieces lit in one session, and the aura's best */
  best: number;
  rays: number;
  rings: number;
  /** the first and the last day ("YYYY-MM-DD") */
  first: string;
  last: string;
}

export interface OwnEntry extends AlbumEntry {
  /** the picture's id in kit/images.ts */
  id: string;
}

/** A vision: one of the declarations ("decl:silny") or an own picture ("own:<image id>"). */
export type VisionKey = `decl:${DeclId}` | `own:${string}`;

export interface JestemProgress {
  ver: 1;
  sessions: number;
  /** push blocks begun over all sessions (every 4th from the 3rd session is blind) */
  pushes: number;
  form: Form | null;
  /** a vision pinned for every session, and one chosen for the next session only */
  pin: VisionKey | null;
  next: VisionKey | null;
  album: Partial<Record<DeclId, AlbumEntry>>;
  own: OwnEntry[];
  /** mean cells lit per second of pouring (the plan's pace) */
  pace: number;
  /** the most pieces lit in a session, and all pieces ever lit */
  best: number;
  total: number;
  /** the last window's cell count and vision */
  cells: number;
  last: VisionKey | null;
  /** coach marks already shown */
  seen: string[];
}

export function freshProgress(): JestemProgress {
  return {
    ver: 1, sessions: 0, pushes: 0, form: null, pin: null, next: null, album: {}, own: [], pace: RULES.pace0,
    best: 0, total: 0, cells: 0, last: null, seen: [],
  };
}

const num = (v: unknown, def = 0, lo = 0, hi = Number.MAX_SAFE_INTEGER): number =>
  (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : def);
const int = (v: unknown, def = 0, lo = 0, hi = Number.MAX_SAFE_INTEGER): number => Math.round(num(v, def, lo, hi));
const day = (v: unknown): string => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function entry(v: unknown): AlbumEntry | null {
  if (!isObj(v)) return null;
  const n = int(v.n);
  if (n <= 0) return null;
  return { n, best: int(v.best), rays: int(v.rays, 0, 0, RULES.raysMax), rings: int(v.rings, 0, 0, RULES.ringsMax), first: day(v.first), last: day(v.last) };
}

export const isVisionKey = (v: unknown): v is VisionKey =>
  typeof v === 'string' && ((v.startsWith('decl:') && isDecl(v.slice(5))) || (v.startsWith('own:') && v.length > 4 && v.length < 80));

/** Saves already repaired (the lobby's picture asks every frame). */
const migrated = new WeakSet<object>();

/** Repair a loaded save in place (any field of a wrong type gets its fresh value) and return it. */
export function migrate(p: JestemProgress): JestemProgress {
  if (migrated.has(p)) return p;
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  p.ver = 1;
  p.sessions = int(raw.sessions);
  p.pushes = int(raw.pushes);
  p.form = raw.form === 'm' || raw.form === 'f' ? raw.form : null;
  p.pin = isVisionKey(raw.pin) ? raw.pin : null;
  p.next = isVisionKey(raw.next) ? raw.next : null;
  const album: Partial<Record<DeclId, AlbumEntry>> = {};
  if (isObj(raw.album)) for (const [k, v] of Object.entries(raw.album)) if (isDecl(k)) { const e = entry(v); if (e) album[k] = e; }
  p.album = album;
  const own: OwnEntry[] = [];
  if (Array.isArray(raw.own)) {
    for (const v of raw.own) {
      if (!isObj(v) || typeof v.id !== 'string' || !v.id || v.id.length > 70 || own.some(o => o.id === v.id)) continue;
      const e = entry({ ...v, n: Math.max(1, int(v.n)) })!;
      own.push({ ...e, n: int(v.n), id: v.id });
    }
  }
  p.own = own.slice(0, 40);
  p.pace = num(raw.pace, f.pace, RULES.paceMin, RULES.paceMax);
  p.best = int(raw.best);
  p.total = int(raw.total);
  p.cells = int(raw.cells, 0, 0, RULES.cellsMax);
  p.last = isVisionKey(raw.last) ? raw.last : null;
  p.seen = Array.isArray(raw.seen) ? raw.seen.filter((x): x is string => typeof x === 'string').slice(0, 64) : [];
  // an own vision pinned or chosen must still be one of the player's pictures
  const ownIds = new Set(p.own.map(o => o.id));
  if (p.pin?.startsWith('own:') && !ownIds.has(p.pin.slice(4))) p.pin = null;
  if (p.next?.startsWith('own:') && !ownIds.has(p.next.slice(4))) p.next = null;
  migrated.add(p);
  return p;
}

export const declKey = (id: DeclId): VisionKey => `decl:${id}`;
export const ownKey = (id: string): VisionKey => `own:${id}`;
export const keyDecl = (k: VisionKey | null): DeclId | null => (k && k.startsWith('decl:') && isDecl(k.slice(5)) ? k.slice(5) as DeclId : null);
export const keyOwn = (k: VisionKey | null): string | null => (k && k.startsWith('own:') ? k.slice(4) : null);

/** Declarations received so far (count). */
export const received = (p: JestemProgress): number => DECL_ORDER.filter(id => (p.album[id]?.n ?? 0) > 0).length;

/**
 * The next declaration nobody chose: the first not yet received, in the newcomer's order; once all are
 * in the album, the one received least (and longest ago).
 */
export function nextNew(p: JestemProgress): DeclId {
  const fresh = DECL_ORDER.find(id => !(p.album[id]?.n));
  if (fresh) return fresh;
  let best: DeclId = DECL_ORDER[0], bn = Infinity, bl = '';
  for (const id of DECL_ORDER) {
    const e = p.album[id]!;
    if (e.n < bn || (e.n === bn && e.last < bl)) { best = id; bn = e.n; bl = e.last; }
  }
  return best;
}

/** The vision of the next session: the one chosen for it, else the pinned one, else the next new declaration. */
export function nextVision(p: JestemProgress): VisionKey {
  if (p.next) return p.next;
  if (p.pin) return p.pin;
  return declKey(nextNew(p));
}

/** Choose a vision for the next session only (the same as the pinned or the automatic one clears the choice). */
export function chooseNext(p: JestemProgress, k: VisionKey | null): void {
  p.next = k && k !== p.pin && !(k === declKey(nextNew(p)) && !p.pin) ? k : null;
}

/** Pin a vision for every session (null unpins). */
export function pinVision(p: JestemProgress, k: VisionKey | null): void {
  p.pin = k;
  if (p.next === k) p.next = null;
}

/** An own picture was added (its entry, never received yet). */
export function addOwn(p: JestemProgress, id: string): void {
  if (p.own.some(o => o.id === id)) return;
  p.own.unshift({ id, n: 0, best: 0, rays: 0, rings: 0, first: '', last: '' });
  if (p.own.length > 40) p.own.length = 40;
}

/** An own picture was deleted: its entry, and any choice of it, go. */
export function dropOwn(p: JestemProgress, id: string): void {
  p.own = p.own.filter(o => o.id !== id);
  const k = ownKey(id);
  if (p.pin === k) p.pin = null;
  if (p.next === k) p.next = null;
  if (p.last === k) p.last = null;
}

/**
 * How many cells the next window gets: the player's pace × the seconds of pouring the session plans,
 * aimed at finishing near its end (planShare), within 24…64.
 */
export function planCells(pace: number, pourSec: number): number {
  const p = clamp(Number.isFinite(pace) ? pace : RULES.pace0, RULES.paceMin, RULES.paceMax);
  return Math.round(clamp(p * pourSec * RULES.planShare, RULES.cellsMin, RULES.cellsMax));
}

/** The pace after a session that lit `lit` cells in `pourSec` seconds of pouring (short sessions barely move it). */
export function nextPace(pace: number, lit: number, pourSec: number): number {
  if (!(pourSec > 0) || lit < 0) return pace;
  const now = clamp(lit / Math.max(20, pourSec), RULES.paceMin, RULES.paceMax);
  const mix = RULES.paceMix * clamp(pourSec / 60, 0, 1);
  return clamp(pace * (1 - mix) + now * mix, RULES.paceMin, RULES.paceMax);
}

/** What one session gives the album. */
export interface Receipt { key: VisionKey; lit: number; rays: number; rings: number; day: string }

/** Write a session into the album (and the own vision's entry); returns how many times it was received now. */
export function receive(p: JestemProgress, r: Receipt): number {
  const put = (e: AlbumEntry | undefined): AlbumEntry => ({
    n: (e?.n ?? 0) + 1, best: Math.max(e?.best ?? 0, r.lit), rays: Math.max(e?.rays ?? 0, r.rays), rings: Math.max(e?.rings ?? 0, r.rings),
    first: e?.first || r.day, last: r.day,
  });
  const decl = keyDecl(r.key);
  if (decl) {
    p.album[decl] = put(p.album[decl]);
    return p.album[decl]!.n;
  }
  const id = keyOwn(r.key);
  const i = id ? p.own.findIndex(o => o.id === id) : -1;
  if (i < 0) return 1;
  const o = p.own[i];
  p.own[i] = { ...put(o.n > 0 ? o : undefined), id: o.id };
  return p.own[i].n;
}
