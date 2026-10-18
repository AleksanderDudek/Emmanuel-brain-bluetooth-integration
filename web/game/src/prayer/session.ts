/**
 * A prayer of the heart in progress: the invocation repeated in focus until the prayer is full.
 * Focus comes from the band (the multiplier can reach ×3), from the invocation heard aloud (×2),
 * or from stillness — nothing touched — (×1.5). `seconds` is the length at ×1 with plain
 * stillness; held focus shortens it, and every repetition heard aloud adds a little at once.
 */
import { chargeFactor, FocusCharger, SOURCE_CAP, THRESHOLD, type FocusReading, type FocusState } from '../neuro/focus';
import { RepetitionCounter } from './matcher';

/** seconds a repetition heard aloud keeps the voice focused */
export const VOICE_HOLD = 6;
/** seconds of prayer added at once by each repetition heard aloud */
export const VOICE_BONUS = 1.5;
/** seconds without a touch or key before stillness counts as focus */
export const STILL_AFTER = 1.5;
const VOICE_LEVEL = 0.8;
const STILL_LEVEL = 0.62;
const RESTLESS_LEVEL = 0.2;
/** plain stillness at ×1 fills `seconds` exactly */
const REF = chargeFactor({ level: STILL_LEVEL, mult: 1 } as FocusState);

export interface SessionInput {
  /** focus from the band (0..1) while its signal is reliable, else null */
  band: number | null;
  /** seconds since the last touch, click or key */
  idle: number;
}

export interface SessionState {
  focus: FocusState;
  progress: number;
  done: boolean;
}

export class PrayerSession {
  private readonly charger = new FocusCharger();
  private readonly counter: RepetitionCounter;
  private charge = 0;
  private voiceT = 0;
  repetitions = 0;

  constructor(invocation: string, readonly seconds: number) {
    this.counter = new RepetitionCounter(invocation);
  }

  /** A final transcript from speech recognition; returns the repetitions it completed. */
  heard(text: string): number {
    const n = this.counter.feed(text);
    if (n > 0) {
      this.repetitions += n;
      this.voiceT = VOICE_HOLD;
      this.charge += n * VOICE_BONUS;
    }
    return n;
  }

  update(dt: number, input: SessionInput): SessionState {
    this.voiceT = Math.max(0, this.voiceT - dt);
    const focus = this.charger.update(dt, sessionReading(input.band, this.voiceT > 0, input.idle >= STILL_AFTER));
    this.charge += (dt * chargeFactor(focus)) / REF;
    const progress = Math.min(1, this.charge / this.seconds);
    return { focus, progress, done: progress >= 1 };
  }
}

/** The best source that reads as focused sets the cap; the level is the best of all, so nothing ever lowers it. */
export function sessionReading(band: number | null, voice: boolean, still: boolean): FocusReading {
  const cands: FocusReading[] = [];
  if (band !== null) cands.push({ level: band, source: 'band' });
  if (voice) cands.push({ level: VOICE_LEVEL, source: 'voice' });
  if (still) cands.push({ level: STILL_LEVEL, source: 'still' });
  const level = Math.max(RESTLESS_LEVEL, ...cands.map(c => c.level));
  const focused = cands.filter(c => c.level >= THRESHOLD).sort((a, b) => SOURCE_CAP[b.source] - SOURCE_CAP[a.source]);
  return { level, source: focused[0]?.source ?? (band !== null ? 'band' : 'none') };
}
