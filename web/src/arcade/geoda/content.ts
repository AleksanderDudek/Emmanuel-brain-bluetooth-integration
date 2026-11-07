/**
 * Geoda's data: Block Blast's piece set (every orientation a piece of its own: the player never
 * rotates), the five crystal tiles with the cuts that tell them apart without colour, the four
 * jewels of the Wyprawa (Isaiah 54:12's stones), the cabinet's nine minerals and their tiers, the
 * chambers' names, the strategies the Mendi panel shows, and Bazyl's lines for every moment — all
 * player-facing words from the catalog (i18n.ts), in the page's language.
 */
import { CATALOGS, t, type GeodaKey } from './i18n';

export type Pt = readonly [number, number];
/** a crystal's clarity in the tile art: 1 milky, 2 clear, 3 brilliant */
export type Clarity = 1 | 2 | 3;

export interface Piece {
  id: string;
  cells: Pt[];
  w: number;
  h: number;
  /** how often the dealer draws it */
  weight: number;
}

/** Shift cells so the smallest x and y are 0. */
export function normalize(cells: readonly Pt[]): Pt[] {
  let mx = Infinity, my = Infinity;
  for (const [x, y] of cells) { mx = Math.min(mx, x); my = Math.min(my, y); }
  return cells.map(([x, y]) => [x - mx, y - my] as const);
}

/** The distinct orientations of a shape (rotations, and mirror images when `mirror`), cells sorted row by row. */
export function orientations(cells: readonly Pt[], mirror: boolean): Pt[][] {
  const out: Pt[][] = [], seen = new Set<string>();
  for (let k = 0; k < (mirror ? 8 : 4); k++) {
    const turned = normalize(cells.map(([x0, y0]) => {
      let x = k >= 4 ? -x0 : x0, y = y0;
      for (let r = 0; r < k % 4; r++) [x, y] = [-y, x];
      return [x, y] as const;
    })).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const key = turned.map(([x, y]) => `${x},${y}`).join(' ');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(turned);
    }
  }
  return out;
}

/** The base shapes and their total weight (split over their orientations). */
const BASE: { id: string; cells: Pt[]; weight: number; mirror?: boolean }[] = [
  { id: 'dot', cells: [[0, 0]], weight: 2 },
  { id: 'i2', cells: [[0, 0], [1, 0]], weight: 6 },
  { id: 'i3', cells: [[0, 0], [1, 0], [2, 0]], weight: 8 },
  { id: 'i4', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], weight: 6 },
  { id: 'i5', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], weight: 3 },
  { id: 'o2', cells: [[0, 0], [1, 0], [0, 1], [1, 1]], weight: 7 },
  { id: 'o3', cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], weight: 2.5 },
  { id: 'r23', cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], weight: 4 },
  { id: 'l3', cells: [[0, 0], [0, 1], [1, 1]], weight: 6 },
  { id: 'l4', cells: [[0, 0], [0, 1], [0, 2], [1, 2]], weight: 7, mirror: true },
  { id: 'l5', cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], weight: 3 },
  { id: 't4', cells: [[0, 0], [1, 0], [2, 0], [1, 1]], weight: 5 },
  { id: 's4', cells: [[1, 0], [2, 0], [0, 1], [1, 1]], weight: 4, mirror: true },
];

export const PIECES: Piece[] = BASE.flatMap(b => {
  const os = orientations(b.cells, !!b.mirror);
  return os.map((cells, k) => ({
    id: os.length > 1 ? `${b.id}.${k}` : b.id,
    cells,
    w: Math.max(...cells.map(c => c[0])) + 1,
    h: Math.max(...cells.map(c => c[1])) + 1,
    weight: b.weight / os.length,
  }));
});

export const pieceById = (id: string): Piece => PIECES.find(p => p.id === id) ?? PIECES[0];

export type Facet = 'point' | 'step' | 'prism' | 'cabochon' | 'banded';

export interface GemStyle { name: string; base: string; light: string; dark: string; facet: Facet }

