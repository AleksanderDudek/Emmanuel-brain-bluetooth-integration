/**
 * Where the exercise cards keep their sessions (src/cards/DESIGN.md §7): an IndexedDB database of
 * their own, `brainlink-cards`, next to the app's `brainlink`.  A card session holds every trial
 * (for the progress charts and for anyone who wants to analyse them), the games' levels (where the
 * next session starts), and the band's per-second record when one was on.  Keeping it apart means
 * the app's database and its versions are never touched by this module.
 *
 * Sessions with a band (or its simulator) are *also* saved as the app's training results, so they
 * count toward the day score and the streak like every other session (src/cards/board/layer.ts).
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BandRecord } from './board/band';
import type { LinkKind } from './duo/link';
import type { SessionStats } from './games/stats';
import type { GameId, TrialRecord } from './games/types';

export interface GamePlay {
  game: GameId;
  levelStart: number;
  levelEnd: number;
  plannedSec: number;
  playedSec: number;
  trials: TrialRecord[];
  stats: SessionStats;
  /** taps too early to be reactions */
  early: number;
}

export type PaperSpeed = 'slow' | 'medium' | 'fast';

/** A printed card done with the band on (the paper session, src/cards/paper.ts). */
export interface PaperRecord {
  card: number;
  /** each timed attempt: the time it took (null: not finished in its block), and the book's target for that speed */
  blocks: { speed: PaperSpeed; sec: number | null; target: number | null }[];
  /** the player's own stars, as on the card (1–3), and errors they noticed */
  stars: 1 | 2 | 3 | null;
  errors: number | null;
}

export interface CardSession {
  v: 1;
  id: string;
  kind: 'game' | 'workout' | 'paper';
  /** epoch seconds */
  start: number;
  end: number;
  pad: LinkKind | null;
  plays: GamePlay[];
  band: BandRecord | null;
  /** the clock sync's quality at the end (ms): the round trip, and the worst error it allows */
  sync: { rtt: number; uncertainty: number } | null;
  paper?: PaperRecord;
}

interface CardsDB extends DBSchema {
  sessions: { key: string; value: CardSession; indexes: { by_start: number } };
  kv: { key: string; value: unknown };
}

export class CardStore {
  private constructor(private readonly db: IDBPDatabase<CardsDB>) {}

  static async open(name = 'brainlink-cards'): Promise<CardStore> {
    let opened: IDBPDatabase<CardsDB> | null = null;
    const db = await openDB<CardsDB>(name, 1, {
      blocking: () => opened?.close(),
      upgrade(d) {
        d.createObjectStore('sessions', { keyPath: 'id' }).createIndex('by_start', 'start');
        d.createObjectStore('kv');
      },
    });
    opened = db;
    return new CardStore(db);
  }

  close(): void { this.db.close(); }

  async put(s: CardSession): Promise<void> { await this.db.put('sessions', s); }

  /** Newest first. */
  async list(): Promise<CardSession[]> { return (await this.db.getAllFromIndex('sessions', 'by_start')).reverse(); }

  async remove(id: string): Promise<void> { await this.db.delete('sessions', id); }

  async clear(): Promise<void> { await this.db.clear('sessions'); }

  async get<T>(key: string): Promise<T | undefined> { return (await this.db.get('kv', key)) as T | undefined; }
  async set(key: string, value: unknown): Promise<void> { await this.db.put('kv', value, key); }
}

// ── what the sessions add up to ─────────────────────────────────────

export interface GameProgress {
  game: GameId;
  sessions: number;
  /** the last session's ending level: the next one starts there */
  level: number;
  /** the best headline and its session's date (epoch s) */
  best: number | null;
  bestAt: number | null;
  /** the headline of every session, oldest first: [epoch s, value] */
  history: [number, number][];
  minutes: number;
}

/** Every game's plays across `sessions` (any order). */
export function progressOf(sessions: readonly CardSession[], headline: (p: GamePlay) => number): Map<GameId, GameProgress> {
  const out = new Map<GameId, GameProgress>();
  const sorted = [...sessions].sort((a, b) => a.start - b.start);
  for (const s of sorted) {
    for (const p of s.plays) {
      if (p.trials.length === 0) continue;
      const g = out.get(p.game) ?? { game: p.game, sessions: 0, level: 1, best: null, bestAt: null, history: [], minutes: 0 };
      const v = headline(p);
      g.sessions++;
      g.level = p.levelEnd || g.level;
      g.minutes += p.playedSec / 60;
      g.history.push([s.start, v]);
      if (g.best === null || v > g.best) { g.best = v; g.bestAt = s.start; }
      out.set(p.game, g);
    }
  }
  return out;
}

/** Days in a row with a card session, counting back from today (or yesterday, before today's first). */
export function cardStreak(sessions: readonly CardSession[], now = Date.now()): number {
  const key = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const days = new Set(sessions.map(s => key(s.start * 1000)));
  let t = now, n = 0;
  if (!days.has(key(t))) t -= 86_400_000;
  while (days.has(key(t))) { n++; t -= 86_400_000; }
  return n;
}

/** A session as a JSON file for analysis (every trial, the band's seconds), the same shape it is stored in. */
export const sessionJson = (s: CardSession): string => JSON.stringify(s, null, 1);

/** All trials of `sessions` as CSV rows: one per trial, with the session and game it belongs to. */
export function trialsCsv(sessions: readonly CardSession[]): string {
  const head = ['session', 'start_iso', 'kind', 'pad', 'game', 'trial', 'level', 'ok', 'rt_ms', 'taps', 'errors', 'cue', 'resp', 'congruent', 'async_ms', 'n', 'done', 'timeout', 'at_ms'];
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [head.join(',')];
  for (const s of sessions) {
    for (const p of s.plays) {
      for (const t of p.trials) {
        rows.push([s.id, new Date(s.start * 1000).toISOString(), s.kind, s.pad ?? '', p.game, t.i, t.level, t.ok ? 1 : 0, t.rt ?? '', t.taps, t.errors,
          t.cue, t.resp, t.cong === undefined ? '' : t.cong === 0 ? 1 : t.cong === 1 ? 0 : '', t.async, t.n, t.done, t.timeout ? 1 : '', t.at].map(esc).join(','));
      }
    }
  }
  return rows.join('\n') + '\n';
}
