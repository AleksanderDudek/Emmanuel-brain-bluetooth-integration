/**
 * Anioł Stróż's data: the Zmory (shadows of a child's bad dreams — ink, smoke and ember eyes, no
 * gore), the gifts a level-up offers for the night, the angel's ranks across nights, the cosy
 * things the room gains with them, and the lines under a block's name.  The words live in the
 * catalog (i18n.ts), in this page's language.
 */
import { t } from './i18n';

import type { PassageId } from '../kit/scripture';

export type ZKind = 'mara' | 'skoczek' | 'widmo' | 'pancerna' | 'roj' | 'cien' | 'fikolek' | 'kleks' | 'ciagutek' | 'szept' | 'ramie' | 'koszmar';

/** A kind's light (hits), walk (u/s), size (u), feathers when banished and how much it dims Sen at the bed. */
export interface ZSpec { hp: number; speed: number; r: number; feathers: number; dim: number }

export const ZMORY: Readonly<Record<ZKind, ZSpec>> = {
  mara: { hp: 1, speed: 0.95, r: 0.32, feathers: 1, dim: 0.12 },
  skoczek: { hp: 1, speed: 1.05, r: 0.3, feathers: 2, dim: 0.12 },
  widmo: { hp: 2, speed: 0.85, r: 0.34, feathers: 2, dim: 0.14 },
  pancerna: { hp: 2, speed: 0.6, r: 0.42, feathers: 4, dim: 0.2 },
  roj: { hp: 1, speed: 0.75, r: 0.46, feathers: 1, dim: 0.15 },
  cien: { hp: 1, speed: 1.35, r: 0.2, feathers: 1, dim: 0.06 },
  fikolek: { hp: 2, speed: 1.0, r: 0.3, feathers: 3, dim: 0.12 },
  kleks: { hp: 1, speed: 0.8, r: 0.33, feathers: 3, dim: 0.1 },
  ciagutek: { hp: 3, speed: 0.55, r: 0.4, feathers: 4, dim: 0.12 },
  szept: { hp: 1, speed: 1.15, r: 0.28, feathers: 2, dim: 0.1 },
  ramie: { hp: 2, speed: 1.15, r: 0.3, feathers: 2, dim: 0.12 },
  koszmar: { hp: 12, speed: 0.6, r: 0.85, feathers: 15, dim: 0.22 },
};

export const zName = (k: ZKind): string => t(`z.${k}`);

/** The kinds a coach mark explains the first time they step out (their tell and their counter). */
export const TOLD: readonly ZKind[] = ['skoczek', 'widmo', 'pancerna', 'roj', 'fikolek', 'kleks', 'ciagutek', 'szept'];

// ── the dreams (the nights as chapters) ──────────────────────────
export type ChapterId = 'pokoj' | 'strych' | 'las' | 'morze' | 'obloki';
export type BossKind = 'koszmar' | 'kufer' | 'wilk' | 'osmiornica' | 'burza';

/**
 * A dream: where the child's sleep takes the room, its great nightmare at the night's end, the kinds
 * it brings in (each chapter teaches one or two, kishōtenketsu) and the passage of its story card.
 */
export interface Chapter { id: ChapterId; boss: BossKind; fresh: readonly ZKind[]; verse: PassageId }

export const CHAPTERS: readonly Chapter[] = [
  { id: 'pokoj', boss: 'koszmar', fresh: ['mara', 'skoczek', 'widmo', 'pancerna'], verse: 'psa4.8' },
  { id: 'strych', boss: 'kufer', fresh: ['kleks', 'roj'], verse: 'psa139.12' },
  { id: 'las', boss: 'wilk', fresh: ['fikolek', 'szept'], verse: 'psa23.4' },
  { id: 'morze', boss: 'osmiornica', fresh: ['ciagutek'], verse: 'isa43.2' },
  { id: 'obloki', boss: 'burza', fresh: [], verse: 'psa19.1' },
];

export const chapterName = (c: ChapterId): string => t(`ch.${c}`);
export const bossName = (b: BossKind): string => t(`boss.${b}`);

// ── the upgrade tree (bought in the lobby with feathers) ─────────
export type UpId = 'reach' | 'perfect' | 'aura' | 'flame' | 'sen' | 'lull';
export type Branch = 'wing' | 'light' | 'dream';

/** An upgrade: its branch and the one before it on the branch (it needs a level there first). */
export interface Up { id: UpId; branch: Branch; needs: UpId | null }

export const UPS: readonly Up[] = [
  { id: 'reach', branch: 'wing', needs: null },
  { id: 'perfect', branch: 'wing', needs: 'reach' },
  { id: 'aura', branch: 'light', needs: null },
  { id: 'flame', branch: 'light', needs: 'aura' },
  { id: 'sen', branch: 'dream', needs: null },
  { id: 'lull', branch: 'dream', needs: 'sen' },
];

// ── the gifts of a night ─────────────────────────────────────────
export type GiftId = 'reach' | 'double' | 'shield' | 'aura' | 'spear' | 'flame' | 'lamp' | 'sen';

/** A gift: how many times a night it can be taken, and the rank (0-based) that brings it into the pool. */
export interface Gift { id: GiftId; max: number; rank: number; name: string; text: string }

const gift = (id: GiftId, max: number, rank: number): Gift => ({ id, max, rank, name: t(`gift.${id}`), text: t(`gift.${id}.text`) });

/** In the order the pool grows; 'sen' (the dream refreshed) is always there, so a choice never runs dry. */
export const GIFTS: readonly Gift[] = [
  gift('reach', 3, 0),
  gift('double', 1, 0),
  gift('shield', 1, 0),
  gift('aura', 2, 0),
  gift('sen', 99, 0),
  gift('spear', 1, 1),
  gift('flame', 2, 2),
  gift('lamp', 1, 3),
];

export const giftById = (id: GiftId): Gift => GIFTS.find(g => g.id === id)!;

// ── the angel's rank across nights ───────────────────────────────
/** Ranks are named in light words (a spark, a candle, the dawn), never holiness words. */
export const RANKS: readonly string[] = Array.from({ length: 8 }, (_, i) => t(`rank.${i}` as 'rank.0'));

/** The cosy things of the room, one with each rank from the second (index = rank − 1). */
export type RoomItem = 'mobile' | 'nightlight' | 'book' | 'blanket' | 'nightcap' | 'curtain' | 'garland';
export const ROOM: readonly RoomItem[] = ['mobile', 'nightlight', 'book', 'blanket', 'nightcap', 'curtain', 'garland'];
export const roomName = (i: RoomItem): string => t(`room.${i}`);

/** The line under the block's name: strategies to try, never "concentrate harder". */
export const TIPS = {
  warmup: [t('tip.warmup.1'), t('tip.warmup.2'), t('tip.warmup.3')],
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;
