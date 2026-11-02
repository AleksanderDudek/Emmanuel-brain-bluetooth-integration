/**
 * Firmament's levels: the first constellation made by hand (ten levels that teach one thing each),
 * and every later one from a seeded generator with a difficulty curve that rises in waves (a calm
 * level every fifth, a harder one closing each constellation) — the same levels for everyone, since
 * a level's seed is its number.  Each constellation has a figure for the map (its stars are the
 * levels) and a name; the names live in the catalog (i18n.ts).
 *
 * A hand-made map has eight rows of eight letters:
 *   .  an open cell        #  a hole in the sky        1 2 3  an asteroid (hits to break)
 *   d  stardust (1 layer)  D  stardust (2 layers)
 */
import { mulberry32 } from '../../core/random';
import type { BoardSpec, ToolKind } from './board';
import { RULES } from './rules';

export type GoalKind = 'score' | 'collect' | 'dust' | 'rocks' | 'sats';
/** score: reach n points; collect: n bodies of kind `of`; dust / rocks: clear all; sats: bring n down */
export interface Goal { kind: GoalKind; n: number; of?: number }

export interface Level {
  /** 0-based, across all constellations */
  index: number;
  constellation: number;
  /** the star of the constellation (0..perConst−1) */
  star: number;
  moves: number;
  kinds: number;
  goals: Goal[];
  /** points for two and three stars (one star: the goals done) */
  stars: [number, number];
  map: string[] | null;
  sats: number;
  seed: number;
  /** a calm level (a breather) and the constellation's closing one */
  calm: boolean;
  boss: boolean;
}

/** A level's seed: the same number for everyone. */
export const levelSeed = (index: number): number => (Math.imul(index + 1, 0x9e3779b1) ^ 0x51ed27) >>> 0;

// ── the first constellation, by hand ─────────────────────────────
interface Hand { moves: number; kinds: number; goals: Goal[]; map?: string[]; sats?: number }

const OPEN = ['........', '........', '........', '........', '........', '........', '........', '........'];

const HAND: Hand[] = [
  // 1: just match — reach the points
  { moves: 20, kinds: 5, goals: [{ kind: 'score', n: 1200 }] },
  // 2: gather the gold stars
  { moves: 22, kinds: 5, goals: [{ kind: 'collect', n: 24, of: 0 }] },
  // 3: stardust across the middle
  { moves: 22, kinds: 5, goals: [{ kind: 'dust', n: 0 }], map: ['........', '........', '........', 'dddddddd', 'dddddddd', '........', '........', '........'] },
  // 4: a shaped sky, six kinds
  { moves: 22, kinds: 6, goals: [{ kind: 'score', n: 2200 }], map: ['##....##', '#......#', '........', '........', '........', '........', '#......#', '##....##'] },
  // 5: asteroids in a belt
  { moves: 24, kinds: 5, goals: [{ kind: 'rocks', n: 0 }], map: ['........', '........', '........', '.1.11.1.', '........', '1.1..1.1', '........', '........'] },
  // 6: satellites come down
  { moves: 24, kinds: 5, goals: [{ kind: 'sats', n: 2 }], sats: 2 },
  // 7: two kinds at once
  { moves: 25, kinds: 6, goals: [{ kind: 'collect', n: 18, of: 1 }, { kind: 'collect', n: 18, of: 2 }] },
  // 8: a diamond of deep dust
  { moves: 25, kinds: 5, goals: [{ kind: 'dust', n: 0 }], map: ['........', '...dd...', '..dDDd..', '.dDDDDd.', '.dDDDDd.', '..dDDd..', '...dd...', '........'] },
  // 9: harder asteroids over dust
  { moves: 26, kinds: 6, goals: [{ kind: 'rocks', n: 0 }, { kind: 'dust', n: 0 }], map: ['........', '..2..2..', '........', 'dd.dd.dd', 'dd.dd.dd', '........', '..2..2..', '........'] },
  // 10: the constellation closes: satellites past an asteroid ring
  { moves: 28, kinds: 6, goals: [{ kind: 'sats', n: 3 }, { kind: 'rocks', n: 0 }], map: ['#......#', '........', '........', '1.1..1.1', '........', '........', '........', '#......#'], sats: 3 },
];

