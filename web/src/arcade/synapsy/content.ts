/**
 * Synapsy's data: the map of the mind (regions), the ladder of lessons (thoughts to teach the network), the
 * "Wiedza" cards (one real number, a plain sentence and its source each — DESIGN §13.11 lists them), Oli's
 * moments and the strategies under a block's name.  The words come from i18n.ts.
 */
import { fmtNum } from '../../i18n';
import type { IoKind, NodeKey, RegionId } from './brain';
import { CATALOGS, t, type Key } from './i18n';
import { RULES } from './rules';

// ── the map of the mind ─────────────────────────────────────────
/** The regions on the lobby's map, in the order they are drawn; 'touch' is the somatosensory relay cortex. */
export const REGIONS: readonly RegionId[] = ['plan', 'vision', 'move', 'hear', 'bridge', 'lang', 'mem', 'touch'];

export const regionName = (r: RegionId): string => t(`region.${r}` as Key);

/** The IO node's word on the field ("oko", "prawa dłoń": the left hemisphere moves the right hand). */
export function ioName(kind: IoKind, side: 'L' | 'R'): string {
  if (kind === 'hand') return t(side === 'L' ? 'io.handL' : 'io.handR');
  if (kind === 'eye') return t(side === 'L' ? 'io.eyeL' : 'io.eyeR');
  if (kind === 'ear') return t(side === 'L' ? 'io.earL' : 'io.earR');
  return t(`io.${kind}` as Key);
}

export const nodeName = (k: NodeKey): string => ioName(k.slice(0, -1) as IoKind, k.slice(-1) as 'L' | 'R');

// ── lessons ─────────────────────────────────────────────────────
export type LessonId = 'see' | 'hear' | 'cross' | 'name' | 'recall' | 'catch' | 'echo' | 'tell';

export interface LessonSpec {
  id: LessonId;
  from: NodeKey;
  to: NodeKey;
  /** a waypoint the thought must pass (the hippocampus) */
  via?: NodeKey;
  /** thoughts to deliver in the first round */
  need: number;
  /** a fast lesson: thoughts count only under the round's conduction limit */
  fast?: boolean;
  /** the map's regions this lesson lights */
  regions: RegionId[];
}

/**
 * The ladder, one round: within one half first, then across the bridge, then speech, memory and speed.
 * Real lateralisation: the left occipital lobe sees the right half of the view, the left motor cortex
 * moves the right hand, speech lives in the left hemisphere (Broca's area).
 */
export const LESSONS: readonly LessonSpec[] = [
  { id: 'see', from: 'eyeL', to: 'handL', need: 5, regions: ['vision', 'move'] },
  { id: 'hear', from: 'earR', to: 'handR', need: 5, regions: ['hear', 'move'] },
  { id: 'cross', from: 'eyeR', to: 'handL', need: 6, regions: ['vision', 'bridge', 'move'] },
  { id: 'name', from: 'earL', to: 'voiceL', need: 6, regions: ['hear', 'lang'] },
  { id: 'recall', from: 'earR', via: 'memR', to: 'voiceL', need: 6, regions: ['hear', 'mem', 'bridge', 'lang'] },
  { id: 'catch', from: 'eyeL', to: 'handL', need: 5, fast: true, regions: ['vision', 'move'] },
  { id: 'echo', from: 'earL', to: 'handR', need: 6, regions: ['hear', 'bridge', 'move'] },
  { id: 'tell', from: 'eyeR', via: 'memL', to: 'voiceL', need: 6, regions: ['vision', 'bridge', 'mem', 'lang'] },
];

export interface Lesson extends LessonSpec {
  /** the lesson's place on the ladder (0, 1, 2…) and its round (0 the first time through) */
  index: number;
  round: number;
  /** thoughts this time */
  goal: number;
  /** the conduction limit (ms) when it is a fast lesson this round, else null */
  limitMs: number | null;
}

/** The n-th lesson of the ladder: the eight in turn, each round asking more (and, from the second, speed on the bridge's lessons too). */
export function lessonAt(index: number): Lesson {
  const i = Math.max(0, Math.floor(index));
  const spec = LESSONS[i % LESSONS.length];
  const round = Math.floor(i / LESSONS.length);
  const fast = !!spec.fast || (round >= 1 && (spec.id === 'cross' || spec.id === 'echo'));
  const limitMs = fast ? RULES.speedMs[Math.min(RULES.speedMs.length - 1, round)] : null;
  return { ...spec, index: i, round, goal: spec.need + RULES.needRound * round, limitMs };
}

export const lessonTitle = (id: LessonId): string => t(`lesson.${id}.title` as Key);
export const lessonLine = (id: LessonId): string => t(`lesson.${id}.line` as Key);

// ── Wiedza: the fact cards ──────────────────────────────────────
export type CardId =
  | 'neuron' | 'glia' | 'synapse' | 'hebb' | 'timing' | 'nmda' | 'bdnf' | 'myelin' | 'oligo' | 'white'
  | 'callosum' | 'sync' | 'language' | 'replay' | 'prune' | 'sleep' | 'glymph' | 'aqp4' | 'energy' | 'skill';

