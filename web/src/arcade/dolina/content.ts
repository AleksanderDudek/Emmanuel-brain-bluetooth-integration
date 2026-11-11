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
export type HarmKind = 'shadow' | 'roll' | 'crow' | 'pling' | 'guard' | 'pit' | 'pend';

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

/** The guardians: one at the end of each era, and Kukułka (the cuckoo clock), the clock tower's own keeper. */
export type GuardId = 'wieza' | 'rycerz' | 'ekran' | 'kukulka';
export const GUARDS: Readonly<Record<EraId, GuardId>> = { babel: 'wieza', twierdza: 'rycerz', miasto: 'ekran' };
/** The tower's keepers, every fifth floor in turn. */
export const KEEPERS: readonly GuardId[] = ['wieza', 'rycerz', 'ekran', 'kukulka'];
/** The era a guardian belongs to (Kukułka stands in the city's tower). */
export const GUARD_ERA: Readonly<Record<GuardId, EraId>> = { wieza: 'babel', rycerz: 'twierdza', ekran: 'miasto', kukulka: 'miasto' };

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
  // the minute hand sweeps at head height (stay down), the hour hand along the floor (jump), the weight (both jumps); the cuckoo's door opens
  kukulka: { calm: ['high', 'roll', 'high', 'wall', 'open'], angry: ['pair', 'high', 'roll', 'high', 'wall', 'open'] },
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

// ── the pilgrim's looks (v3: forms, each with a perk) ────────────
/** cloak → traveller → lamplighter → keeper of the dawn → guide → master of the lamp: plain craft words */
export const LOOKS = 6;
export const lookName = (i: number): string => t(`look.${Math.max(0, Math.min(LOOKS - 1, i))}` as Key);
/** The perk a form brings (none for the first). */
export const perkText = (i: number): string => (i >= 1 && i < LOOKS ? t(`perk.${i}` as Key) : '');

// ── v3: the companions ───────────────────────────────────────────
/**
 * Six companions found in the valley, each lost in the dark and freed from a cage of smoke: Głaz
 * (a gentle giant, afraid of the dark and of moths), Babcia (a grandmother with an umbrella), Bóbr
 * (a beaver and a perfectionist builder), Zegarmistrz (the watchmaker whose watches are all five
 * seconds late), Kozica (a mountain goat who eats everything), Wiewiórka (a squirrel who hides
 * everything and finds half).  They run behind the pilgrim, help strike a block he is stopped at, and
 * each carries one power that fires by itself when charged (the original's god skills, without gods).
 */
export type CompId = 'glaz' | 'babcia' | 'bobr' | 'zegar' | 'kozica' | 'wiewiorka';
export const COMPS: readonly CompId[] = ['glaz', 'babcia', 'bobr', 'zegar', 'kozica', 'wiewiorka'];
export type PowerId = 'huk' | 'parasol' | 'rusztowanie' | 'pauza' | 'szarza' | 'zapasy';
export const POWER: Readonly<Record<CompId, PowerId>> = {
  glaz: 'huk', babcia: 'parasol', bobr: 'rusztowanie', zegar: 'pauza', kozica: 'szarza', wiewiorka: 'zapasy',
};
export const isComp = (v: unknown): v is CompId => typeof v === 'string' && (COMPS as readonly string[]).includes(v);
export const compName = (id: CompId): string => t(`c.${id}`);
export const compText = (id: CompId): string => t(`c.${id}.text`);
export const powerName = (id: CompId): string => t(`pw.${POWER[id]}`);
/** What the power does at a bond level (level 3 changes it). */
export const powerText = (id: CompId, lv: number): string => t(lv >= 3 ? `pw.${POWER[id]}.3` : `pw.${POWER[id]}.text`);

// ── v3: the clock tower ──────────────────────────────────────────
/**
 * The tower's floors are trials (Firebound's "boss and trial floors"): a quarry of blocks, a bridge
 * of planks that fall behind you, swinging clock weights, a gallery of gates ending at a giant block,
 * pens full of lambs, a dark floor where only the lamp shows the way, a floor where the dark rises
 * fast — and every fifth floor a keeper.
 */
export type FloorKind = 'quarry' | 'bridge' | 'pendulum' | 'gates' | 'pens' | 'dark' | 'tide' | 'keeper';
export const TRIALS: readonly FloorKind[] = ['quarry', 'bridge', 'pendulum', 'gates', 'pens', 'dark', 'tide'];
export const floorName = (k: FloorKind): string => t(`fl.${k}`);
export const floorRule = (k: FloorKind): string => t(`fl.${k}.rule`);

// ── v3: gear, provisions ─────────────────────────────────────────
/** Four slots: the blade (strikes faster), the cloak (less harm), the sandals (faster), the lamp (the Świt sooner). */
export type GearSlot = 'blade' | 'cloak' | 'sandals' | 'lamp';
export const GEAR: readonly GearSlot[] = ['blade', 'cloak', 'sandals', 'lamp'];
export const gearName = (s: GearSlot): string => t(`gear.${s}`);
export const gearText = (s: GearSlot): string => t(`gear.${s}.text`);
/** A tier's name (1 common … 6 radiant), in craft words. */
export const tierName = (tier: number): string => t(`tier.${Math.max(1, Math.min(6, Math.round(tier)))}` as Key);
/** Provisions for three runs. */
export type BuffId = 'honey' | 'raisins' | 'dates';
export const BUFFS: readonly BuffId[] = ['honey', 'raisins', 'dates'];
export const buffName = (b: BuffId): string => t(`buff.${b}`);
export const buffText = (b: BuffId): string => t(`buff.${b}.text`);

// ── v3: missions ─────────────────────────────────────────────────
export type MissionKind = 'blocks' | 'lambs' | 'doubles' | 'gates' | 'stomps' | 'stairs' | 'floors' | 'guards' | 'metres' | 'powers' | 'rests';
export const MISSIONS: readonly MissionKind[] = ['blocks', 'lambs', 'doubles', 'gates', 'stomps', 'stairs', 'floors', 'guards', 'metres', 'powers', 'rests'];
/** The goals each kind climbs through (a mission drawn later asks the next rung). */
export const MISSION_GOALS: Readonly<Record<MissionKind, readonly number[]>> = {
  blocks: [25, 40, 60, 90],
  lambs: [5, 8, 12, 16],
  doubles: [8, 15, 25, 35],
  gates: [3, 5, 8, 12],
  stomps: [4, 8, 12, 18],
  stairs: [5, 7, 9, 11],
  floors: [3, 5, 8, 12],
  guards: [1, 2, 3, 4],
  metres: [800, 1500, 2500, 4000],
  powers: [6, 12, 20, 30],
  rests: [3, 5, 8, 12],
};
/** A mission's words ("Rozbij 25 kamieni"). */
export const missionText = (kind: MissionKind, goal: number): string => t(`mi.${kind}`, { n: goal });

/** The line under the block's name: strategies to try, never "concentrate harder". */
export const TIPS = {
  warmup: ['tip.warmup.1', 'tip.warmup.2'],
  push: ['tip.push.1', 'tip.push.2', 'tip.push.3', 'tip.push.4', 'tip.push.5'],
  blind: ['tip.blind.1', 'tip.blind.2'],
  rest: ['tip.rest.1', 'tip.rest.2', 'tip.rest.3'],
  firstPush: 'tip.firstPush',
  firstRest: 'tip.firstRest',
} as const satisfies Record<string, Key | readonly Key[]>;
