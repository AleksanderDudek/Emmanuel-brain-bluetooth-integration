/**
 * Firmament's saga: constellations of eight stars, each star a level (Candy Crush's episodes).  Every
 * level has ONE goal that varies from level to level — reach a score, clear the dark clouds, bring
 * the moons down, collect bodies of a kind, break the asteroids — limited moves and three stars by
 * score.  The last star of each constellation is the hard one (a peak, then a breather).
 *
 * The first three constellations are hand-made (they teach one thing at a time: clouds, then moons,
 * asteroids, locks, ink); later ones come from a seeded generator built on the same shapes, the same
 * level for everyone.  A layout is rows of letters: ' ' a hole in the sky, '.' a plain cell, 'c'/'C'
 * a cloud of one/two layers, '1'–'3' an asteroid with that many hits, 'l' an orbit lock, 'k' a lock
 * over a cloud, 'i' ink.
 */
import { mulberry32 } from '../../core/random';
import type { BoardSpec } from './board';
import { RULES } from './rules';

export type GoalKind = 'score' | 'clouds' | 'moons' | 'collect' | 'rocks';
/** Something the level brings in for the first time (a coach mark explains it). */
export type NewThing = 'clouds' | 'moons' | 'collect' | 'rocks' | 'locks' | 'ink' | 'hard';

export interface Level {
  index: number;
  constellation: number;
  /** the star within its constellation, 0..perConst−1 */
  star: number;
  hard: boolean;
  goal: GoalKind;
  /** score: the points; clouds: cloud layers; moons: moons; rocks: asteroids; collect: the sum of `want` */
  n: number;
  /** collect: the kinds and how many of each */
  want: { of: number; n: number }[];
  moves: number;
  kinds: number;
  layout: string[];
  moons: number;
  /** the score for two and for three stars (one star: the goal done) */
  stars: [number, number];
  seed: number;
  fresh: NewThing[];
}

interface Def {
  goal: GoalKind;
  moves: number;
  kinds: number;
  layout: string[];
  /** score: the target; collect: per kind */
  n?: number;
  want?: [number, number][];
  moons?: number;
  fresh?: NewThing[];
}

const FULL = ['........', '........', '........', '........', '........', '........', '........', '........'];

/** The hand-made constellations (8 levels each). */
const HAND: Def[][] = [
  // 0 · Pierwsze światła — the first lights: swap, clouds, a square, collect, moons
  [
    { goal: 'score', n: 6000, moves: 12, kinds: 4, layout: [' ...... ', '........', '........', '........', '........', '........', '........', ' ...... '] },
    { goal: 'clouds', moves: 20, kinds: 4, fresh: ['clouds'], layout: ['........', '........', '........', '..cccc..', '..cccc..', '........', '........', '........'] },
    { goal: 'collect', want: [[0, 18]], moves: 20, kinds: 4, fresh: ['collect'], layout: FULL },
    { goal: 'clouds', moves: 22, kinds: 5, layout: ['   ..   ', '  ....  ', ' ...... ', '..cccc..', '..cccc..', ' cccccc ', '  cccc  ', '   cc   '] },
    { goal: 'moons', moons: 2, moves: 22, kinds: 5, fresh: ['moons'], layout: ['........', '........', '........', '........', '........', '........', '........', '........'] },
    { goal: 'score', n: 5000, moves: 20, kinds: 5, layout: ['...  ...', '...  ...', '........', '........', '........', '........', '...  ...', '...  ...'] },
    { goal: 'clouds', moves: 24, kinds: 5, layout: ['cc....cc', 'cc....cc', '........', '...CC...', '...CC...', '........', 'cc....cc', 'cc....cc'] },
    { goal: 'collect', want: [[2, 22], [4, 22]], moves: 24, kinds: 5, fresh: ['hard'], layout: [' ...... ', '........', '..c..c..', '........', '........', '..c..c..', '........', ' ...... '] },
  ],
  // 1 · Gwiazdy Abrahama — count the stars: asteroids, more moons
  [
    { goal: 'rocks', moves: 22, kinds: 5, fresh: ['rocks'], layout: ['........', '........', '........', '........', '11....11', '........', '..1111..', '........'] },
    { goal: 'moons', moons: 3, moves: 24, kinds: 5, layout: [' ...... ', '........', '........', '........', '........', '........', '........', ' ...... '] },
    { goal: 'clouds', moves: 24, kinds: 5, layout: ['........', '.cccccc.', '.c....c.', '.c.11.c.', '.c.11.c.', '.c....c.', '.cccccc.', '........'] },
    { goal: 'score', n: 8000, moves: 20, kinds: 5, layout: ['..    ..', '........', '........', '........', '........', '........', '........', '..    ..'] },
    { goal: 'rocks', moves: 24, kinds: 5, layout: ['........', '........', '........', '22....22', '........', '...22...', '........', '1......1'] },
    { goal: 'collect', want: [[1, 24], [3, 24]], moves: 22, kinds: 5, layout: ['........', '........', '...11...', '..1..1..', '..1..1..', '...11...', '........', '........'] },
    { goal: 'moons', moons: 3, moves: 22, kinds: 5, layout: ['........', '........', '........', '1......1', '........', '..1..1..', '........', '........'] },
    { goal: 'clouds', moves: 26, kinds: 6, fresh: ['hard'], layout: ['CCC..CCC', 'C......C', 'C.2..2.C', '........', '........', 'C.2..2.C', 'C......C', 'CCC..CCC'] },
  ],
  // 2 · Gwiazdy poranne — the morning stars sang: orbit locks, ink
  [
    { goal: 'clouds', moves: 22, kinds: 5, fresh: ['locks'], layout: ['........', '........', '..kkkk..', '........', '........', '..kkkk..', '........', '........'] },
    { goal: 'score', n: 9000, moves: 22, kinds: 5, layout: ['........', '.l....l.', '........', '...ll...', '...ll...', '........', '.l....l.', '........'] },
    { goal: 'moons', moons: 3, moves: 24, kinds: 5, layout: ['  ....  ', ' ...... ', '........', '........', '........', '........', ' ...... ', '  ....  '] },
    { goal: 'clouds', moves: 24, kinds: 5, fresh: ['ink'], layout: ['........', '........', '..c..c..', '...ii...', '...ii...', '..c..c..', '.cc..cc.', '........'] },
    { goal: 'collect', want: [[5, 26], [0, 26]], moves: 24, kinds: 6, layout: ['........', '........', 'll....ll', '........', '........', 'll....ll', '........', '........'] },
    { goal: 'clouds', moves: 26, kinds: 5, layout: ['ccc  ccc', 'ccc  ccc', 'ccc..ccc', '........', '........', 'ccc..ccc', 'ccc  ccc', 'ccc  ccc'] },
    { goal: 'rocks', moves: 24, kinds: 5, layout: ['........', '........', '........', '........', '........', '22222222', '........', '........'] },
    { goal: 'moons', moons: 3, moves: 28, kinds: 5, fresh: ['hard'], layout: ['........', '........', '.i....i.', '........', '..2..2..', '........', '........', '........'] },
  ],
];