/** Points for two and three stars: a score goal's target × 1.5 and × 2.2, else by the moves. */
function starsFor(goals: Goal[], moves: number): [number, number] {
  const score = goals.find(g => g.kind === 'score');
  if (score) return [Math.round(score.n * 1.45 / 50) * 50, Math.round(score.n * 2 / 50) * 50];
  const extra = goals.reduce((s, g) => s + (g.kind === 'sats' ? g.n * RULES.sat : g.kind === 'rocks' ? 160 : g.kind === 'dust' ? 300 : 0), 0);
  return [Math.round((moves * 95 + extra) / 50) * 50, Math.round((moves * 150 + extra) / 50) * 50];
}

// ── the generator ────────────────────────────────────────────────
const SHAPES: string[][] = [
  ['##....##', '#......#', '........', '........', '........', '........', '#......#', '##....##'],
  ['........', '........', '........', '...##...', '...##...', '........', '........', '........'],
  ['#......#', '........', '........', '........', '........', '........', '........', '#......#'],
  ['...##...', '........', '........', '#......#', '#......#', '........', '........', '...##...'],
];

/** Difficulty 0..1 for a level past the first constellation: rising, in waves. */
export function difficulty(index: number): number {
  const k = Math.max(0, index - RULES.perConst);
  const base = Math.min(1, k / 70);
  const wave = 0.12 * Math.sin((k / RULES.perConst) * Math.PI * 2);
  return Math.max(0, Math.min(1, base + wave));
}

function generated(index: number): Level {
  const rnd = mulberry32(levelSeed(index) ^ 0x2545f491);
  const star = index % RULES.perConst;
  const calm = star === 4;
  const boss = star === RULES.perConst - 1;
  const d = Math.min(1, difficulty(index) + (boss ? 0.15 : 0) - (calm ? 0.25 : 0));
  const kinds = calm || (star === 0 && d < 0.4) ? 5 : 6;
  let moves = Math.round(28 - 9 * d + (rnd() * 4 - 2)) + (calm ? 3 : 0) + (boss ? 4 : 0);
  moves = Math.max(16, Math.min(32, moves));
  const map = (rnd() < 0.35 ? SHAPES[Math.floor(rnd() * SHAPES.length)] : OPEN).map(row => [...row]);
  const open = (r: number, c: number) => map[r][c] === '.';
  const cells: [number, number][] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (open(r, c)) cells.push([r, c]);
  const pickCells = (n: number, rows: [number, number]) => {
    const pool = cells.filter(([r, c]) => r >= rows[0] && r <= rows[1] && open(r, c));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
  };
  const order: GoalKind[] = ['score', 'collect', 'dust', 'rocks', 'sats'];
  const main = order[(index + Math.floor(index / RULES.perConst)) % order.length];
  const goals: Goal[] = [];
  let sats = 0;
  const addGoal = (kind: GoalKind) => {
    switch (kind) {
      case 'score': goals.push({ kind, n: Math.round((moves * (95 + 55 * d)) / 100) * 100 }); break;
      case 'collect': {
        const of = Math.floor(rnd() * kinds);
        if (goals.some(g => g.kind === 'collect' && g.of === of)) break;
        goals.push({ kind, n: Math.round(18 + 16 * d), of });
        break;
      }
      case 'dust': {
        const deep = d > 0.35 && rnd() < 0.5 + d / 2;
        for (const [r, c] of pickCells(Math.round(10 + 14 * d), [2, 7])) map[r][c] = deep && rnd() < d ? 'D' : 'd';
        goals.push({ kind, n: 0 });
        break;
      }
      case 'rocks': {
        const hp = 1 + Math.min(2, Math.floor(d * 2.2 + rnd() * 0.6));
        for (const [r, c] of pickCells(Math.round(6 + 7 * d), [1, 6])) map[r][c] = String(1 + Math.floor(rnd() * hp));
        goals.push({ kind, n: 0 });
        break;
      }
      case 'sats':
        sats = 2 + Math.floor(d * 2.5);
        goals.push({ kind, n: sats });
        moves = Math.min(34, moves + 4);
        break;
    }
  };
  addGoal(main);
  if (!calm && d > 0.3 && rnd() < 0.3 + d * 0.4) addGoal(main === 'collect' ? 'dust' : 'collect');
  if (boss && goals.length < 2) addGoal(main === 'rocks' ? 'sats' : 'rocks');
  return {
    index, constellation: Math.floor(index / RULES.perConst), star, moves, kinds, goals, stars: starsFor(goals, moves),
    map: map.map(r => r.join('')), sats, seed: levelSeed(index), calm, boss,
  };
}

