/**
 * Jerzy i smok's data: the four dragons of the kingdom (each a beast with its own patterns and its
 * flaw — beaten and driven off over the hills, never killed), their towns and arenas, the skills a
 * level-up offers for the fight, the armoury that keeps a few of them for good, the strategies
 * under a block's name, and Princess Linda's lines for every moment of a fight.  The words live in
 * the catalog (i18n.ts), in this page's language.
 */
import { t, type Key } from './i18n';

// ── the dragons ──────────────────────────────────────────────────
export type DragonKind = 'zielony' | 'bagienny' | 'skrzydlaty' | 'trzyglowy';
export type Pattern = 'breath' | 'sweep' | 'bite' | 'balls' | 'dive' | 'swoop' | 'rain';
export type ArenaKind = 'meadow' | 'marsh' | 'pass' | 'castle';

/**
 * A dragon: its body's radius (u), its pace (× the base), its scales per phase, the patterns of each
 * phase with their weights, the pattern after which it is open (its flaw), and the fireballs of a volley.
 */
export interface DragonSpec {
  kind: DragonKind;
  arena: ArenaKind;
  r: number;
  pace: number;
  hp: readonly number[];
  patterns: readonly (readonly [Pattern, number])[][];
  flaw: Pattern;
  balls: number;
}

export const DRAGONS: readonly DragonSpec[] = [
  {
    kind: 'zielony', arena: 'meadow', r: 1.0, pace: 1, hp: [55, 65], flaw: 'breath', balls: 3,
    patterns: [[['breath', 3], ['bite', 2], ['sweep', 1.4]], [['breath', 3], ['sweep', 2], ['bite', 2]]],
  },
  {
    kind: 'bagienny', arena: 'marsh', r: 1.0, pace: 1.05, hp: [80, 90, 100], flaw: 'dive', balls: 3,
    patterns: [[['balls', 3], ['dive', 2], ['bite', 1]], [['balls', 3], ['dive', 2.5], ['breath', 1]], [['balls', 3], ['dive', 3], ['breath', 1.5]]],
  },
  {
    kind: 'skrzydlaty', arena: 'pass', r: 1.05, pace: 1.1, hp: [90, 100, 110], flaw: 'swoop', balls: 4,
    patterns: [[['swoop', 3], ['rain', 2], ['breath', 1]], [['swoop', 3], ['rain', 2.5], ['breath', 1.5]], [['swoop', 3.5], ['rain', 3], ['sweep', 1]]],
  },
  {
    kind: 'trzyglowy', arena: 'castle', r: 1.25, pace: 1.1, hp: [100, 110, 125], flaw: 'breath', balls: 4,
    patterns: [[['breath', 3], ['balls', 2], ['bite', 2]], [['balls', 3], ['breath', 2], ['sweep', 1.5]], [['breath', 2], ['balls', 2], ['bite', 2], ['sweep', 2]]],
  },
];

/** The warm-up's patterns: the bite and a slow breath, so the first minute teaches rather than burns. */
export const WARM_PATTERNS: readonly (readonly [Pattern, number])[] = [['bite', 2], ['breath', 1.5]];

export const dragonName = (k: DragonKind): string => t(`dragon.${k}` as Key);
export const townName = (k: DragonKind): string => t(`town.${k}` as Key);
export const townStory = (k: DragonKind): string => t(`story.${k}` as Key);

// ── the skills of a fight ────────────────────────────────────────
export type SkillId = 'spin' | 'lance' | 'horse' | 'squire' | 'swift' | 'bigShield' | 'reflect' | 'armour' | 'reach' | 'apple';

/** A skill: how many levels a fight can stack, its name and what it does. */
export interface Skill { id: SkillId; max: number; name: string; text: string }

const skill = (id: SkillId, max: number): Skill => ({ id, max, name: t(`skill.${id}` as Key), text: t(`skill.${id}.text` as Key) });

/** 'apple' (Linda's apple: the heart refilled) is always there, so a choice never runs dry. */
export const SKILLS: readonly Skill[] = [
  skill('bigShield', 3),
  skill('squire', 2),
  skill('lance', 3),
  skill('spin', 2),
  skill('horse', 2),
  skill('reflect', 2),
  skill('swift', 3),
  skill('reach', 2),
  skill('armour', 2),
  skill('apple', 99),
];

export const skillById = (id: SkillId): Skill => SKILLS.find(s => s.id === id)!;

/** The armoury: one skill kept for good with every dragon driven off, in this order (it starts each fight at level 1). */
export const ARMOURY: readonly SkillId[] = ['bigShield', 'squire', 'lance', 'spin', 'horse', 'reflect', 'swift', 'reach'];

// ── the strategies under a block's name (never "concentrate harder") ──
export const TIPS = {
  warmup: [t('tip.warmup.1'), t('tip.warmup.2'), t('tip.warmup.3')],
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5'), t('tip.push.6')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3'), t('tip.rest.4')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;

// ── Princess Linda's lines ───────────────────────────────────────
export type Moment =
  | 'open' | 'arrive' | 'warm' | 'push' | 'blind' | 'rest' | 'good' | 'quench' | 'near' | 'sword'
  | 'phase' | 'driven' | 'down' | 'flaw' | 'level' | 'end' | 'tip.zielony' | 'tip.bagienny' | 'tip.skrzydlaty' | 'tip.trzyglowy';

/** How many variants each moment has in the catalog (`say.<moment>.<i>`, i from 1). */
export const LINE_COUNT: Readonly<Record<Moment, number>> = {
  open: 4, arrive: 3, warm: 3, push: 4, blind: 3, rest: 4, good: 4, quench: 4, near: 3, sword: 3,
  phase: 3, driven: 3, down: 3, flaw: 3, level: 3, end: 3, 'tip.zielony': 3, 'tip.bagienny': 3, 'tip.skrzydlaty': 3, 'tip.trzyglowy': 3,
};

export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(
  (Object.keys(LINE_COUNT) as Moment[]).map(m => [m, Array.from({ length: LINE_COUNT[m] }, (_, i) => t(`say.${m}.${i + 1}` as Key))]),
) as unknown as Record<Moment, readonly string[]>;