/** The five crystal tiles a piece is made of (tile 1..5 = GEMS[0..4]). */
export const GEMS: GemStyle[] = [
  { name: 'ametyst', base: '#9b5de5', light: '#d6b8ff', dark: '#4b237f', facet: 'point' },
  { name: 'cytryn', base: '#ffc857', light: '#fff0b8', dark: '#a8641a', facet: 'step' },
  { name: 'akwamaryn', base: '#4cc9f0', light: '#c8f3ff', dark: '#155b86', facet: 'prism' },
  { name: 'kwarc różowy', base: '#f4a6c1', light: '#ffe3ee', dark: '#9c4a6e', facet: 'cabochon' },
  { name: 'malachit', base: '#2ec4a0', light: '#a8f5df', dark: '#0d5c4c', facet: 'banded' },
];

/** The Wyprawa's jewels (kind 1..4 = JEWELS[0..3]): the stones of Isaiah 54:11-12. */
export const JEWELS: { id: string; name: GeodaKey; color: string; light: string; dark: string }[] = [
  { id: 'sapphire', name: 'jewel.sapphire', color: '#3a6df0', light: '#b9d0ff', dark: '#14277a' },
  { id: 'ruby', name: 'jewel.ruby', color: '#e0325a', light: '#ffb3c4', dark: '#6e0d25' },
  { id: 'emerald', name: 'jewel.emerald', color: '#1fbf72', light: '#a9f5cd', dark: '#0b5a35' },
  { id: 'topaz', name: 'jewel.topaz', color: '#f2a516', light: '#ffe2a3', dark: '#86500a' },
];

export const jewelName = (kind: number): string => t(JEWELS[(kind - 1 + JEWELS.length) % JEWELS.length].name);

export type SpecimenLook = 'cluster' | 'cubes' | 'bands' | 'prisms' | 'opal' | 'botryoid';

export interface Mineral { id: string; title: string; colors: [string, string, string]; look: SpecimenLook }

/** Gablota: the nine minerals the Szlif polishes into the cabinet. */
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

/** The tiers' names, plainest first (zwykły, piękny, rzadki, muzealny). */
export const TIERS: readonly string[] = [t('tier.common'), t('tier.fine'), t('tier.rare'), t('tier.museum')];

/** The chambers of the Wyprawa: a name each, cycling after the last. */
export const CHAMBERS = 8;
export const chamberName = (level: number): string => t(`chamber.${level % CHAMBERS}` as GeodaKey);
export const chamberStory = (level: number): string => t(`story.${level % CHAMBERS}` as GeodaKey);

/** What the Mendi panel says to do in the head (never "harder"). */
export const TIPS = {
  warmup: t('task.warm'),
  firstPush: t('task.firstPush'),
  push: [t('task.count'), t('task.plan'), t('task.picture'), t('task.route'), t('task.words')],
  blind: [t('task.blind1'), t('task.blind2')],
  firstRest: t('task.firstRest'),
  rest: [t('task.breathe'), t('task.forehead'), t('task.listen'), t('task.shoulders')],
} as const;

/** Bazyl's moments. */
export type Moment =
  | 'open' | 'warm' | 'push' | 'blind' | 'rest' | 'good' | 'near' | 'big' | 'clean' | 'turn' | 'level' | 'polish' | 'jewel' | 'combo' | 'harvest' | 'end';

export const MOMENTS: readonly Moment[] = ['open', 'warm', 'push', 'blind', 'rest', 'good', 'near', 'big', 'clean', 'turn', 'level', 'polish', 'jewel', 'combo', 'harvest', 'end'];

/** Each moment's lines (three or more), from the catalog keys `say.<moment>.<n>`. */
export function linesFor(m: Moment): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const key = `say.${m}.${i}` as GeodaKey;
    if (!hasKey(key)) break;
    out.push(t(key));
  }
  return out;
}

const hasKey = (k: string): boolean => k in CATALOGS.pl;

export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(MOMENTS.map(m => [m, linesFor(m)])) as Record<Moment, string[]>;
