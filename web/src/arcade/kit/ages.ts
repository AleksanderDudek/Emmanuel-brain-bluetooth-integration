/**
 * The age groups the player may pick once for every game that tells everyday life (DESIGN.md §28, §29): Stop-klatka's
 * stories and Złota passa's day are fitted to them.  The founder's groups (2026-11-27): 11–19, 20–26, 27–35, 36–50, 50+.
 *
 * The choice is shared on this device (`emmanuel.age.v1`): picked in one game's lobby, it is the default in the others;
 * a game may still keep its own copy in its progress.  Nothing about it leaves the device or enters a result.
 */
export const AGES = ['teen', 'young', 'adult', 'mid', 'senior'] as const;
export type Age = (typeof AGES)[number];

/** What each group spans (shown on its chip). */
export const AGE_SPAN: Readonly<Record<Age, string>> = { teen: '11–19', young: '20–26', adult: '27–35', mid: '36–50', senior: '50+' };

export const isAge = (v: unknown): v is Age => typeof v === 'string' && (AGES as readonly string[]).includes(v);

const KEY = 'emmanuel.age.v1';

/** The group this device chose, or null if none yet (or storage is unavailable). */
export function loadAge(): Age | null {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    return isAge(v) ? v : null;
  } catch {
    return null;
  }
}

/** Remember the group for every game on this device. */
export function saveAge(a: Age): void {
  try {
    globalThis.localStorage?.setItem(KEY, a);
  } catch {
    /* private mode: the game's own progress still keeps it */
  }
}