/** Shapes the generator builds on (8×8, ' ' = a hole). */
const SHAPES: string[][] = [
  FULL,
  [' ...... ', '........', '........', '........', '........', '........', '........', ' ...... '],
  ['   ..   ', '  ....  ', ' ...... ', '........', '........', ' ...... ', '  ....  ', '   ..   '],
  ['...  ...', '...  ...', '........', '........', '........', '........', '...  ...', '...  ...'],
  ['........', '........', '..    ..', '..    ..', '........', '........', '........', '........'],
  ['  ....  ', '  ....  ', '........', '........', '........', '........', '  ....  ', '  ....  '],
  ['........', '.      .', '........', '........', '........', '........', '........', '........'],
  ['.. .. ..', '........', '........', '........', '........', '........', '........', '........'],
];

/** How hard a level is meant to be (0 easy … 1 hard): a slow rise, a peak at each constellation's end, a breather after. */
export function difficulty(index: number): number {
  const c = Math.floor(index / RULES.perConst), s = index % RULES.perConst;
  const wave = [0.15, 0.3, 0.45, 0.35, 0.55, 0.45, 0.65, 0.95][s];
  return Math.min(1, wave * 0.75 + Math.min(0.25, c * 0.035));
}

const GEN_GOALS: GoalKind[] = ['clouds', 'collect', 'moons', 'score', 'rocks', 'clouds', 'moons', 'clouds'];

function generated(index: number): Def {
  const rnd = mulberry32(0x5eed + index * 7919);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
  const d = difficulty(index);
  const s = index % RULES.perConst;
  const goal = GEN_GOALS[(s + Math.floor(index / RULES.perConst)) % GEN_GOALS.length];
  const grid = pick(SHAPES).map(r => [...r]);
  const cells: [number, number][] = [];
  grid.forEach((row, r) => row.forEach((ch, c) => { if (ch !== ' ') cells.push([r, c]); }));
  const put = (ch: string, n: number, where: (r: number, c: number) => boolean) => {
    const pool = cells.filter(([r, c]) => grid[r][c] === '.' && where(r, c));
    for (let k = 0; k < n && pool.length; k++) {
      const [r, c] = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      grid[r][c] = ch;
      // a mirror image keeps it pleasant
      if (grid[r][7 - c] === '.') grid[r][7 - c] = ch;
    }
  };
  const kinds = d > 0.6 ? 6 : 5;
  let moves = Math.round(26 - d * 6);
  const def: Def = { goal, moves, kinds, layout: [] };
  switch (goal) {
    case 'clouds': put(d > 0.5 ? 'C' : 'c', 6 + Math.round(d * 8), (r) => r >= 2); if (d > 0.5) put('2', 2, r => r >= 3 && r <= 5); break;
    case 'rocks': put(d > 0.92 ? '3' : d > 0.4 ? '2' : '1', 4 + Math.round(d * 3), r => r >= 3); moves += 2; break;
    case 'moons': def.moons = 2 + Math.round(d * 1.5); put('1', Math.round(d * 2), r => r >= 2 && r <= 5); moves += 5; break;
    case 'collect': def.want = [[Math.floor(rnd() * kinds), 20 + Math.round(d * 10)], [Math.floor(rnd() * kinds), 20 + Math.round(d * 10)]]; if (def.want[0][0] === def.want[1][0]) def.want.pop(); put('l', Math.round(d * 4), () => true); break;
    case 'score': def.n = Math.round((moves * (290 - d * 70)) / 500) * 500; put('l', 2, () => true); break;
  }
  if (d > 0.7 && goal !== 'rocks') put('i', 1, r => r >= 3 && r <= 4);
  // the hard star gets a little more room (the band's tools are meant to finish it)
  if (s === RULES.perConst - 1) moves += 2;
  def.moves = moves;
  def.layout = grid.map(r => r.join(''));
  return def;
}

