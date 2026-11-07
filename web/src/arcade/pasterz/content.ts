/**
 * Pasterz's data: the eight hills of the map (each with its own lie of the land and a line of
 * story), the five rival shepherds (their dye, their comic habit), the cosmetics (cloaks, crooks
 * and Łatek's coats), the twelve lost lambs that get a name, the strategies under each block and
 * what Łatek the sheepdog says when.  The words live in the catalog (i18n.ts), in this page's
 * language.
 */
import { t, type Key } from './i18n';

// ── the hills ───────────────────────────────────────────────────
export type RiverKind = 'none' | 'v' | 'h';
export interface HillDef {
  index: number;
  name: string;
  story: string;
  river: RiverKind;
  bridges: number;
  pens: number;
  /** trees and rocks: 0..1 of their ranges */
  trees: number;
  rocks: number;
  /** the grass: light and dark */
  grass: [string, string];
}

const hill = (index: number, river: RiverKind, bridges: number, pens: number, trees: number, rocks: number, grass: [string, string]): HillDef =>
  ({ index, name: t(`hill.${index}` as Key), story: t(`hill.${index}.story` as Key), river, bridges, pens, trees, rocks, grass });

export const HILLS: readonly HillDef[] = [
  hill(0, 'none', 0, 2, 0.4, 0.3, ['#b9c274', '#9aa85a']),
  hill(1, 'v', 2, 2, 0.3, 0.8, ['#c7c27c', '#a8a25e']),
  hill(2, 'h', 3, 3, 0.7, 0.3, ['#a9c06c', '#8aa552']),
  hill(3, 'v', 3, 2, 0.2, 1, ['#bdbf86', '#9c9e68']),
  hill(4, 'none', 0, 4, 0.5, 0.4, ['#b2c878', '#93ab5c']),
  hill(5, 'h', 2, 3, 0.9, 0.5, ['#a3b866', '#84994c']),
  hill(6, 'v', 2, 3, 0.6, 0.7, ['#b6c37e', '#97a462']),
  hill(7, 'h', 3, 4, 0.5, 0.6, ['#c0c47a', '#a0a55c']),
];

export const hillAt = (i: number): HillDef => HILLS[((Math.floor(i) % HILLS.length) + HILLS.length) % HILLS.length];

// ── the shepherds ───────────────────────────────────────────────
export type Habit = 'nap' | 'snack' | 'chat' | 'bold' | 'timid';
export interface ShepherdDef { name: string; dye: string; habit: Habit; speed: number }

/** The player's dye (warm terracotta) and the loose sheep's undyed wool. */
export const PLAYER_DYE = '#ee7b30';
export const LOOSE_WOOL = '#f5eedf';

export const RIVALS: readonly ShepherdDef[] = [
  { name: t('rival.0'), dye: '#d1495b', habit: 'nap', speed: 0.94 },
  { name: t('rival.1'), dye: '#3a6fb0', habit: 'snack', speed: 0.97 },
  { name: t('rival.2'), dye: '#8a5cc2', habit: 'chat', speed: 1 },
  { name: t('rival.3'), dye: '#1f9e9a', habit: 'bold', speed: 1.03 },
  { name: t('rival.4'), dye: '#e06aa8', habit: 'timid', speed: 1.06 },
];

// ── the cosmetics ───────────────────────────────────────────────
export type SkinKind = 'cloak' | 'crook' | 'dog';
export interface Skin { kind: SkinKind; index: number; name: string; colors: string[] }

const skin = (kind: SkinKind, index: number, colors: string[]): Skin => ({ kind, index, name: t(`skin.${kind}.${index}` as Key), colors });

