/**
 * Wzlot's data: the flight lessons ("Lekcje lotu", Tiny Wings' nest objectives — three at a time,
 * a full set grows the nest and raises its multiplier), the plumages the nest unlocks, the
 * companion's moments, and the strategies under a block's name.  The words live in i18n.ts.
 */
import { t, type Key } from './i18n';

/** What a lesson counts.  "Day" kinds count within one day (one run); "all" kinds across sessions. */
export type LessonKind =
  | 'perfectDay' | 'coinsAll' | 'granDay' | 'chainDay' | 'cloudDay' | 'airFlight' | 'thermalDay'
  | 'pointsDay' | 'feverDay' | 'quickGran' | 'daysSession' | 'bandFever' | 'orbDay';

export interface Lesson { kind: LessonKind; target: number }

/** The lesson sets, in order: touch feats first, one for the band now and then; never a lapse. */
export const SETS: readonly (readonly Lesson[])[] = [
  [{ kind: 'perfectDay', target: 5 }, { kind: 'coinsAll', target: 100 }, { kind: 'granDay', target: 2 }],
  [{ kind: 'chainDay', target: 3 }, { kind: 'cloudDay', target: 1 }, { kind: 'airFlight', target: 3 }],
  [{ kind: 'granDay', target: 3 }, { kind: 'thermalDay', target: 2 }, { kind: 'pointsDay', target: 1500 }],
  [{ kind: 'feverDay', target: 10 }, { kind: 'coinsAll', target: 400 }, { kind: 'orbDay', target: 2 }],
  [{ kind: 'granDay', target: 4 }, { kind: 'cloudDay', target: 3 }, { kind: 'quickGran', target: 1 }],
  [{ kind: 'chainDay', target: 6 }, { kind: 'daysSession', target: 3 }, { kind: 'airFlight', target: 5 }],
  [{ kind: 'granDay', target: 5 }, { kind: 'bandFever', target: 1 }, { kind: 'pointsDay', target: 4000 }],
  [{ kind: 'feverDay', target: 25 }, { kind: 'coinsAll', target: 1500 }, { kind: 'perfectDay', target: 25 }],
];

/** The lessons of set `i` (0-based); past the written sets, the last one grows a little each time. */
export function lessonsOf(i: number): Lesson[] {
  if (i < SETS.length) return SETS[i].map(l => ({ ...l }));
  const k = i - SETS.length + 1;
  return [
    { kind: 'granDay', target: Math.min(9, 5 + k) },
    { kind: 'perfectDay', target: 25 + 5 * k },
    { kind: 'pointsDay', target: 4000 + 1500 * k },
  ];
}

/** A lesson in words ("5 idealnych ślizgów w jeden dzień"). */
export function lessonText(l: Lesson): string {
  return t(`lesson.${l.kind}` as Key, { n: l.target });
}

/** The plumage for a nest level: 1 down, 2 first feathers (from level 3), 3 flight feathers (from 5). */
export function plumageFor(nest: number, at: readonly number[]): 1 | 2 | 3 {
  return nest >= at[1] ? 3 : nest >= at[0] ? 2 : 1;
}

/** Leon's moments: each has at least three lines in every language (i18n `talk.<moment>.<n>`). */
export type Moment =
  | 'open' | 'dawn' | 'push' | 'rest' | 'goodPush' | 'perfect' | 'fever' | 'bandFever' | 'bump' | 'catch'
  | 'gran' | 'cloud' | 'thermal' | 'nightNear' | 'dayEnd' | 'record' | 'blind' | 'nest' | 'idle';

export const LINE_COUNT: Readonly<Record<Moment, number>> = {
  open: 3, dawn: 4, push: 4, rest: 4, goodPush: 4, perfect: 4, fever: 4, bandFever: 3, bump: 4, catch: 4,
  gran: 4, cloud: 3, thermal: 3, nightNear: 4, dayEnd: 4, record: 3, blind: 3, nest: 3, idle: 3,
};

export const MOMENTS = Object.keys(LINE_COUNT) as Moment[];

/** All of Leon's lines, in this page's language. */
export function lines(): Record<Moment, string[]> {
  const out = {} as Record<Moment, string[]>;
  for (const m of MOMENTS) {
    out[m] = [];
    for (let i = 1; i <= LINE_COUNT[m]; i++) out[m].push(t(`talk.${m}.${i}` as Key));
  }
  return out;
}

/** What to do in the head, block by block: strategies, never "concentrate harder". */
export const TASKS = {
  push: ['task.push.1', 'task.push.2', 'task.push.3', 'task.push.4', 'task.push.5'],
  blind: ['task.blind.1', 'task.blind.2'],
  rest: ['task.rest.1', 'task.rest.2', 'task.rest.3'],
} as const;
