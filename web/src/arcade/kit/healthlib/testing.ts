/**
 * A test helper for the games of the health visualisations (DESIGN.md §24): a whole session of the engine's sim with
 * scripted focus, pure and without the DOM — so each game's test can say, in a few lines, that its library scores in
 * the app smoke's 40 s test session (`?trainingSec=40`), first-ever and returning, and grows nothing without focus:
 *
 *   expect(simSession(LIBRARY).score).toBeGreaterThan(0);                       // a first-ever 40 s session
 *   expect(simSession(LIBRARY, { returning: true }).score).toBeGreaterThan(0);  // a returning player
 *   expect(simSession(LIBRARY, { focus: 'none' }).grownSec).toBe(0);            // nothing without focus
 *
 * By default it plays like the smoke test's crude input: the band reads focus (calm in rest), a tap on the picture
 * every 0.65 s and Space every 2 s (which turn the story cards' pages, as a player would).
 */
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../focus';
import { mulberry32 } from '../../../core/random';
import type { ArcadeOutcome } from '../types';
import { freshProgress, type HealthProgress } from './meta';
import { RULES } from './rules';
import { HealthSim, type SimEvent } from './sim';
import type { HealthLibrary } from './spec';

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });

/** Scripted band readings: strong focus, moderate focus, a signal without focus, calm, no signal at all. */
export const FRAMES = {
  high: frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 }),
  mid: frame({ level: 0.6, activity: 2.4, focused: true, hold: 4, calm: 0.35 }),
  unfocused: frame({ level: 0.4, activity: 1.6, focused: false, hold: 0, calm: 0.5 }),
  calm: frame({ level: 0.1, activity: -2, calm: 0.9 }),
  none: frame({ reliable: false, activity: null, level: 0, calm: 0, focused: false }),
} as const;

export type FocusScript = keyof typeof FRAMES | FocusFrame | ((t: number, sim: HealthSim) => FocusFrame);

/** Every first-time card and coach mark already seen (a player who has been here before). */
export const ALL_SEEN = ['s.open', 'c.grow', 'c.nav', 'c.pick', 'c.breath', 'c.blind'];

export interface SimSessionOpts {
  /** the planned length (s): 40 by default (the app smoke's ?trainingSec=40) */
  planned?: number;
  /** how long to run (s): by default until the session is done (planned + the settle time) */
  sec?: number;
  /** a returning player (5 sessions behind, every card seen) instead of a first-ever one */
  returning?: boolean;
  /** what the band reads in a push and the warm-up ('high' by default); rest reads calm unless `restFocus` */
  focus?: FocusScript;
  /** the band's reading in rest too (else calm) */
  restFocus?: boolean;
  /** tap like the smoke test (a tap every 0.65 s, Space every 2 s): true by default */
  taps?: boolean;
  /** progress fields over the fresh (or returning) one */
  progress?: Partial<HealthProgress>;
  seed?: number;
  eeg?: boolean;
  tuning?: FocusTuning;
  rhythm?: { focus: number; rest: number } | null;
  /** called every step (e.g. to walk or pick); `t` is the session's clock */
  each?: (t: number, sim: HealthSim) => void;
}

export interface SimSessionResult {
  /** the headline (units from focused growth) */
  score: number;
  /** the sim's seconds of focused growth */
  grownSec: number;
  /** scenes grown and meditations completed this session */
  scenes: number;
  meds: number;
  outcome: ArcadeOutcome;
  progress: HealthProgress;
  sim: HealthSim;
  events: SimEvent[];
  /** every narrator line said */
  said: string[];
}

const STEP = 1 / 60;

/** Run one session of the engine's sim on a library with scripted focus (pure: no DOM, no clock). */
export function simSession(lib: HealthLibrary, o: SimSessionOpts = {}): SimSessionResult {
  const planned = o.planned ?? 40;
  const base = freshProgress(lib);
  const progress: HealthProgress = o.returning
    ? { ...base, sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress }
    : { ...base, ...o.progress };
  const tuning = o.tuning ?? (o.returning ? { ...DEFAULT_TUNING, adapt: 0.08 } : { ...DEFAULT_TUNING, adapt: 0.08, ...BEGINNER_TUNING });
  const sim = new HealthSim({ lib, progress, rng: mulberry32(o.seed ?? 1), plannedSec: planned, eeg: o.eeg ?? false, tuning, rhythm: o.rhythm });
  sim.start();
  const focus = o.focus ?? 'high';
  const read = (t: number): FocusFrame => {
    if (sim.restBlock && !o.restFocus) return typeof focus === 'string' && focus === 'none' ? FRAMES.none : FRAMES.calm;
    if (typeof focus === 'function') return focus(t, sim);
    return typeof focus === 'string' ? FRAMES[focus] : focus;
  };
  const events: SimEvent[] = [...sim.take()];
  const sec = o.sec ?? planned + RULES.settle;
  const taps = o.taps ?? true;
  let nextTap = 0.65, nextSpace = 2;
  for (let i = 0, n = Math.round(sec / STEP); i < n && sim.phase !== 'done'; i++) {
    const t = (i + 1) * STEP;
    sim.update(STEP, read(t), t);
    if (taps) {
      if (t >= nextTap) {
        nextTap += 0.65;
        sim.stay();
      }
      if (t >= nextSpace) {
        nextSpace += 2;
        sim.key(' ', true);
        sim.key(' ', false);
      }
    }
    o.each?.(t, sim);
    events.push(...sim.take());
  }
  if (sim.phase !== 'done') sim.finish();
  events.push(...sim.take());
  const outcome = sim.result();
  let scenes = 0;
  for (const e of events) if (e.type === 'grown') scenes++;
  return { score: outcome.score, grownSec: sim.growSec, scenes, meds: sim.wholes, outcome, progress, sim, events, said: [...sim.talk.said] };
}