/** [mantle, stripe] */
export const CLOAKS: readonly Skin[] = [
  skin('cloak', 0, ['#c9b48a', '#5a4a7a']),
  skin('cloak', 1, ['#d8c9a8', '#b5523b']),
  skin('cloak', 2, ['#9fb4c7', '#2f4a6e']),
  skin('cloak', 3, ['#e3c26b', '#7a4a1e']),
  skin('cloak', 4, ['#c98f8a', '#4f2f45']),
  skin('cloak', 5, ['#f1ece0', '#2e6b5a']),
];
/** [wood, the crook's tip] */
export const CROOKS: readonly Skin[] = [
  skin('crook', 0, ['#6e4a28', '#6e4a28']),
  skin('crook', 1, ['#8a7a3a', '#c8b06a']),
  skin('crook', 2, ['#4a2e1c', '#d9a441']),
  skin('crook', 3, ['#a26b3c', '#f2e2b0']),
];
/** [coat, patches] */
export const DOGS: readonly Skin[] = [
  skin('dog', 0, ['#f4efe4', '#2d2622']),
  skin('dog', 1, ['#c8743a', '#f4e2c8']),
  skin('dog', 2, ['#2b2522', '#c98a4a']),
  skin('dog', 3, ['#e9e4d6', '#b9ad98']),
];

export const SKINS: Readonly<Record<SkinKind, readonly Skin[]>> = { cloak: CLOAKS, crook: CROOKS, dog: DOGS };

/** The order cosmetics come in, one every RULES.unlockEvery sheep (the first of each kind is owned from the start). */
export const UNLOCKS: readonly { kind: SkinKind; index: number }[] = [
  { kind: 'cloak', index: 1 }, { kind: 'dog', index: 1 }, { kind: 'crook', index: 1 },
  { kind: 'cloak', index: 2 }, { kind: 'dog', index: 2 }, { kind: 'crook', index: 2 },
  { kind: 'cloak', index: 3 }, { kind: 'dog', index: 3 }, { kind: 'crook', index: 3 },
  { kind: 'cloak', index: 4 }, { kind: 'cloak', index: 5 },
];

// ── the lost lambs ──────────────────────────────────────────────
export interface Lamb { index: number; name: string; bell: string }
const BELLS = ['#d9a441', '#c8553d', '#4f7cac', '#6a994e', '#b5838d', '#e07a5f', '#3d5a80', '#9c6644', '#81b29a', '#f2cc8f', '#7b2cbf', '#2a9d8f'];
export const LAMBS: readonly Lamb[] = BELLS.map((bell, index) => ({ index, name: t(`lamb.${index}` as Key), bell }));

// ── the strategies under each block (never "concentrate harder") ──
const keys = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, i) => t(`${prefix}.${i + 1}` as Key));
export const TIPS = {
  warmup: keys('tip.warmup', 3),
  call: keys('tip.call', 5),
  blind: keys('tip.blind', 2),
  watch: keys('tip.watch', 4),
} as const;

// ── Łatek, the sheepdog ─────────────────────────────────────────
export type Moment = 'open' | 'push' | 'ring' | 'voice' | 'rest' | 'star' | 'near' | 'big' | 'tumble' | 'lamb' | 'crown' | 'round' | 'end' | 'rival' | 'blind' | 'bleat';
export const MOMENTS: readonly Moment[] = ['open', 'push', 'ring', 'voice', 'rest', 'star', 'near', 'big', 'tumble', 'lamb', 'crown', 'round', 'end', 'rival', 'blind', 'bleat'];
/** variants per moment in the catalog (dog.<moment>.1 … .n) */
export const LINE_COUNT = 3;
export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(MOMENTS.map(m => [m, keys(`dog.${m}`, LINE_COUNT)])) as Record<Moment, string[]>;

/** The rivals' little bubbles. */
export type RivalSay = 'sulk' | 'got' | 'nap' | 'snack' | 'chat';
export const RIVAL_LINES: Readonly<Record<RivalSay, readonly string[]>> = {
  sulk: keys('rv.sulk', 3),
  got: keys('rv.got', 3),
  nap: keys('rv.nap', 2),
  snack: keys('rv.snack', 2),
  chat: keys('rv.chat', 2),
};
