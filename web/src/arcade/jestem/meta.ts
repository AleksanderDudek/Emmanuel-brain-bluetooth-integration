/**
 * What Ja jestem… remembers between sessions (DESIGN §13.8), and the pure rules of its meta loop:
 *
 *   the album       every declaration received — how many times, the most pieces lit, the aura's best
 *                   rays and rings, the first and the last day — and the player's own visions the same way
 *   the next vision by default the next declaration not yet received ("the record is always a unique
 *                   affirmation"); the player may choose one for the next session, pin one for every
 *                   session, or take an own picture
 *   the form        how Polish says it: "jestem silny" or "jestem silna" (asked once)
 *   the pace        cells lit per minute of push and rest, averaged over sessions: the next window is cut
 *                   into about 1.4 times what the player is expected to light (48…144) — finer as they grow
 *
 * The own pictures and their affirmations (the player's continuation after "ja") live in kit/images.ts (only on
 * this device); the progress keeps only their ids, counts, and whether the label is already a continuation (a
 * save before round 11 kept a single word: `cont: false`).  `migrate` repairs any field of a wrong type, so an
 * old or foreign save loads; a version-1 save's pace (cells per second of pouring) starts again from `pace0`.
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
  /** its label is a continuation after "ja" (round 11); false: an old single word ("zdrowa" → "jestem zdrowa") */
  cont: boolean;
}

/** A vision: one of the declarations ("decl:silny") or an own picture ("own:<image id>"). */
export type VisionKey = `decl:${DeclId}` | `own:${string}`;

export interface JestemProgress {
  /** 2 since round 11 (the pace per minute, own continuations); 1 before */
  ver: 2;
  sessions: number;
  /** push blocks begun over all sessions (every 4th from the 3rd session is blind) */
  pushes: number;
  form: Form | null;
  /** a vision pinned for every session, and one chosen for the next session only */
  pin: VisionKey | null;
  next: VisionKey | null;
  album: Partial<Record<DeclId, AlbumEntry>>;
  own: OwnEntry[];
  /** cells lit per minute of push and rest (the plan's pace) */
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
    ver: 2, sessions: 0, pushes: 0, form: null, pin: null, next: null, album: {}, own: [], pace: RULES.pace0,
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
  const old = raw.ver !== 2;
  p.ver = 2;
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
      own.push({ ...e, n: int(v.n), id: v.id, cont: !old && v.cont === true });
    }
  }
  p.own = own.slice(0, 40);
  p.pace = old ? f.pace : num(raw.pace, f.pace, RULES.paceMin, RULES.paceMax);
  p.best = int(raw.best);
  p.total = int(raw.total);
  p.cells = int(raw.cells, 0, 0, RULES.cellsLongMax);
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
  p.own.unshift({ id, n: 0, best: 0, rays: 0, rings: 0, first: '', last: '', cont: true });
  if (p.own.length > 40) p.own.length = 40;
}

/** An own picture's label is now a continuation (the lobby rewrote an old word, or the player saved one). */
export function markCont(p: JestemProgress, id: string): void {
  const o = p.own.find(x => x.id === id);
  if (o) o.cont = true;
}

/** Whether an own picture's stored label is still an old single word (a save before round 11). */
export const legacyLabel = (p: JestemProgress, id: string | null): boolean => !!id && p.own.some(o => o.id === id && !o.cont);

/** An own picture was deleted: its entry, and any choice of it, go. */
export function dropOwn(p: JestemProgress, id: string): void {
  p.own = p.own.filter(o => o.id !== id);
  const k = ownKey(id);
  if (p.pin === k) p.pin = null;
  if (p.next === k) p.next = null;
  if (p.last === k) p.last = null;
}

/** The most cells a window of `playSec` seconds of push and rest may take: 144, growing to 216 past 15 minutes (round 12). */
export function cellsMaxFor(playSec: number): number {
  const k = clamp((playSec - RULES.cellsLongFrom) / (RULES.cellsLongAt - RULES.cellsLongFrom));
  return Math.round(RULES.cellsMax + (RULES.cellsLongMax - RULES.cellsMax) * k);
}

/**
 * How many cells the next window gets: the cells the player is expected to light — their pace × the minutes of push
 * and rest the session holds — times `planSpread` (round 20: 0.9, so the player's own focus lights the whole picture;
 * a little time is left for the light pass), within 10…144 (…216 in sessions over 15 minutes, `cellsMaxFor`).
 */
export function planCells(pace: number, playSec: number): number {
  const p = clamp(Number.isFinite(pace) ? pace : RULES.pace0, RULES.paceMin, RULES.paceMax);
  return Math.round(clamp(p * (Math.max(0, playSec) / 60) * RULES.planSpread, RULES.cellsMin, cellsMaxFor(playSec)));
}

/**
 * The pace after a session that lit `lit` cells in `playSec` seconds of push and rest (short sessions barely move it).
 * A window the player finished early passes the seconds up to its last cell (sim.ts `paceSec`), not the light pass after.
 */
export function nextPace(pace: number, lit: number, playSec: number): number {
  if (!(playSec > 0) || lit < 0) return pace;
  const now = clamp(lit / (Math.max(30, playSec) / 60), RULES.paceMin, RULES.paceMax);
  const mix = RULES.paceMix * clamp(playSec / 120, 0, 1);
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
  p.own[i] = { ...put(o.n > 0 ? o : undefined), id: o.id, cont: o.cont };
  return p.own[i].n;
}
