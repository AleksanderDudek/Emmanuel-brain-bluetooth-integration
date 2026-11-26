/**
 * STUB (lead) — builder B ("street") fills it: the street's sound through the day on the runner's audio graph
 * (morning birds and a café's murmur, noon traffic far away, evening crickets), the card's turn (a paper whisper
 * warming into a chime), a light flying up into the garland (a rising bell, each a note higher in the day's scale —
 * a streak you can hear), the pocket (a soft thud), the evening chord.  Cues are throttled inside.
 */
import type { ArcadeAudio } from '../kit/audio';
import type { Phase } from './view';

export type StreetCue = 'arrive' | 'turnStart' | 'turned' | 'light' | 'carry' | 'trust' | 'heavy' | 'evening' | 'dawn';

export class StreetSound {
  constructor(readonly audio: ArcadeAudio, readonly o: { reducedMotion: boolean }) {}
  start(): void {}
  /** `n` = the light's number in the streak (the bell climbs the scale with it) */
  cue(c: StreetCue, n = 0): void { void c; void n; }
  update(dt: number, s: { phase: Phase; day: number; glow: number; breath: number }): void { void dt; void s; }
  pause(p: boolean): void { void p; }
  finish(): void {}
  destroy(): void {}
}
