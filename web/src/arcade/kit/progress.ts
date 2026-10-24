/**
 * What an arcade game remembers between sessions (records, collection, unlocks, the daily
 * challenge) — a small JSON object per game in IndexedDB's settings store, key "arcade:<id>".
 * Loading merges the saved object over fresh defaults, so a newer version of a game that adds a
 * field still reads an older save.
 */
import type { SessionDB } from '../../storage/db';

type Settings = Pick<SessionDB, 'getSetting' | 'setSetting'>;

const key = (id: string) => `arcade:${id}`;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** `fresh` over `saved`, one level deep for nested plain objects (arrays and values are taken as saved). */
export function mergeSaved<T extends object>(fresh: T, saved: unknown): T {
  if (!isObj(saved)) return fresh;
  const out: Record<string, unknown> = { ...(fresh as Record<string, unknown>) };
  for (const [k, v] of Object.entries(saved)) {
    const base = (fresh as Record<string, unknown>)[k];
    out[k] = isObj(base) && isObj(v) ? { ...base, ...v } : v;
  }
  return out as T;
}

export async function loadProgress<T extends object>(db: Settings, id: string, fresh: () => T): Promise<T> {
  try {
    return mergeSaved(fresh(), await db.getSetting<unknown>(key(id)));
  } catch {
    return fresh();   // a private window without IndexedDB: play anyway, without memory
  }
}

export async function saveProgress<T extends object>(db: Settings, id: string, p: T): Promise<void> {
  await db.setSetting(key(id), JSON.parse(JSON.stringify(p)));
}

/** Local calendar day "YYYY-MM-DD". */
export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A stable 32-bit seed for a game and a day: everybody's "today" is the same challenge. */
export function daySeed(id: string, day = dayKey()): number {
  let h = 2166136261;
  for (const c of `${id}|${day}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
