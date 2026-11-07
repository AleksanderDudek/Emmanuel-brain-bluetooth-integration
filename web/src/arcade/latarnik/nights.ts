/**
 * Latarnik's nights (version 2): the level structure, pure and tested.  Like Knife Hit's stages and
 * Pop the Lock's locks, every night is one small, readable goal with a counter, and every fifth is
 * a boss: the squall.  They come in "rejsy" of five, each harder than the last:
 *
 *   1 Powroty   guide N boats home
 *   2 Mgła      find N fog-bound boats (dark until the beam passes over them within its reach)
 *   3 Flotylla  bring N flotillas home, each boat in its number's order
 *   4 Na ratunek  find pan Edek's rowboat (dark, drifting) N times
 *   5 Szkwał    guide N boats through a squall of telegraphed gusts
 *
 * Three stars per night: ★ the goal, ★★ at most one lantern lost, ★★★ a run of five perfects.
 * The beam turns a little faster night by night.  Nothing here touches the band: it only ever adds
 * reach (far and fog-bound boats are found sooner with focus), never a condition to pass.
 */
import { RULES } from './rules';

export type NightKind = 'powroty' | 'mgla' | 'flotylla' | 'ratunek' | 'szkwal';
export const NIGHT_KINDS: readonly NightKind[] = ['powroty', 'mgla', 'flotylla', 'ratunek', 'szkwal'];

export interface NightSpec {
  /** the night's index (0-based; the map shows n + 1) */
  readonly n: number;
  readonly kind: NightKind;
  /** the count the goal asks for (boats, fog-bound boats, flotillas, rescues) */
  readonly goal: number;
  /** the beam's turn this night (rad/s) */
  readonly speed: number;
  readonly boss: boolean;
  /** the whale may surface tonight */
  readonly whale: boolean;
  /** the rejs (a run of five nights), 0-based */
  readonly rejs: number;
}

export function nightSpec(n: number): NightSpec {
  const i = Math.max(0, Math.floor(n));
  const kind = NIGHT_KINDS[i % 5];
  const rejs = Math.floor(i / 5);
  const goal = kind === 'powroty' ? Math.min(14, 6 + 2 * rejs)
    : kind === 'mgla' ? Math.min(6, 3 + rejs)
      : kind === 'flotylla' ? Math.min(4, 2 + Math.floor(rejs / 2))
        : kind === 'ratunek' ? Math.min(3, 1 + Math.floor((rejs + 1) / 2))
          : Math.min(16, 8 + 2 * rejs);
  const speed = Math.min(RULES.speedMax, RULES.speed + RULES.speedStep * i);
  return { n: i, kind, goal, speed, boss: kind === 'szkwal', whale: i >= RULES.whaleFrom, rejs };
}

/** What a night counts toward its goal. */
export interface NightTally { got: number; lost: number; bestStreak: number }

/** The stars a won night earns: ★ the goal, ★★ at most one lantern lost, ★★★ five perfects in a row. */
export function starsFor(spec: NightSpec, t: NightTally): number {
  if (t.got < spec.goal) return 0;
  return 1 + (t.lost <= RULES.lostStar ? 1 : 0) + (t.bestStreak >= RULES.streakStar ? 1 : 0);
}

/** All the stars won (each night's best counts once). */
export const totalStars = (stars: readonly number[]): number => stars.reduce((s, x) => s + Math.max(0, Math.min(3, x | 0)), 0);
