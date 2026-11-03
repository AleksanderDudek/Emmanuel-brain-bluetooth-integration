/**
 * The two-screen games (src/cards/DESIGN.md §4): which cards each one grew from, what it trains,
 * and how a session of it runs.  Texts are in src/cards/i18n.ts, keyed by the game's id.
 */
import { BimanualEngine } from './bimanual';
import { TrailEngine, SearchEngine } from './field';
import { MappingEngine } from './mapping';
import { CodeEngine, SequenceEngine } from './sequence';
import { StroopEngine } from './stroop';
import type { EngineOptions, GameEngine, GameId, SkillId } from './types';

export interface GameMeta {
  id: GameId;
  /** the exercise cards (1–32) it is built on */
  cards: readonly number[];
  skill: SkillId;
  /** one hand, or both at once */
  hands: 1 | 2;
  create(opts: EngineOptions): GameEngine;
  /** practice trials before play (not scored) */
  practice: number;
  /** the pause between trials (ms): a random wait in this range, so the next cue cannot be anticipated */
  iti: [number, number];
}

export const GAMES: readonly GameMeta[] = [
  { id: 'palce', cards: [7, 2, 14, 4], skill: 'speed', hands: 1, practice: 3, iti: [450, 900], create: o => new MappingEngine('palce', o) },
  { id: 'gesty', cards: [3, 13, 21, 25, 30], skill: 'rules', hands: 1, practice: 4, iti: [450, 900], create: o => new MappingEngine('gesty', o) },
  { id: 'znaki', cards: [18, 27, 31], skill: 'rules', hands: 1, practice: 4, iti: [450, 900], create: o => new MappingEngine('znaki', o) },
  { id: 'cwiartki', cards: [24], skill: 'rules', hands: 1, practice: 4, iti: [450, 900], create: o => new MappingEngine('cwiartki', o) },
  { id: 'obie', cards: [10, 5, 16, 23, 32], skill: 'coordination', hands: 2, practice: 3, iti: [600, 1000], create: o => new BimanualEngine(o) },
  { id: 'stroop', cards: [20, 32], skill: 'inhibition', hands: 1, practice: 4, iti: [450, 900], create: o => new StroopEngine(o) },
  { id: 'sekwencja', cards: [9, 4, 12], skill: 'memory', hands: 1, practice: 1, iti: [900, 1200], create: o => new SequenceEngine(o) },
  { id: 'kod', cards: [29], skill: 'memory', hands: 1, practice: 1, iti: [800, 1100], create: o => new CodeEngine(o) },
  { id: 'szlak', cards: [8, 19], skill: 'attention', hands: 1, practice: 0, iti: [900, 1200], create: o => new TrailEngine(o) },
  { id: 'szukaj', cards: [17], skill: 'attention', hands: 1, practice: 0, iti: [900, 1200], create: o => new SearchEngine(o) },
];

export const gameMeta = (id: string): GameMeta | undefined => GAMES.find(g => g.id === id);

/** The games built on a card (its "Zagraj na dwóch ekranach" buttons). */
export const gamesOfCard = (card: number): GameMeta[] => GAMES.filter(g => g.cards.includes(card));

/**
 * The daily workout: three games a day, one for speed or rules, one for memory or attention, one
 * for coordination or inhibition — a different trio each day, the same for everyone that day.
 */
export function dailyTrio(day: string): GameId[] {
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const groups: GameId[][] = [['palce', 'gesty', 'znaki', 'cwiartki'], ['sekwencja', 'kod', 'szlak', 'szukaj'], ['obie', 'stroop']];
  return groups.map((g, k) => g[(h >>> (k * 5)) % g.length]);
}
