/**
 * Dolina's data: the three eras of the valley of the shadow (Psalm 23:4 — never called anything
 * else), the shadows that walk each of them (ink, smoke and ember eyes, shaped by their age; they
 * dissolve into light, no gore), the guardians at the end of each era and their telegraphed moves,
 * the weapon's tiers, the upgrades bought between runs, the pilgrim's looks, the levels' layout
 * (which era, which floor holds a guardian) and the lines under a block's name.  The words live in
 * the catalog (i18n.ts).
 */
import { t, type Key } from './i18n';
import { RULES } from './rules';

export type EraId = 'babel' | 'twierdza' | 'miasto';
export const ERAS: readonly EraId[] = ['babel', 'twierdza', 'miasto'];

/**
 * The shadows: a walker of each era (it walks at him; the staff strikes it, a jump onto it stomps it)
 * and the era's special — the brick thrower of Babel (bricks roll along the road: jump), the crow of
 * the fortress (flies at him at chest height: strike it or jump it), the notification of the city
 * (floats at jump height and stays put: do not jump into it — or stomp it from above), the scroller
 * (a fast walker that pulls him back).
 */
export type ShadowKind = 'glinianek' | 'ceglomiot' | 'giermek' | 'kruk' | 'pling' | 'przewijacz';
export type HarmKind = 'shadow' | 'roll' | 'crow' | 'pling' | 'guard' | 'pit';

/** A kind's light (in strikes of the expected weapon), pace toward him (u/s), half width and height (u), how high it floats (u), its sparks and its harm. */
export interface ShadowSpec { strikes: number; speed: number; r: number; h: number; air: number; sparks: number; harm: HarmKind }

export const SHADOWS: Readonly<Record<ShadowKind, ShadowSpec>> = {
  glinianek: { strikes: 1, speed: 1.0, r: 0.32, h: 0.95, air: 0, sparks: 1, harm: 'shadow' },
  ceglomiot: { strikes: 2, speed: 0, r: 0.36, h: 1.15, air: 0, sparks: 2, harm: 'shadow' },
  giermek: { strikes: 2, speed: 0.8, r: 0.36, h: 1.1, air: 0, sparks: 2, harm: 'shadow' },
  kruk: { strikes: 1, speed: 3.2, r: 0.3, h: 0.45, air: 0.55, sparks: 2, harm: 'crow' },
  pling: { strikes: 1, speed: 0, r: 0.3, h: 0.6, air: RULES.plingY, sparks: 2, harm: 'pling' },
  przewijacz: { strikes: 1, speed: 1.8, r: 0.34, h: 0.7, air: 0, sparks: 2, harm: 'shadow' },
};

/** The walker and the special of each era. */
export const ERA_SHADOWS: Readonly<Record<EraId, { walker: ShadowKind; special: ShadowKind }>> = {
  babel: { walker: 'glinianek', special: 'ceglomiot' },
  twierdza: { walker: 'giermek', special: 'kruk' },
  miasto: { walker: 'przewijacz', special: 'pling' },
};

export type GuardId = 'wieza' | 'rycerz' | 'ekran';
export const GUARDS: Readonly<Record<EraId, GuardId>> = { babel: 'wieza', twierdza: 'rycerz', miasto: 'ekran' };

/**
 * A guardian's moves, each telegraphed: a low throw along the road (one jump), a tall wall (both
 * jumps), a high beam at head height (stay on the road — a jump runs into it), a pair (a low one, then
 * a wall: jump, then jump again in the air), and its opening (the weak point comes down: the staff
 * strikes, a stomp hits three times as hard).
 */
export type MoveKind = 'roll' | 'wall' | 'high' | 'pair' | 'open';
export const SEQ: Readonly<Record<GuardId, { calm: readonly MoveKind[]; angry: readonly MoveKind[] }>> = {
  wieza: { calm: ['roll', 'roll', 'wall', 'open'], angry: ['roll', 'wall', 'pair', 'open'] },
  rycerz: { calm: ['high', 'roll', 'pair', 'open'], angry: ['high', 'wall', 'high', 'pair', 'open'] },
  ekran: { calm: ['roll', 'high', 'wall', 'open'], angry: ['pair', 'high', 'wall', 'roll', 'open'] },
};

/** What the hands do against a move (the coach's words). */
export type Answer = 'jump' | 'double' | 'stay' | 'pair' | 'open';
export const ANSWER: Readonly<Record<MoveKind, Answer>> = { roll: 'jump', wall: 'double', high: 'stay', pair: 'pair', open: 'open' };

// ── the levels ───────────────────────────────────────────────────
/** A level's era (index): three levels each, round and round. */
export const eraOfLevel = (level: number): number => Math.floor((Math.max(1, level) - 1) / RULES.guardEvery) % ERAS.length;
/** How many times the valley has been crossed before this level (the lap: harder). */
export const lapOfLevel = (level: number): number => Math.floor((Math.max(1, level) - 1) / (RULES.guardEvery * ERAS.length));
/** The last level of each era ends at its guardian. */
export const guardLevel = (level: number): boolean => level >= 1 && level % RULES.guardEvery === 0;

export const eraName = (e: EraId): string => t(`era.${e}`);
export const shadowName = (k: ShadowKind): string => t(`s.${k}`);
export const guardName = (g: GuardId): string => t(`g.${g}`);

// ── the weapon ───────────────────────────────────────────────────
/** The weapon's power at a tier (1-based; past the table it keeps growing). */
export function powerOf(tier: number): number {
  const P = RULES.power, i = Math.max(1, Math.round(tier)) - 1;
  if (i < P.length) return P[i];
  return Math.round(P[P.length - 1] * 1.33 ** (i - P.length + 1));
}
/** The weapon's name at a tier: the staff, the shod staff, the sword, the sword of dawn (and its number). */
export function weaponName(tier: number): string {
  const k = Math.min(3, Math.floor((Math.max(1, tier) - 1) / 3));
  const n = (Math.max(1, tier) - 1) % 3 + 1;
  return t('weapon', { name: t(`weapon.${k}` as Key), n: ['I', 'II', 'III'][n - 1] });
}

// ── the upgrades between runs ────────────────────────────────────
/** Kamieniarz (stones per block), Kuźnia (the weapon a level starts with), Iskry (sparks), Knot (the lamp), Oliwa (harm). */
export type UpId = 'stone' | 'forge' | 'income' | 'lamp' | 'oil';
export const UPGRADES: readonly UpId[] = ['stone', 'forge', 'income', 'lamp', 'oil'];
export const upName = (id: UpId): string => t(`up.${id}`);
export const upText = (id: UpId): string => t(`up.${id}.text`);

// ── the pilgrim's looks ──────────────────────────────────────────
/** cloak → traveller → lamplighter → keeper of the dawn: named in plain craft words */
export const lookName = (i: number): string => t(`look.${Math.max(0, Math.min(3, i))}` as Key);

/** The line under the block's name: strategies to try, never "concentrate harder". */
export const TIPS = {
  warmup: ['tip.warmup.1', 'tip.warmup.2'],
  push: ['tip.push.1', 'tip.push.2', 'tip.push.3', 'tip.push.4', 'tip.push.5'],
  blind: ['tip.blind.1', 'tip.blind.2'],
  rest: ['tip.rest.1', 'tip.rest.2', 'tip.rest.3'],
  firstPush: 'tip.firstPush',
  firstRest: 'tip.firstRest',
} as const satisfies Record<string, Key | readonly Key[]>;
