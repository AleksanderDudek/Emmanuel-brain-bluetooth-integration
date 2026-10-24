/**
 * Geoda's data: the seed shapes (their cells in growth order, so every grown prefix is connected),
 * the five wall minerals with the facet patterns that tell them apart without colour, the cabinet's
 * nine specimens, the specimen tiers with their published odds and pity, the size classes of a
 * session's specimen, and the player-facing words.
 */

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
  name: string;
  /** capitalised, for headings */
  title: string;
  colors: [string, string, string];
  look: SpecimenLook;
}

/** Gablota: one set of nine specimens. */
export const MINERALS: Mineral[] = [
  { name: 'ametyst', title: 'Ametyst', colors: ['#d6b8ff', '#9b5de5', '#4b237f'], look: 'cluster' },
  { name: 'cytryn', title: 'Cytryn', colors: ['#fff0b8', '#ffc857', '#a8641a'], look: 'cluster' },
  { name: 'kwarc różowy', title: 'Kwarc różowy', colors: ['#ffe3ee', '#f4a6c1', '#9c4a6e'], look: 'cluster' },
  { name: 'akwamaryn', title: 'Akwamaryn', colors: ['#c8f3ff', '#4cc9f0', '#155b86'], look: 'prisms' },
  { name: 'malachit', title: 'Malachit', colors: ['#a8f5df', '#2ec4a0', '#0d5c4c'], look: 'botryoid' },
  { name: 'fluoryt', title: 'Fluoryt', colors: ['#c9c2ff', '#7b6cf6', '#2f8f78'], look: 'cubes' },
  { name: 'agat', title: 'Agat', colors: ['#f6dcc0', '#d0834e', '#6b3420'], look: 'bands' },
  { name: 'turmalin', title: 'Turmalin', colors: ['#ff8fb1', '#e0457a', '#2f9e62'], look: 'prisms' },
  { name: 'opal', title: 'Opal', colors: ['#f2f7ff', '#9fe7ff', '#ff9ad5'], look: 'opal' },
];

export const TIERS = ['zwykły', 'piękny', 'rzadki', 'muzealny'] as const;

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

/** Size classes of the session's specimen by carats (the HUD's "do dużego 12 ct"); `gen` = "do …". */
export const SIZES: { ct: number; name: string; gen: string }[] = [
  { ct: 0, name: 'drobny', gen: 'drobnego' },
  { ct: 30, name: 'mały', gen: 'małego' },
  { ct: 80, name: 'średni', gen: 'średniego' },
  { ct: 150, name: 'duży', gen: 'dużego' },
  { ct: 250, name: 'okazały', gen: 'okazałego' },
  { ct: 400, name: 'wielki', gen: 'wielkiego' },
];

export const CLARITY = ['', 'mleczny', 'czysty', 'lśniący'] as const;

/** Mental strategies offered at the start of a Wzrost (never "skup się mocniej"). */
export const STRATEGIES = [
  'Licz w myślach wstecz od 100 co 7.',
  'Zaplanuj w myślach następny ruch.',
  'Wyobraź sobie, jak kryształ rośnie komórka po komórce.',
  'Przypomnij sobie drogę z domu do pracy, krok po kroku.',
  'Policz w myślach kamienie w najbliższym rzędzie.',
];

export const REST_TIPS = [
  'Rozluźnij czoło i patrz miękko.',
  'Oddychaj zwyczajnie, niech myśli płyną.',
  'Opuść ramiona, rozluźnij szczękę.',
];
