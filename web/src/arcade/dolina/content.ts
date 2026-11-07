/**
 * Dolina's data: the three eras of the valley of the shadow (Psalm 23:4 — never called anything
 * else), the shadows that walk each of them (ink, smoke and ember eyes, shaped by their age; they
 * dissolve into light, no gore), the guardians at each era's end, the upgrades bought between runs,
 * the pilgrim's looks, and the lines under a block's name.  The words live in the catalog (i18n.ts).
 */
import { t } from './i18n';

export type EraId = 'babel' | 'twierdza' | 'miasto';
export const ERAS: readonly EraId[] = ['babel', 'twierdza', 'miasto'];

export type ShadowKind = 'glinianek' | 'ceglomiot' | 'giermek' | 'kruk' | 'pling' | 'przewijacz';
export type HarmKind = 'shadow' | 'brick' | 'crow' | 'pling' | 'squire' | 'scroll' | 'pit' | 'beam' | 'guard';

/**
 * A kind's light (hits), its pace toward the pilgrim (u/s), half its width and its height (u), how
 * high it floats (u), the sparks it leaves and the harm it does at a touch.
 */
export interface ShadowSpec { hp: number; speed: number; r: number; h: number; air: number; sparks: number; harm: HarmKind; era: EraId }

export const SHADOWS: Readonly<Record<ShadowKind, ShadowSpec>> = {
  // Babel: clay that walks, clay that throws bricks
  glinianek: { hp: 1, speed: 1.0, r: 0.32, h: 0.95, air: 0, sparks: 1, harm: 'shadow', era: 'babel' },
  ceglomiot: { hp: 1, speed: 0, r: 0.36, h: 1.15, air: 0, sparks: 2, harm: 'shadow', era: 'babel' },
  // the burned fortress: a squire of soot with a shield that breaks, crows that dive
  giermek: { hp: 2, speed: 0.8, r: 0.36, h: 1.1, air: 0, sparks: 3, harm: 'squire', era: 'twierdza' },
  kruk: { hp: 1, speed: 1.6, r: 0.3, h: 0.45, air: 2.5, sparks: 2, harm: 'crow', era: 'twierdza' },
  // the city of screens: a notification that pops up in front of you, a hand that scrolls you back
  pling: { hp: 1, speed: 0, r: 0.3, h: 0.6, air: 0.75, sparks: 1, harm: 'pling', era: 'miasto' },
  przewijacz: { hp: 1, speed: 1.5, r: 0.34, h: 0.7, air: 0, sparks: 2, harm: 'scroll', era: 'miasto' },
};

/** The shadows of an era, with their weights on the road. */
export const ERA_SHADOWS: Readonly<Record<EraId, readonly [ShadowKind, number][]>> = {
  babel: [['glinianek', 3], ['ceglomiot', 1.4]],
  twierdza: [['giermek', 2.2], ['kruk', 2]],
  miasto: [['pling', 2.4], ['przewijacz', 1.8]],
};

export type GuardId = 'wieza' | 'rycerz' | 'ekran';
export const GUARDS: Readonly<Record<EraId, GuardId>> = { babel: 'wieza', twierdza: 'rycerz', miasto: 'ekran' };

/** A guardian's moves, telegraphed: what the hands answer with (the HUD's hint says it too). */
export type MoveKind = 'rain' | 'roll' | 'strike' | 'heavy' | 'plings' | 'sweep' | 'open';
/** The guardians' patterns, calm and angry; each ends with its weak point open. */
export const SEQ: Readonly<Record<GuardId, { calm: readonly MoveKind[]; angry: readonly MoveKind[] }>> = {
  // the tower: bricks rain on him (slash them as they fall), bricks roll at him (jump), then the seam glows
  wieza: { calm: ['rain', 'rain', 'rain', 'roll', 'roll', 'open'], angry: ['rain', 'rain', 'roll', 'rain', 'rain', 'roll', 'open'] },
  // the knight: three blows (slash as each lands to parry, or slide), a heavy sweep (jump), then he is open
  rycerz: { calm: ['strike', 'strike', 'strike', 'heavy', 'open'], angry: ['strike', 'strike', 'strike', 'heavy', 'strike', 'heavy', 'open'] },
  // the screen: notifications (slash), a beam at head height (slide), then it loads and is open
  ekran: { calm: ['plings', 'sweep', 'plings', 'sweep', 'open'], angry: ['plings', 'sweep', 'sweep', 'plings', 'sweep', 'open'] },
};

/** What the hands do against a move (the hint's key). */
export type Hint = 'slash' | 'jump' | 'slide' | 'lamp' | 'parry' | 'open';
export const MOVE_HINT: Readonly<Record<MoveKind, Hint>> = {
  rain: 'slash', roll: 'jump', strike: 'parry', heavy: 'jump', plings: 'slash', sweep: 'slide', open: 'open',
};

export const eraName =(e: EraId): string => t(`era.${e}`);
export const shadowName = (k: ShadowKind): string => t(`s.${k}`);
export const guardName = (g: GuardId): string => t(`g.${g}`);

// ── the upgrades between runs ────────────────────────────────────
export type UpId = 'sword' | 'lamp' | 'oil' | 'boots' | 'dawn';
export const UPGRADES: readonly UpId[] = ['sword', 'lamp', 'oil', 'boots', 'dawn'];
export const upName = (id: UpId): string => t(`up.${id}`);
export const upText = (id: UpId): string => t(`up.${id}.text`);

// ── the pilgrim's looks ──────────────────────────────────────────
/** cloak → traveller → lamplighter → keeper of the dawn: named in plain craft words */
export const LOOKS: readonly string[] = [t('look.0'), t('look.1'), t('look.2'), t('look.3')];

/** The line under the block's name: strategies to try, never "concentrate harder". */
export const TIPS = {
  warmup: [t('tip.warmup.1'), t('tip.warmup.2'), t('tip.warmup.3')],
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;
