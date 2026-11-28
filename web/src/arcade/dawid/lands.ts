/**
 * Dawid's six lands as levels (round 25, DESIGN §29): each land a wide map of three named areas side by side (strips
 * of 46 u, the land 138 × 46 u; the lands of round 5 were 64 × 42), each area with its own shepherds' fire (the
 * camp travels with David: its buildings stand at every fire), its beast camps, brushwood and stone heaps, a chest,
 * the people of the story at their places and the landmarks that make it a place (Jesse's sheepfold, the well of
 * Bethlehem by the town gate, the brook of smooth stones, the vineyards, Saul's tents, the terebinth of Elah, the
 * walls of Gibeah and Michal's window, the stone Ezel, the wild goats' rocks, the cave, the spring of En-gedi, the
 * gate of Gath, burnt Ziklag…).  Between two areas a wall, a thorn hedge or a ridge runs from edge to edge with one
 * gap — the pass — closed until the land's chain reaches it.  The guardian's lair and the gate to the next land are
 * in the last area.  Paths (dusty tracks) join the fires and the passes.
 *
 * Coordinates are the land's (u, x to the right, y down); an area spans [x0, x1] and the whole height.
 */
import type { BeastKind, Ground, GuardKind, LandId, NodeKind } from './content';

/** What stands on the map and makes a place of it (paint.ts draws each). */
export type Landmark =
  | 'house' | 'fold' | 'well' | 'citywall' | 'tree' | 'thorns' | 'tents' | 'kingtent' | 'vines' | 'tower' | 'barley'
  | 'ezel' | 'cave' | 'spring' | 'goats' | 'ruins' | 'citygate' | 'milestone' | 'pebbles' | 'window' | 'lentils' | 'philistines'
  | 'gianttents';

/** A barrier between two areas: a dry-stone wall, a thorn hedge, a rocky ridge. */
export type Barrier = 'wall' | 'hedge' | 'ridge';

export interface AreaSpec {
  id: string;
  /** the strip (u) */
  x0: number;
  x1: number;
  /** the shepherds' fire */
  camp: readonly [number, number];
  /** beast camps: kind, x, y, how many */
  dens: readonly (readonly [BeastKind, number, number, number])[];
  nodes: readonly (readonly [NodeKind, number, number])[];
  /** where the land's chest lies while David is in this area */
  chest: readonly [number, number];
  /** places the quests send David to (people stand at some of them) */
  spots: Readonly<Record<string, readonly [number, number]>>;
  /** who stands at a spot (a look in paint.ts) */
  people?: Readonly<Record<string, string>>;
  landmarks: readonly (readonly [Landmark, number, number, number?])[];
  /** the pass on the area's right edge (x1) to the next area: its y and the barrier's look */
  pass?: { y: number; barrier: Barrier };
}

export interface LandMap {
  id: LandId;
  ground: Ground;
  w: number;
  h: number;
  guard: GuardKind;
  lair: readonly [number, number];
  /** the gate out to the next land (on the right edge) */
  gate: readonly [number, number];
  brook: readonly (readonly [number, number])[];
  /** dusty tracks (polylines) */
  paths: readonly (readonly (readonly [number, number])[])[];
  areas: readonly AreaSpec[];
}

/** How far a landmark reaches (u): decorations and paths keep clear of it. */
export const LANDMARK_R: Readonly<Record<Landmark, number>> = {
  house: 2, window: 2, fold: 3, well: 2, citywall: 5, citygate: 4, tree: 2, thorns: 1.6, tents: 4, gianttents: 4.5, kingtent: 2.5,
  vines: 5, tower: 1.5, barley: 4.5, lentils: 3.5, ezel: 2.5, cave: 5.5, spring: 4, goats: 2.5, ruins: 4.5, milestone: 1, pebbles: 1.8,
  philistines: 13,
};

/** An area's width (u) and a land's height. */
export const AREA_W = 46;
export const LAND_H = 46;
/** the pass's half-width (u): the gap in the barrier */
export const PASS_HALF = 2.4;