const defAt = (index: number): Def => {
  const c = Math.floor(index / RULES.perConst), s = index % RULES.perConst;
  return HAND[c]?.[s] ?? generated(index);
};

/** Count what a layout holds: cloud layers, asteroids. */
export function layoutCounts(layout: string[]): { clouds: number; rocks: number; ink: number; locks: number; cells: number } {
  let clouds = 0, rocks = 0, ink = 0, locks = 0, cells = 0;
  for (const row of layout) for (const ch of row) {
    if (ch === ' ') continue;
    cells++;
    if (ch === 'c' || ch === 'k') clouds += 1;
    if (ch === 'C') clouds += 2;
    if (ch >= '1' && ch <= '3') rocks++;
    if (ch === 'i') ink++;
    if (ch === 'l' || ch === 'k') locks++;
  }
  return { clouds, rocks, ink, locks, cells };
}

/** Level `index` (0-based) of the saga. */
export function levelAt(index: number): Level {
  const i = Math.max(0, Math.floor(index));
  const def = defAt(i);
  const counts = layoutCounts(def.layout);
  const want = (def.want ?? []).map(([of, n]) => ({ of, n }));
  const n = def.goal === 'score' ? def.n ?? 3000
    : def.goal === 'clouds' ? counts.clouds
      : def.goal === 'rocks' ? counts.rocks
        : def.goal === 'moons' ? def.moons ?? 2
          : want.reduce((s, w) => s + w.n, 0);
  // the stars: a good game scores about this much a move, and the comets after the goal add more
  // (a score level plays all its moves; the others end early and the comet shower pays for the moves left)
  const per = 650 + (def.kinds <= 4 ? 150 : 0);
  const base = def.goal === 'score' ? n : Math.round((def.moves * per * 0.85) / 100) * 100;
  const s2 = def.goal === 'score' ? Math.round((n * 1.5) / 100) * 100 : base;
  const s3 = def.goal === 'score' ? Math.round((n * 2.1) / 100) * 100 : Math.round((base * 1.45) / 100) * 100;
  return {
    index: i, constellation: Math.floor(i / RULES.perConst), star: i % RULES.perConst, hard: i % RULES.perConst === RULES.perConst - 1,
    goal: def.goal, n, want, moves: def.moves, kinds: def.kinds, layout: def.layout, moons: def.moons ?? 0,
    stars: [s2, s3], seed: 0x51a + i * 104729, fresh: def.fresh ?? [],
  };
}

/** The board a level starts with (a retry gets a new sky: attempt changes the seed). */
export function boardSpec(l: Level, attempt = 0): BoardSpec {
  const rows = l.layout.length, cols = Math.max(...l.layout.map(r => r.length));
  const n = rows * cols;
  const mask: boolean[] = new Array<boolean>(n).fill(false);
  const cloud = new Array<number>(n).fill(0), rock = new Array<number>(n).fill(0), ink = new Array<number>(n).fill(0), lock = new Array<number>(n).fill(0);
  l.layout.forEach((row, r) => [...row.padEnd(cols, ' ')].forEach((ch, c) => {
    const i = r * cols + c;
    if (ch === ' ') return;
    mask[i] = true;
    if (ch === 'c') cloud[i] = 1;
    else if (ch === 'C') cloud[i] = 2;
    else if (ch >= '1' && ch <= '3') rock[i] = Number(ch);
    else if (ch === 'i') ink[i] = 1;
    else if (ch === 'l') lock[i] = 1;
    else if (ch === 'k') { lock[i] = 1; cloud[i] = 1; }
  }));
  return {
    rows, cols, kinds: l.kinds, mask, cloud, rock, ink, lock, moons: l.moons, moonsAtOnce: l.moons > 2 ? 2 : 1,
    want: l.want.map(w => w.of), seed: (l.seed + attempt * 7777) >>> 0,
  };
}

/** One, two or three stars for a won level: the goal gives one, the score the others. */
export const starsFor = (l: Level, score: number): number => 1 + (score >= l.stars[0] ? 1 : 0) + (score >= l.stars[1] ? 1 : 0);

/** The tray's size in a constellation: one more from the third. */
export const traySize = (constellation: number): number => (constellation >= RULES.trayGrowAt ? RULES.trayMax : RULES.tray);
