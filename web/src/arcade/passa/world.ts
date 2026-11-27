/**
 * Złota passa's street in metres (DESIGN.md §26, builder B): one small European street seen from the pavement, looking
 * down it toward a little square and a church tower.  x across the street (left negative), y up, z away from the
 * viewer.  The facades stand at x = ±HALF, the road between the kerbs at ±KERB.  Pure data: scene.ts draws it.
 */

export const HALF = 5;
export const KERB = 3;
export const PAVE = 0.12;
/** The viewer: a little left of the street's middle, eyes at 1.55 m. */
export const CAM_X = -0.7;
export const EYE = 1.55;
/** Where the street's houses end and the square begins; the church's front. */
export const STREET_END = 46;
export const CHURCH_Z = 56;

export type Top = 'cornice' | 'attic' | 'gable' | 'step';
export type Shop = 'cafe' | 'bakery' | 'florist' | 'pharmacy' | 'books' | 'grocer' | 'door' | 'shop';

export interface House {
  s: -1 | 1;
  z0: number;
  z1: number;
  h: number;
  col: string;
  trim: string;
  top: Top;
  shop: Shop;
  /** shutters' colour ('' none) */
  shut: string;
  /** an awning's two colours ([] none; one colour: plain) */
  awn: string[];
}

export const HOUSES: readonly House[] = [
  // the left side (s = −1), near to far
  { s: -1, z0: 0, z1: 6.2, h: 13, col: '#d9a27e', trim: '#f3e6d2', top: 'cornice', shop: 'door', shut: '', awn: [] },
  { s: -1, z0: 6.2, z1: 11.6, h: 11.5, col: '#c9d6cf', trim: '#f6efe3', top: 'attic', shop: 'grocer', shut: '#4f7a6a', awn: ['#c45a48'] },
  { s: -1, z0: 11.6, z1: 17, h: 14.2, col: '#e6b8a8', trim: '#f8ede2', top: 'gable', shop: 'door', shut: '', awn: [] },
  { s: -1, z0: 17, z1: 23, h: 10.6, col: '#f0dcae', trim: '#fbf4e6', top: 'cornice', shop: 'bakery', shut: '#7a4a32', awn: ['#8c3a3a', '#f4e6cc'] },
  { s: -1, z0: 23, z1: 28.6, h: 12.6, col: '#b9c8d8', trim: '#f2f0ea', top: 'step', shop: 'books', shut: '', awn: [] },
  { s: -1, z0: 28.6, z1: 34.4, h: 11.2, col: '#e8c890', trim: '#faf1df', top: 'cornice', shop: 'pharmacy', shut: '#3f5f86', awn: [] },
  { s: -1, z0: 34.4, z1: 40.4, h: 13.4, col: '#efe5d6', trim: '#fbf6ee', top: 'gable', shop: 'door', shut: '', awn: [] },
  { s: -1, z0: 40.4, z1: 46, h: 10.4, col: '#dca59a', trim: '#f6e8dc', top: 'attic', shop: 'shop', shut: '', awn: [] },
  // the right side (s = +1)
  { s: 1, z0: 0, z1: 8.4, h: 12.2, col: '#cf8f6e', trim: '#f2e2d0', top: 'cornice', shop: 'door', shut: '#4f6a50', awn: [] },
  { s: 1, z0: 8.4, z1: 15.2, h: 11.2, col: '#f1d79a', trim: '#fbf3df', top: 'gable', shop: 'cafe', shut: '#4f7a6a', awn: ['#b8433b', '#f8efe0'] },
  { s: 1, z0: 15.2, z1: 20.8, h: 13.6, col: '#bcd0dc', trim: '#f4f3ee', top: 'cornice', shop: 'door', shut: '', awn: [] },
  { s: 1, z0: 20.8, z1: 26.4, h: 10.8, col: '#f3e9da', trim: '#fdfaf2', top: 'attic', shop: 'florist', shut: '#6a8a5a', awn: ['#5e8a62', '#eef2e0'] },
  { s: 1, z0: 26.4, z1: 32.4, h: 12.4, col: '#e3a790', trim: '#f8e8dc', top: 'step', shop: 'shop', shut: '', awn: [] },
  { s: 1, z0: 32.4, z1: 38.2, h: 14, col: '#a9bcc8', trim: '#f0eee8', top: 'cornice', shop: 'door', shut: '#3f5f86', awn: [] },
  { s: 1, z0: 38.2, z1: 46, h: 11.4, col: '#ecd08a', trim: '#fbf2da', top: 'gable', shop: 'shop', shut: '', awn: [] },
];

