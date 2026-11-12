/**
 * Rozświetl's content: the eight pairs (their verses and light), the strategies a block asks for (the
 * picture is the strategy, DESIGN §13.1), the firefly's moments, and the passages a session closes with.
 * The words live in i18n.ts; this file only names them.
 */
import type { PassageId } from '../kit/scripture';
import { t, type Key } from './i18n';
import { PAIR_IDS, type PairId } from './scenes';

export { PAIR_IDS, type PairId };

export interface PairSpec {
  id: PairId;
  /** the verse of its title card, and the ones that take turns with it on later visits */
  verses: readonly PassageId[];
  /** the bright picture's key light (the bloom and the motes) */
  light: string;
}

export const PAIRS: Record<PairId, PairSpec> = {
  samotnosc: { id: 'samotnosc', verses: ['ecc4.9-10'], light: '#ffd98a' },
  smutek: { id: 'smutek', verses: ['psa30.5', 'mat5.4', 'rev21.4'], light: '#ffe6a8' },
  dlugi: { id: 'dlugi', verses: ['2ki4.7', 'php4.19'], light: '#ffe2a0' },
  lek: { id: 'lek', verses: ['isa41.10'], light: '#fff1c0' },
  choroba: { id: 'choroba', verses: ['isa58.8'], light: '#fff1c0' },
  burza: { id: 'burza', verses: ['mrk4.39'], light: '#ffd0a0' },
  kajdany: { id: 'kajdany', verses: ['gal5.1'], light: '#ffe2a0' },
  zmeczenie: { id: 'zmeczenie', verses: ['isa40.29'], light: '#ffe0b0' },
};

/** The root passage (the lobby, the opening card). */
export const ROOT: PassageId = 'isa60.1';
/** Own pictures' title cards take these in turn. */
export const OWN_VERSES: readonly PassageId[] = ['isa43.19', 'psa34.5', 'isa61.3'];
/** A picture laid all in gold. */
export const GOLD_VERSE: PassageId = 'isa61.3';
/** A session without a finished picture closes with one of these, in turn. */
export const PLAIN_CLOSINGS: readonly PassageId[] = ['isa60.1', 'isa43.19', 'psa34.5'];

/** Every passage the game may show (tests check each exists in all four editions). */
export const ALL_PASSAGES: readonly PassageId[] = [...new Set<PassageId>([
  ROOT, ...OWN_VERSES, GOLD_VERSE, ...PLAIN_CLOSINGS, ...PAIR_IDS.flatMap(id => PAIRS[id].verses),
])];

/** A pair's verse for its n-th completion (1 = the first). */
export const pairVerse = (id: PairId, n: number): PassageId => {
  const v = PAIRS[id].verses;
  return v[(Math.max(1, Math.floor(n)) - 1) % v.length];
};

export const pairFrom = (id: PairId): string => t(`pair.${id}.from` as Key);
export const pairTo = (id: PairId): string => t(`pair.${id}.to` as Key);
/** "Samotność → Wspólnota" */
export const pairTitle = (id: PairId): string => `${pairFrom(id)} → ${pairTo(id)}`;

// ── the strategies (signal().task) ──────────────────────────────

/** What a block asks of the head: the picture's own imagery, in turn with a plain counting or recalling strategy. */
export type TaskKind = 'push' | 'rest' | 'blind' | 'warm';

/**
 * The strategy for the n-th block of a kind in this picture: the pair's own imagery first, then the
 * shared ones (one counting, one recalling, for players who do not picture easily), never the same
 * twice in a row.  `own`: the player's own picture (its own imagery lines).
 */
export function taskFor(kind: TaskKind, pair: PairId | null, n: number): string {
  const i = Math.max(0, Math.floor(n));
  if (kind === 'warm') return t('task.warm');
  if (kind === 'blind') return t(i % 2 ? 'task.blind.2' : 'task.blind.1');
  if (kind === 'push') {
    const own: Key[] = pair ? [`pair.${pair}.push1` as Key, 'task.push.see', `pair.${pair}.push2` as Key, 'task.push.count', 'task.push.letter', 'task.push.recall']
      : ['task.own.push', 'task.push.see', 'task.push.count', 'task.push.letter', 'task.push.recall'];
    return t(own[i % own.length]);
  }
  const rest: Key[] = pair ? [`pair.${pair}.rest` as Key, 'task.rest.self', 'task.rest.breath', 'task.rest.gold']
    : ['task.own.rest', 'task.rest.self', 'task.rest.breath', 'task.rest.gold'];
  return t(rest[i % rest.length]);
}

// ── the firefly's moments ───────────────────────────────────────

export type Moment = 'open' | 'back' | 'picture' | 'own' | 'day' | 'push' | 'rest' | 'blind' | 'crack' | 'burst' | 'chain'
  | 'flareReady' | 'flare' | 'near' | 'done' | 'gold' | 'good' | 'nosignal' | 'reveal' | 'end';

export const MOMENTS: readonly Moment[] = ['open', 'back', 'picture', 'own', 'day', 'push', 'rest', 'blind', 'crack', 'burst', 'chain',
  'flareReady', 'flare', 'near', 'done', 'gold', 'good', 'nosignal', 'reveal', 'end'];

/** How many lines each moment has (say.<moment>.1 … n). */
export const LINE_COUNT = 3;

export const lineKey = (m: Moment, i: number): Key => `say.${m}.${(i % LINE_COUNT) + 1}` as Key;

/** The firefly's line for a pair's picture just transformed (one per pair; else a generic "done" line). */
export const revealKey = (id: PairId): Key => `pair.${id}.reveal` as Key;