export interface Card { id: CardId; src: string }

/** The cards, in the album's order; each one's number and sentence are in i18n.ts, its source here. */
export const CARDS: readonly Card[] = [
  { id: 'neuron', src: 'Azevedo et al. 2009 · J Comp Neurol 513:532' },
  { id: 'synapse', src: 'Tang et al. 2001 · Synapse 41:258' },
  { id: 'hebb', src: 'Bliss & Lømo 1973 · J Physiol 232:331; Matsuzaki et al. 2004 · Nature 429:761' },
  { id: 'timing', src: 'Bi & Poo 1998 · J Neurosci 18:10464' },
  { id: 'nmda', src: 'Nowak et al. 1984 · Nature 307:462' },
  { id: 'bdnf', src: 'Park & Poo 2013 · Nat Rev Neurosci 14:7; Erickson et al. 2011 · PNAS 108:3017' },
  { id: 'myelin', src: 'Purves et al. · Neuroscience, 2nd ed. 2001' },
  { id: 'oligo', src: 'McKenzie et al. 2014 · Science 346:318; Gibson et al. 2014 · Science 344:1252304' },
  { id: 'white', src: 'Marner et al. 2003 · J Comp Neurol 462:144' },
  { id: 'callosum', src: 'Aboitiz et al. 1992 · Brain Res 598:143' },
  { id: 'sync', src: 'Engel et al. 1991 · Science 252:1177' },
  { id: 'language', src: 'Knecht et al. 2000 · Brain 123:2512' },
  { id: 'replay', src: 'Lee & Wilson 2002 · Neuron 36:1183; Girardeau et al. 2009 · Nat Neurosci 12:1222' },
  { id: 'prune', src: 'Petanjek et al. 2011 · PNAS 108:13281; Schafer et al. 2012 · Neuron 74:691' },
  { id: 'sleep', src: 'de Vivo et al. 2017 · Science 355:507' },
  { id: 'glymph', src: 'Xie et al. 2013 · Science 342:373' },
  { id: 'aqp4', src: 'Iliff et al. 2012 · Sci Transl Med 4:147ra111' },
  { id: 'energy', src: 'Raichle & Gusnard 2002 · PNAS 99:10237' },
  { id: 'glia', src: 'Azevedo et al. 2009 · J Comp Neurol 513:532' },
  { id: 'skill', src: 'Scholz et al. 2009 · Nat Neurosci 12:1370' },
];
export const CARD_IDS: readonly CardId[] = CARDS.map(c => c.id);

export const cardTitle = (id: CardId): string => t(`card.${id}.title` as Key);
export const cardText = (id: CardId): string => t(`card.${id}.text` as Key);
export const cardSrc = (id: CardId): string => CARDS.find(c => c.id === id)?.src ?? '';

// ── the words of a block and Oli's moments ──────────────────────
const keysOf = (prefix: string): string[] => Object.keys(CATALOGS.pl).filter(k => k.startsWith(prefix));
const linesOf = (prefix: string): string[] => keysOf(prefix).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map(k => t(k as Key));

export const TIPS = {
  warmup: linesOf('tip.warmup.'),
  push: linesOf('tip.push.'),
  blind: linesOf('tip.blind.'),
  rest: linesOf('tip.rest.'),
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
};

/** Oli's moments: what she reacts to (each with at least three lines). */
export const MOMENTS = [
  'open', 'back', 'warm', 'push', 'blind', 'rest', 'firstLink', 'link', 'strong', 'path', 'thought', 'lost', 'slow', 'fast',
  'far', 'full', 'myelin', 'nothing', 'wrapped', 'bridge', 'inStep', 'noReading', 'bloom', 'prune', 'replay', 'clean', 'lesson', 'learned',
  'good', 'end',
] as const;
export type Moment = (typeof MOMENTS)[number];

export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(
  MOMENTS.map(m => [m, linesOf(`say.${m}.`)]),
) as unknown as Record<Moment, readonly string[]>;

/** How many lines Oli has (the tests check each moment has at least three). */
export const LINE_COUNT = MOMENTS.reduce((s, m) => s + LINES[m].length, 0);

// ── numbers in words ────────────────────────────────────────────
/** "12 połączeń" (a no-break space between the number and the word). */
export const connText = (n: number): string => t('conn', { n: Math.max(0, Math.floor(n)) });

/** A conduction time: "3,4 ms" under 10, "42 ms" above. */
export const msText = (ms: number): string => t('ms', { n: fmtNum(ms, ms < 10 ? 1 : 0) });

/** A speed: "12 m/s". */
export const mpsText = (v: number): string => t('mps', { n: fmtNum(Math.round(v)) });

/** Seconds: "34 s". */
export const secText = (s: number): string => t('sec', { n: fmtNum(Math.round(s)) });