export const MAPS: readonly LandMap[] = [
  // ── 1 · the pastures of Bethlehem (1 Sam 16; the lion) ─────────────
  {
    id: 'pastwiska', ground: 'pasture', w: 138, h: 46, guard: 'lew', lair: [128, 9], gate: [137.5, 20],
    brook: [[0, 12], [14, 10], [30, 14], [46, 19], [60, 25], [76, 24], [92, 30], [104, 34], [118, 30], [138, 36]],
    paths: [[[8, 26], [26, 24], [46, 22], [54, 22], [66, 18], [80, 12], [86, 22], [92, 30], [100, 24], [116, 22], [137, 20]]],
    areas: [
      {
        id: 'owczarnia', x0: 0, x1: 46, camp: [8, 26],
        dens: [['szakal', 20, 14, 4], ['szakal', 24, 38, 4], ['szerszen', 33, 22, 5], ['szakal', 40, 10, 4], ['szakal', 38, 32, 4]],
        nodes: [['wood', 14, 40], ['wood', 32, 6], ['wood', 16, 6], ['stone', 4, 38], ['stone', 28, 30], ['stone', 12, 10]],
        chest: [42, 42],
        spots: { jesse: [12, 19], thorns: [42, 38] },
        people: { jesse: 'jesse' },
        landmarks: [['house', 8, 15], ['fold', 17, 32], ['tree', 31, 17], ['thorns', 42, 39]],
        pass: { y: 22, barrier: 'wall' },
      },
      {
        id: 'studnia', x0: 46, x1: 92, camp: [54, 22],
        dens: [['szakal', 63, 31, 4], ['szerszen', 75, 22, 6], ['wilk', 86, 36, 3], ['szakal', 70, 42, 4], ['szerszen', 60, 8, 5]],
        nodes: [['wood', 50, 38], ['wood', 88, 20], ['wood', 58, 14], ['stone', 70, 6], ['stone', 80, 44], ['stone', 56, 30]],
        chest: [50, 8],
        spots: { well: [66, 15], starzec: [82, 13], asahel: [77, 37] },
        people: { well: 'dziewczyna', starzec: 'starzec', asahel: 'asahel' },
        landmarks: [['well', 66, 12.5], ['citywall', 80, 6], ['tree', 77, 34], ['house', 88, 8]],
        pass: { y: 30, barrier: 'wall' },
      },
      {
        id: 'potok', x0: 92, x1: 138, camp: [100, 24],
        dens: [['wilk', 108, 13, 3], ['wilk', 114, 41, 4], ['szakal', 122, 24, 5], ['wilk', 132, 36, 4], ['szerszen', 104, 40, 5]],
        nodes: [['wood', 96, 42], ['wood', 124, 4], ['wood', 104, 30], ['stone', 112, 27], ['stone', 135, 28], ['stone', 98, 14]],
        chest: [96, 6],
        spots: { ewe: [124, 41], brook: [110, 31] },
        landmarks: [['pebbles', 110, 33], ['thorns', 130, 6], ['tree', 118, 14]],
      },
    ],
  },
  // ── 2 · the hills of Judah (1 Sam 16:14-23; the she-bear) ──────────
  {
    id: 'wzgorza', ground: 'hills', w: 138, h: 46, guard: 'niedzwiedzica', lair: [128, 34], gate: [137.5, 40],
    brook: [[20, 0], [24, 12], [34, 18], [50, 24], [66, 22], [80, 30], [98, 26], [112, 34], [124, 46]],
    paths: [[[8, 12], [14, 22], [30, 30], [46, 30], [54, 30], [66, 26], [84, 18], [92, 18], [100, 18], [116, 17], [126, 26], [137, 40]]],
    areas: [
      {
        id: 'winnice', x0: 0, x1: 46, camp: [8, 12],
        dens: [['dzik', 22, 38, 2], ['zmija', 30, 9, 3], ['dzik', 38, 22, 3], ['hiena', 41, 38, 4], ['zmija', 14, 32, 3]],
        nodes: [['wood', 5, 30], ['wood', 28, 44], ['wood', 20, 16], ['stone', 20, 5], ['stone', 42, 6], ['stone', 6, 22]],
        chest: [4, 42],
        spots: { sluga: [16, 21], vines: [27, 29] },
        people: { sluga: 'sluga' },
        landmarks: [['vines', 27, 29], ['tower', 33, 25], ['house', 13, 28]],
        pass: { y: 30, barrier: 'ridge' },
      },
      {
        id: 'trakt', x0: 46, x1: 92, camp: [54, 30],
        dens: [['zmija', 64, 21, 3], ['hiena', 76, 33, 4], ['dzik', 86, 41, 3], ['zmija', 80, 7, 3], ['hiena', 60, 42, 4]],
        nodes: [['wood', 50, 8], ['wood', 70, 44], ['wood', 54, 20], ['stone', 62, 12], ['stone', 89, 28], ['stone', 58, 36]],
        chest: [74, 42],
        spots: { abiszaj: [70, 8], donkey: [53, 41], milestone: [84, 16] },
        people: { abiszaj: 'abiszaj' },
        landmarks: [['milestone', 85, 14], ['tree', 72, 13], ['house', 50, 44]],
        pass: { y: 18, barrier: 'ridge' },
      },
      {
        id: 'przelecz', x0: 92, x1: 138, camp: [100, 18],
        dens: [['hiena', 108, 30, 4], ['dzik', 113, 41, 3], ['hiena', 131, 23, 5], ['zmija', 104, 5, 3], ['dzik', 120, 30, 3]],
        nodes: [['wood', 96, 40], ['wood', 134, 8], ['wood', 96, 8], ['stone', 112, 22], ['stone', 99, 33], ['stone', 106, 12]],
        chest: [118, 44],
        spots: { harp: [121, 15] },
        people: { harp: 'saul' },
        landmarks: [['tents', 112, 8], ['kingtent', 122, 11], ['tents', 130, 8]],
      },
    ],
  },
  // ── 3 · the Valley of Elah (1 Sam 17; Goliath) ──────────────────────
  {
    id: 'ela', ground: 'valley', w: 138, h: 46, guard: 'goliat', lair: [124, 22], gate: [137.5, 22],
    brook: [[0, 24], [16, 23], [30, 21], [46, 22], [62, 24], [78, 22], [92, 23], [110, 21], [124, 22], [138, 21]],
    paths: [[[8, 30], [22, 14], [38, 10], [46, 27], [54, 30], [70, 30], [92, 30], [100, 32], [112, 26], [137, 22]]],
    areas: [
      {
        id: 'oboz', x0: 0, x1: 46, camp: [8, 31],
        dens: [['skorpion', 18, 39, 3], ['sep', 26, 17, 2], ['hiena', 36, 33, 4], ['skorpion', 42, 41, 3], ['skorpion', 40, 16, 3]],
        nodes: [['wood', 5, 18], ['wood', 30, 42], ['wood', 14, 26], ['stone', 14, 44], ['stone', 24, 29], ['stone', 4, 42]],
        chest: [44, 7],
        spots: { eliab: [20, 9], soldiers: [30, 11], saul: [37, 7] },
        people: { eliab: 'eliab', soldiers: 'zolnierz', saul: 'saul' },
        landmarks: [['tents', 12, 4], ['tents', 22, 4], ['tents', 30, 5], ['kingtent', 37, 3.5]],
        pass: { y: 30, barrier: 'ridge' },
      },
      {
        id: 'terebint', x0: 46, x1: 92, camp: [54, 31],
        dens: [['sep', 62, 37, 3], ['hiena', 76, 35, 4], ['skorpion', 84, 10, 3], ['sep', 60, 8, 2], ['skorpion', 86, 40, 3]],
        nodes: [['wood', 51, 42], ['wood', 72, 44], ['wood', 52, 16], ['stone', 66, 40], ['stone', 78, 5], ['stone', 60, 30]],
        chest: [90, 30],
        spots: { s1: [57, 22.5], s2: [65, 25.5], s3: [72, 21], s4: [80, 24], s5: [87, 20.5] },
        landmarks: [['tree', 70, 13, 1.4], ['pebbles', 64, 26], ['pebbles', 82, 25]],
        pass: { y: 30, barrier: 'ridge' },
      },
      {
        id: 'pole', x0: 92, x1: 138, camp: [100, 32],
        dens: [['skorpion', 104, 8, 3], ['hiena', 116, 37, 4], ['sep', 130, 10, 3], ['skorpion', 134, 34, 3]],
        nodes: [['wood', 96, 44], ['wood', 120, 4], ['wood', 100, 24], ['stone', 108, 41], ['stone', 98, 18], ['stone', 106, 30]],
        chest: [96, 6],
        spots: { goliath: [113, 25], jonatan: [104, 13] },
        people: { jonatan: 'jonatan' },
        landmarks: [['philistines', 116, 43], ['tents', 108, 3]],
      },
    ],
  },
  // ── 4 · the fields of Gibeah (1 Sam 18–20; the great aurochs) ───────
  {
    id: 'gibea', ground: 'fields', w: 138, h: 46, guard: 'tur', lair: [130, 40], gate: [137.5, 10],
    brook: [[0, 20], [12, 22], [26, 19], [38, 12], [46, 8], [60, 4], [74, 10], [90, 14], [104, 24], [120, 30], [138, 26]],
    paths: [[[8, 30], [24, 26], [46, 34], [54, 34], [66, 22], [70, 14], [80, 26], [92, 28], [100, 28], [114, 21], [137, 10]]],
    areas: [
      {
        id: 'pola', x0: 0, x1: 46, camp: [8, 30],
        dens: [['tur', 26, 42, 2], ['szerszen', 17, 9, 6], ['dzik', 37, 33, 3], ['tur', 40, 17, 2], ['szerszen', 30, 24, 5]],
        nodes: [['wood', 5, 41], ['wood', 30, 5], ['wood', 6, 20], ['stone', 14, 44], ['stone', 43, 42], ['stone', 14, 30], ['stone', 22, 12]],
        chest: [28, 14],
        spots: { women: [18, 20] },
        people: { women: 'kobieta' },
        landmarks: [['barley', 21, 36], ['barley', 34, 41], ['tree', 11, 14]],
        pass: { y: 34, barrier: 'hedge' },
      },
      {
        id: 'mury', x0: 46, x1: 92, camp: [54, 34],
        dens: [['szerszen', 60, 25, 6], ['dzik', 74, 42, 3], ['tur', 87, 24, 3], ['szerszen', 88, 41, 6], ['dzik', 62, 44, 3]],
        nodes: [['wood', 50, 44], ['wood', 69, 31], ['wood', 52, 24], ['stone', 50, 12], ['stone', 84, 14], ['stone', 66, 38]],
        chest: [48, 22],
        spots: { rope: [61, 13], mikal: [72, 12], barley: [80, 35] },
        people: { mikal: 'mikal' },
        landmarks: [['citywall', 64, 5], ['citywall', 80, 5], ['window', 72, 9], ['house', 60, 10], ['barley', 80, 35]],
        pass: { y: 28, barrier: 'hedge' },
      },
      {
        id: 'ezel', x0: 92, x1: 138, camp: [100, 28],
        dens: [['tur', 106, 41, 3], ['szerszen', 108, 9, 7], ['tur', 128, 30, 3], ['dzik', 134, 4, 3]],
        nodes: [['wood', 96, 8], ['wood', 122, 44], ['wood', 100, 38], ['stone', 104, 19], ['stone', 135, 18], ['stone', 96, 20]],
        chest: [96, 44],
        spots: { ezel: [113, 20], a1: [123, 11], a2: [127, 23], a3: [119, 34] },
        people: { ezel: 'jonatan' },
        landmarks: [['ezel', 116, 18], ['tree', 108, 30]],
      },
    ],
  },
  // ── 5 · the wilderness of En-gedi (1 Sam 21–25; the leopard) ────────
  {
    id: 'engedi', ground: 'desert', w: 138, h: 46, guard: 'lampart', lair: [129, 15], gate: [137.5, 40],
    brook: [[138, 30], [126, 28], [118, 32], [106, 30], [96, 36], [86, 40], [70, 44], [60, 46]],
    paths: [[[8, 12], [20, 26], [46, 24], [54, 24], [66, 22], [78, 30], [92, 32], [100, 32], [114, 30], [137, 40]]],
    areas: [
      {
        id: 'skaly', x0: 0, x1: 46, camp: [8, 12],
        dens: [['zmija', 15, 25, 3], ['karakal', 25, 16, 3], ['skorpion', 30, 34, 4], ['karakal', 42, 17, 3], ['skorpion', 40, 40, 3]],
        nodes: [['wood', 20, 4], ['wood', 6, 40], ['wood', 4, 24], ['stone', 35, 25], ['stone', 44, 5], ['stone', 16, 4]],
        chest: [22, 44],
        spots: { achimelek: [14, 36], benajasz: [32, 42] },
        people: { achimelek: 'achimelek', benajasz: 'benajasz' },
        landmarks: [['goats', 28, 6], ['goats', 38, 30], ['house', 12, 33]],
        pass: { y: 24, barrier: 'ridge' },
      },
      {
        id: 'jaskinia', x0: 46, x1: 92, camp: [54, 24],
        dens: [['skorpion', 60, 35, 4], ['zmija', 80, 26, 4], ['karakal', 88, 9, 3], ['skorpion', 52, 42, 3], ['zmija', 72, 42, 3]],
        nodes: [['wood', 58, 3], ['wood', 86, 44], ['wood', 52, 14], ['stone', 64, 30], ['stone', 77, 33], ['stone', 50, 32]],
        chest: [48, 8],
        spots: { cave: [72, 10], hill: [85, 37], w1: [62, 13], w2: [80, 15], w3: [66, 43] },
        landmarks: [['cave', 72, 6, 1.4], ['goats', 86, 30]],
        pass: { y: 32, barrier: 'ridge' },
      },
      {
        id: 'zrodlo', x0: 92, x1: 138, camp: [100, 32],
        dens: [['karakal', 110, 23, 4], ['zmija', 130, 37, 4], ['skorpion', 104, 43, 4], ['karakal', 120, 7, 3]],
        nodes: [['wood', 96, 8], ['wood', 134, 44], ['wood', 98, 40], ['stone', 112, 4], ['stone', 136, 25], ['stone', 108, 34]],
        chest: [94, 20],
        spots: { abigail: [104, 15], kid: [117, 41] },
        people: { abigail: 'abigail' },
        landmarks: [['spring', 121, 27, 1.2], ['goats', 130, 10]],
      },
    ],
  },
  // ── 6 · the land of Gath (1 Sam 21:10-15, 27, 30; the giant of Gath) ─
  {
    id: 'gat', ground: 'gath', w: 138, h: 46, guard: 'olbrzym', lair: [126, 22], gate: [137.5, 22],
    brook: [[0, 32], [18, 30], [34, 34], [50, 31], [66, 33], [80, 30], [96, 34], [112, 31], [138, 33]],
    paths: [[[8, 20], [20, 14], [30, 12], [40, 22], [46, 22], [54, 22], [68, 19], [84, 24], [92, 24], [100, 24], [137, 22]]],
    areas: [
      {
        id: 'brama', x0: 0, x1: 46, camp: [8, 20],
        dens: [['wilk', 20, 31, 4], ['hiena', 34, 24, 5], ['sep', 40, 39, 3], ['wilk', 12, 41, 4], ['hiena', 42, 12, 4]],
        nodes: [['wood', 5, 34], ['wood', 26, 43], ['wood', 20, 20], ['stone', 40, 4], ['stone', 44, 30], ['stone', 6, 10]],
        chest: [4, 6],
        spots: { itaj: [16, 12], achisz: [30, 11] },
        people: { itaj: 'itaj', achisz: 'achisz' },
        landmarks: [['citygate', 30, 5], ['citywall', 16, 4], ['citywall', 42, 4]],
        pass: { y: 22, barrier: 'wall' },
      },
      {
        id: 'ziklag', x0: 46, x1: 92, camp: [54, 22],
        dens: [['wilk', 64, 31, 4], ['hiena', 79, 26, 5], ['sep', 87, 11, 3], ['wilk', 78, 43, 4], ['hiena', 50, 40, 4]],
        nodes: [['wood', 50, 7], ['wood', 70, 42], ['wood', 56, 32], ['stone', 64, 4], ['stone', 90, 22], ['stone', 52, 14]],
        chest: [48, 32],
        spots: { ziklag: [69, 18], flock: [86, 38], home: [65, 21], szamma: [58, 40] },
        people: { szamma: 'szamma' },
        landmarks: [['ruins', 71, 13], ['lentils', 58, 38]],
        pass: { y: 24, barrier: 'wall' },
      },
      {
        id: 'obozowisko', x0: 92, x1: 138, camp: [100, 24],
        dens: [['wilk', 108, 12, 4], ['hiena', 110, 37, 5], ['sep', 120, 31, 3], ['wilk', 134, 8, 4]],
        nodes: [['wood', 96, 40], ['wood', 116, 44], ['wood', 96, 14], ['stone', 104, 4], ['stone', 136, 41], ['stone', 106, 28]],
        chest: [94, 8],
        spots: {},
        landmarks: [['gianttents', 124, 9], ['gianttents', 130, 37]],
      },
    ],
  },
];

/** The area a point lies in (its index). */
export function areaAt(map: LandMap, x: number): number {
  for (let i = 0; i < map.areas.length; i++) if (x < map.areas[i].x1) return i;
  return map.areas.length - 1;
}

/** Every spot of a land (the areas' spots in one record; ids are unique within a land). */
export function allSpots(map: LandMap): Record<string, readonly [number, number]> {
  const out: Record<string, readonly [number, number]> = {};
  for (const a of map.areas) Object.assign(out, a.spots);
  return out;
}

/** The area a spot belongs to (-1: none). */
export function spotArea(map: LandMap, id: string): number {
  return map.areas.findIndex(a => id in a.spots);
}