/** Level `index` (0-based): hand-made in the first constellation, generated after it. */
export function levelAt(index: number): Level {
  const i = Math.max(0, Math.floor(index));
  if (i < HAND.length) {
    const h = HAND[i];
    return {
      index: i, constellation: 0, star: i, moves: h.moves, kinds: h.kinds, goals: h.goals.map(g => ({ ...g })), stars: starsFor(h.goals, h.moves),
      map: h.map ?? null, sats: h.sats ?? 0, seed: levelSeed(i), calm: false, boss: i === HAND.length - 1,
    };
  }
  return generated(i);
}

/** The board a level starts with: its holes, asteroids and dust, its seed (the same for everyone). */
export function boardSpec(l: Level, attempt = 0): BoardSpec {
  const n = RULES.rows * RULES.cols;
  const mask = new Array<boolean>(n).fill(true), rocks = new Array<number>(n).fill(0), dust = new Array<number>(n).fill(0);
  if (l.map) {
    l.map.forEach((row, r) => [...row].forEach((ch, c) => {
      const i = r * RULES.cols + c;
      if (ch === '#') mask[i] = false;
      else if (ch >= '1' && ch <= '3') rocks[i] = Number(ch);
      else if (ch === 'd') dust[i] = 1;
      else if (ch === 'D') dust[i] = 2;
    }));
  }
  return { kinds: l.kinds, mask, rocks, dust, sats: l.sats, seed: (l.seed + Math.imul(attempt, 0x85ebca6b)) >>> 0 };
}

/** The instruments a constellation has opened (the tray grows to four in the fourth). */
export function toolsFor(constellation: number): ToolKind[] {
  const tools: ToolKind[] = ['comet', 'ray'];
  if (constellation >= 1) tools.push('swap');
  if (constellation >= 2) tools.push('nova');
  return tools;
}
export const traySize = (constellation: number): number => (constellation >= 3 ? RULES.trayMax : RULES.tray);

// ── the map's figures ────────────────────────────────────────────
/** A constellation's figure: ten stars (0..1 of the map's box) and the lines between them. */
export interface Figure { pts: [number, number][]; lines: [number, number][] }

const chain = (n: number): [number, number][] => Array.from({ length: n - 1 }, (_, i) => [i, i + 1] as [number, number]);

export const FIGURES: readonly Figure[] = [
  // the Pleiades: a little dipper of a cluster
  { pts: [[0.16, 0.66], [0.28, 0.5], [0.4, 0.58], [0.48, 0.38], [0.6, 0.47], [0.7, 0.3], [0.84, 0.4], [0.74, 0.6], [0.58, 0.72], [0.42, 0.8]], lines: [...chain(10), [9, 2]] },
  // Orion: the feet, the belt, the shoulders, the head
  { pts: [[0.3, 0.88], [0.4, 0.6], [0.46, 0.52], [0.52, 0.49], [0.58, 0.46], [0.66, 0.58], [0.74, 0.88], [0.7, 0.22], [0.5, 0.1], [0.32, 0.2]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [4, 7], [7, 8], [8, 9], [9, 2]] },
  // the Bear (Job 9:9)
  { pts: [[0.08, 0.42], [0.2, 0.36], [0.32, 0.4], [0.42, 0.47], [0.45, 0.66], [0.63, 0.7], [0.67, 0.5], [0.76, 0.32], [0.86, 0.26], [0.92, 0.46]], lines: [...chain(10), [3, 6]] },
  // the Swan: a cross in the Milky Way
  { pts: [[0.5, 0.08], [0.5, 0.24], [0.5, 0.4], [0.5, 0.56], [0.5, 0.74], [0.5, 0.92], [0.33, 0.33], [0.16, 0.26], [0.67, 0.47], [0.84, 0.56]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7], [2, 8], [8, 9]] },
  // the Lyre
  { pts: [[0.5, 0.1], [0.36, 0.22], [0.64, 0.24], [0.42, 0.4], [0.6, 0.42], [0.38, 0.62], [0.62, 0.64], [0.4, 0.84], [0.6, 0.86], [0.5, 0.5]], lines: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 8], [7, 8], [3, 4]] },
  // Cassiopeia's W, and a tail
  { pts: [[0.08, 0.3], [0.22, 0.62], [0.36, 0.4], [0.5, 0.66], [0.64, 0.38], [0.78, 0.6], [0.92, 0.32], [0.82, 0.16], [0.66, 0.12], [0.5, 0.18]], lines: chain(10) },
];

/** The figure of a constellation (they repeat after the sixth). */
export const figureOf = (constellation: number): Figure => FIGURES[((constellation % FIGURES.length) + FIGURES.length) % FIGURES.length];
