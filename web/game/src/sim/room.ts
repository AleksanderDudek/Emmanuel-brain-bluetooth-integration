/**
 * Room layouts: hand-drawn 9 × 15 templates ('#' wall, 'S' shadow portal,
 * 'G' grace spot, 'A' altar, 'P' start), mirrored at random, with light seeds
 * sprinkled on free cells like Pac-Man's dots.  The door is always at the top.
 */
import type { Rect } from './geom';
import { Rng } from './rng';

export const ROOM_W = 9;
export const ROOM_H = 15;
export const DOOR = { x: ROOM_W / 2, y: 0, halfWidth: 0.9 };
export const START = { x: ROOM_W / 2, y: ROOM_H - 1.2 };

export type RoomKind = 'battle' | 'sabbath' | 'chapel' | 'boss' | 'rescue';

const BATTLE_TEMPLATES: string[][] = [
  [ // Nawa — a nave with two rows of pillars
    '...S.S...', '.........', 'G.#...#.G', '.........', '..#...#..', '.........', '.........',
    '..#...#..', '.........', '.........', '..#...#..', '.........', 'G.......G', '.........', '....P....'],
  [ // Krzyż — a cross in the middle
    'S.......S', '.........', '.G.....G.', '.........', '....#....', '....#....', '..#####..',
    '....#....', '....#....', '.........', '.........', '.........', '.G.....G.', '.........', '....P....'],
  [ // Ławy — pews
    '.S.....S.', '.........', 'G.......G', '.##...##.', '.........', '.##...##.', '.........',
    '.##...##.', '.........', '.##...##.', '.........', '.........', '.........', '.........', '....P....'],
  [ // Ogród — scattered stones
    'S...S...S', '.........', '..#...#..', '.#.....#.', '.........', '....#....', '.G.....G.',
    '.........', '..#...#..', '.........', '#...#...#', '.........', '.........', '.........', '....P....'],
  [ // Labirynt — Pac-Man corridors
    'S.......S', '.###.###.', '.........', '.#.###.#.', '.#.....#.', '.#.#.#.#.', '...#.#...',
    'G.......G', '.###.###.', '.........', '.#.#.#.#.', '.........', '..##.##..', '.........', '....P....'],
  [ // Krąg — a ring of pillars
    '...S.S...', '.........', '.G.....G.', '...#.#...', '..#...#..', '.#.....#.', '.#.....#.',
    '..#...#..', '...#.#...', '.........', '.........', 'S.......S', '.........', '.........', '....P....'],
];

const BOSS_TEMPLATE = [
  '.S.....S.', '.........', '.........', '.#.....#.', '.........', '.........', '.........', '.........',
  'G.......G', '.........', '.#.....#.', '.........', '.........', '.........', '....P....'];

const SABBATH_TEMPLATE = [
  '.........', '.........', '.........', '.........', '...###...', '...###...', '.........', '.........',
  '.........', '.........', '.........', '.........', '.........', '.........', '....P....'];

const CHAPEL_TEMPLATE = [
  '.........', '.........', '..#...#..', '.........', '.........', '....A....', '.........', '..#...#..',
  '.........', '.........', '.........', '.........', '.........', '.........', '....P....'];

export interface Point { x: number; y: number }

export interface RoomLayout {
  kind: RoomKind;
  walls: Rect[];
  /** 'blocked' cells of the 1-unit template grid, row-major */
  solid: boolean[];
  seeds: Point[];
  graces: Point[];
  spawns: Point[];
  altar: Point | null;
  fragmentSpots: Point[];
  templateName: string;
}

const NAMES = ['Nawa', 'Krzyż', 'Ławy', 'Ogród', 'Labirynt', 'Krąg'];

/** Build a room. `seedRatio` is the share of free cells that get a light seed. */
export function generateRoom(kind: RoomKind, seed: number): RoomLayout {
  const rng = new Rng(seed);
  let tpl: string[];
  let name: string;
  if (kind === 'boss') { tpl = BOSS_TEMPLATE; name = 'Twierdza'; }
  else if (kind === 'sabbath') { tpl = SABBATH_TEMPLATE; name = 'Szabat'; }
  else if (kind === 'chapel') { tpl = CHAPEL_TEMPLATE; name = 'Kaplica'; }
  else {
    const i = rng.int(0, BATTLE_TEMPLATES.length - 1);
    tpl = BATTLE_TEMPLATES[i];
    name = NAMES[i];
  }
  const mirror = rng.chance(0.5);
  const at = (c: number, r: number) => tpl[r][mirror ? ROOM_W - 1 - c : c];

  const solid: boolean[] = [];
  const free: Point[] = [], graces: Point[] = [], spawns: Point[] = [];
  let altar: Point | null = null;
  for (let r = 0; r < ROOM_H; r++) {
    for (let c = 0; c < ROOM_W; c++) {
      const ch = at(c, r);
      const p = { x: c + 0.5, y: r + 0.5 };
      solid.push(ch === '#');
      if (ch === 'G') graces.push(p);
      else if (ch === 'S') spawns.push(p);
      else if (ch === 'A') altar = p;
      else if (ch === '.') free.push(p);
    }
  }
  if (!spawns.length) spawns.push({ x: 0.8, y: 0.8 }, { x: ROOM_W - 0.8, y: 0.8 });

  // light seeds on free cells, away from the start, the door and the altar
  const keepOut = (p: Point) =>
    (Math.abs(p.x - START.x) < 1.6 && Math.abs(p.y - START.y) < 1.6) ||
    (Math.abs(p.x - DOOR.x) < 1 && p.y < 1) ||
    (altar !== null && Math.abs(p.x - altar.x) < 1.2 && Math.abs(p.y - altar.y) < 1.2);
  const candidates = free.filter(p => !keepOut(p));
  const ratio = kind === 'battle' ? 0.62 : kind === 'rescue' ? 0.35 : kind === 'boss' ? 0.25 : 0.2;
  const seeds = rng.shuffle([...candidates]).slice(0, Math.round(candidates.length * ratio));
  const fragmentSpots = rng.shuffle(candidates.filter(p => p.y < ROOM_H - 4)).slice(0, 3);

  // one grace orb in small rooms, two otherwise (kept in the template's corners)
  const usedGraces = kind === 'battle' || kind === 'rescue' ? rng.shuffle([...graces]).slice(0, rng.chance(0.5) ? 2 : 1)
    : kind === 'boss' ? graces.slice(0, 2) : [];

  return { kind, walls: mergeWalls(solid), solid, seeds, graces: usedGraces, spawns, altar, fragmentSpots, templateName: name };
}

/** Merge horizontally adjacent wall cells into longer rectangles (fewer collision tests, nicer drawing). */
export function mergeWalls(solid: readonly boolean[]): Rect[] {
  const out: Rect[] = [];
  for (let r = 0; r < ROOM_H; r++) {
    let c = 0;
    while (c < ROOM_W) {
      if (!solid[r * ROOM_W + c]) { c++; continue; }
      const start = c;
      while (c < ROOM_W && solid[r * ROOM_W + c]) c++;
      out.push({ x: start, y: r, w: c - start, h: 1 });
    }
  }
  return out;
}

/** Room sequence of a chapter: engage, engage, focus task, engage, engage, rest, stronghold. */
export function chapterRooms(hell: boolean): RoomKind[] {
  return hell
    ? ['rescue', 'rescue', 'sabbath', 'rescue', 'rescue', 'boss']
    : ['battle', 'battle', 'chapel', 'battle', 'battle', 'sabbath', 'boss'];
}
