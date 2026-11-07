/**
 * Pan Guzik, the child's teddy bear, keeps watch with the angel (and claims most of the credit), and
 * the child mumbles in its sleep during the lullaby.  The moments they talk at and their lines (three
 * or more each, in the catalog), picked in turn so a line does not come back soon.
 */
import { t, type Key } from './i18n';

export type Moment =
  | 'open' | 'push' | 'blind' | 'rest' | 'good' | 'flame' | 'combo' | 'perfect' | 'near' | 'stir'
  | 'fresh' | 'boss' | 'phase' | 'bossDown' | 'gift' | 'end' | 'mumble';

/** Who says it: the bear, or the child in its sleep. */
export const WHO: Readonly<Record<Moment, 'bear' | 'child'>> = {
  open: 'bear', push: 'bear', blind: 'bear', rest: 'bear', good: 'bear', flame: 'bear', combo: 'bear', perfect: 'bear', near: 'bear',
  stir: 'bear', fresh: 'bear', boss: 'bear', phase: 'bear', bossDown: 'bear', gift: 'bear', end: 'bear', mumble: 'child',
};

/** How many lines each moment has in the catalog (say.<moment>.1 … .n). */
export const LINES: Readonly<Record<Moment, number>> = {
  open: 4, push: 4, blind: 3, rest: 3, good: 4, flame: 3, combo: 4, perfect: 3, near: 4, stir: 3,
  fresh: 3, boss: 3, phase: 3, bossDown: 3, gift: 3, end: 4, mumble: 5,
};

/** Moments that skip the queue and the gap between lines (a boss, the ending). */
export const URGENT: readonly Moment[] = ['boss', 'bossDown', 'end', 'phase'];

/** The `n`-th line of a moment (1-based, in turn). */
export function line(m: Moment, n: number): string {
  const k = LINES[m];
  const i = ((Math.max(1, Math.floor(n)) - 1) % k) + 1;
  return t(`say.${m}.${i}` as Key);
}
