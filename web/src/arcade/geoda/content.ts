/**
 * Geoda's data: the seed shapes (their cells in growth order, so every grown prefix is connected),
 * the five wall minerals with the facet patterns that tell them apart without colour, the cabinet's
 * nine specimens, the specimen tiers with their published odds and pity, the size classes of a
 * session's specimen, and the player-facing words (from the catalog, i18n.ts, in the page's language).
 */
import { t, type GeodaKey } from './i18n';

export type Pt = readonly [number, number];

export interface ShapeDef {
  id: string;
  /** cells in growth order: a seed starts as the first one and grows along the rest */
  cells: Pt[];
  /** how often the seed bag deals it */
  weight: number;
}

/** Block Blast's pieces, 3 to 5 cells (I5 is rare); the bag deals them in any orientation, the player never rotates. */
export const SHAPES: ShapeDef[] = [
  { id: 'I3', cells: [[0, 0], [1, 0], [2, 0]], weight: 14 },
  { id: 'L4', cells: [[0, 0], [0, 1], [0, 2], [1, 2]], weight: 14 },
  { id: 'T4', cells: [[0, 0], [1, 0], [2, 0], [1, 1]], weight: 12 },
  { id: 'S4', cells: [[2, 0], [1, 0], [1, 1], [0, 1]], weight: 10 },
  { id: 'O4', cells: [[0, 0], [1, 0], [1, 1], [0, 1]], weight: 12 },
  { id: 'P5', cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], weight: 9 },
  { id: 'L5', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]], weight: 9 },
  { id: 'U5', cells: [[0, 0], [0, 1], [1, 1], [2, 1], [2, 0]], weight: 9 },
  { id: 'I5', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], weight: 3 },
];

export type Facet = 'point' | 'step' | 'prism' | 'cabochon' | 'banded';

export interface GemStyle {
  name: string;
  /** the mineral's colour, a lighter and a darker tone for the facets */
  base: string;
  light: string;
  dark: string;
  /** the cut, so the minerals differ for colour-blind players too */
  facet: Facet;
}

/** The crystals that grow in the wall. */
export const GEMS: GemStyle[] = [
  { name: 'ametyst', base: '#9b5de5', light: '#d6b8ff', dark: '#4b237f', facet: 'point' },
  { name: 'cytryn', base: '#ffc857', light: '#fff0b8', dark: '#a8641a', facet: 'step' },
  { name: 'akwamaryn', base: '#4cc9f0', light: '#c8f3ff', dark: '#155b86', facet: 'prism' },
  { name: 'kwarc różowy', base: '#f4a6c1', light: '#ffe3ee', dark: '#9c4a6e', facet: 'cabochon' },
  { name: 'malachit', base: '#2ec4a0', light: '#a8f5df', dark: '#0d5c4c', facet: 'banded' },
];

export type SpecimenLook = 'cluster' | 'cubes' | 'bands' | 'prisms' | 'opal' | 'botryoid';

export interface Mineral {
  id: string;
  /** its name, capitalised (headings, the cabinet, the summary) */
  title: string;
  colors: [string, string, string];
  look: SpecimenLook;
}

/** Gablota: one set of nine specimens. */
export const MINERALS: Mineral[] = [
  { id: 'amethyst', title: t('mineral.amethyst'), colors: ['#d6b8ff', '#9b5de5', '#4b237f'], look: 'cluster' },
  { id: 'citrine', title: t('mineral.citrine'), colors: ['#fff0b8', '#ffc857', '#a8641a'], look: 'cluster' },
  { id: 'rose-quartz', title: t('mineral.roseQuartz'), colors: ['#ffe3ee', '#f4a6c1', '#9c4a6e'], look: 'cluster' },
  { id: 'aquamarine', title: t('mineral.aquamarine'), colors: ['#c8f3ff', '#4cc9f0', '#155b86'], look: 'prisms' },
  { id: 'malachite', title: t('mineral.malachite'), colors: ['#a8f5df', '#2ec4a0', '#0d5c4c'], look: 'botryoid' },
  { id: 'fluorite', title: t('mineral.fluorite'), colors: ['#c9c2ff', '#7b6cf6', '#2f8f78'], look: 'cubes' },
  { id: 'agate', title: t('mineral.agate'), colors: ['#f6dcc0', '#d0834e', '#6b3420'], look: 'bands' },
  { id: 'tourmaline', title: t('mineral.tourmaline'), colors: ['#ff8fb1', '#e0457a', '#2f9e62'], look: 'prisms' },
  { id: 'opal', title: t('mineral.opal'), colors: ['#f2f7ff', '#9fe7ff', '#ff9ad5'], look: 'opal' },
];

/** The specimen tiers' names, plainest first (zwykły, piękny, rzadki, muzealny). */
export const TIERS: readonly string[] = [t('tier.common'), t('tier.fine'), t('tier.rare'), t('tier.museum')];

/** Published odds of a specimen's tier at no bonus (they sum to 1). */
export const TIER_ODDS = [0.6, 0.28, 0.1, 0.02];
/** What full clarity and a long hold add to each tier (the plain tier gives it up). */
export const TIER_BONUS = [0, 0.1, 0.08, 0.04];
/** Pity: a specimen of this tier or better comes at the latest on this roll since the last one. */
export const PITY = [0, 5, 10, 20];
/** The first geodes a player cracks always hold a mineral the cabinet is missing. */
export const NEW_FIRST = 3;
/** Pył from a duplicate, per tier, and what crafts the next missing specimen. */
export const DUST = [5, 8, 12, 20];
export const CRAFT_DUST = 30;

/**
 * Size classes of the session's specimen by carats, each with the HUD's line for it ("Okaz drobny ·
 * do małego 20 ct": its size and what the next one needs; the largest has no next).
 */
export const SIZES: { ct: number; goal: GeodaKey }[] = [
  { ct: 0, goal: 'goal.tiny' },
  { ct: 30, goal: 'goal.small' },
  { ct: 80, goal: 'goal.medium' },
  { ct: 150, goal: 'goal.large' },
  { ct: 250, goal: 'goal.grand' },
  { ct: 400, goal: 'goal.giant' },
];

/** Clarity 1..3 by name (mleczny, czysty, lśniący); 0 is unused. */
export const CLARITY: readonly string[] = ['', t('clarity.milky'), t('clarity.clear'), t('clarity.brilliant')];

/** Mental strategies offered at the start of a Wzrost (never "skup się mocniej"). */
export const STRATEGIES: readonly string[] = [
  t('strategy.count'), t('strategy.plan'), t('strategy.picture'), t('strategy.route'), t('strategy.stones'),
];

/** The Szlif's words over the bowl: a way to let go. */
export const REST_TIPS: readonly string[] = [t('rest.forehead'), t('rest.breathe'), t('rest.shoulders')];