/** The houses round the square that face the viewer (z, x0..x1, height, colour). */
export const SQUARE: readonly { z: number; x0: number; x1: number; h: number; col: string; trim: string }[] = [
  { z: 50, x0: -16, x1: -5.6, h: 11, col: '#e4c39a', trim: '#f6ecdc' },
  { z: 50, x0: 5.6, x1: 16, h: 12, col: '#d7b0a2', trim: '#f6e6de' },
  { z: 53, x0: -22, x1: -16, h: 9, col: '#c8cdb8', trim: '#f0f0e4' },
  { z: 53, x0: 16, x1: 23, h: 10, col: '#e9dcc2', trim: '#f8f2e6' },
];

/** The church at the square's far side: the nave's front, the tower in its middle with a spire, a cross on top. */
export const CHURCH = { z: CHURCH_Z, x0: -6.4, x1: 6.4, h: 12.5, gable: 4.6, tx: 0.6, tw: 3.6, th: 27, spire: 9.5, col: '#e9dcc6', trim: '#fbf5ea', roof: '#5d8f84' } as const;

/** Lamps along the pavements (x, z). */
export const LAMPS: readonly { x: number; z: number }[] = [
  { x: 4.35, z: 7.2 }, { x: -4.35, z: 13.4 }, { x: 4.35, z: 19.6 }, { x: -4.35, z: 25.8 }, { x: 4.35, z: 32 }, { x: -4.35, z: 38.2 }, { x: 4.35, z: 44.2 },
];

/** Trees on the pavements (x, z, canopy radius, the canopy's centre height). */
export const TREES: readonly { x: number; z: number; r: number; cy: number }[] = [
  { x: -3.95, z: 10.2, r: 1.45, cy: 3.45 },
  { x: 3.95, z: 29.4, r: 1.3, cy: 3.3 },
];

export const BENCH = { x: -4.35, z0: 15, z1: 16.6 } as const;
export const BUS_STOP = { x: -4.7, z0: 4.6, z1: 7, pole: { x: -3.35, z: 4.2 } } as const;
export const CROSSING = { z0: 11.6, z1: 13.8 } as const;
export const TRAFFIC = { x: 3.35, z: 11.2, y0: 2.15, y1: 3.0 } as const;
/** The café's tables on the pavement, and the hanging sign (the day-streak) on its bracket. */
export const CAFE_TABLES: readonly { x: number; z: number }[] = [{ x: 3.85, z: 10.2 }, { x: 3.85, z: 12.9 }];
export const SIGN = { x: 4.25, y: 3.55, z: 9.0 } as const;
/** The florist's buckets on the pavement (z), the pigeons' patch, the cat's sill. */
export const BUCKETS: readonly number[] = [21.6, 22.3, 23.0, 23.7, 24.6, 25.3];
export const PIGEONS = { x0: 1.2, x1: 2.6, z0: 15.5, z1: 18 } as const;
export const CAT = { x: 4.86, y: 4.46, z: 16.75 } as const;

/**
 * The garland: one string zig-zagging across the street from facade to facade, near first (its anchors: x, y, z).  Each
 * span between two anchors holds `PER_SPAN` bulbs; the street shows the spans the day's wins need.
 */
export const ANCHORS: readonly [number, number, number][] = [
  [-HALF, 5.3, 8.4], [HALF, 5.4, 12.6], [-HALF, 5.3, 17.2], [HALF, 5.4, 22.2], [-HALF, 5.3, 27.6], [HALF, 5.4, 33.4],
];
export const PER_SPAN = 8;
export const SAG = 1.05;
