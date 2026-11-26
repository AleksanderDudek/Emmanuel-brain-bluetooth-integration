/**
 * STUB (lead) — builder B ("ring") fills it: the fight's sound on the runner's audio graph (env.audio): the hall and
 * the crowd, the bell, gloves on gloves and on the body, kicks, the swish of a slip, the slow motion (the world's
 * sound sinks and slows, a heartbeat, the charge rising), the referee's count, the win.  Cues are fire-and-forget
 * and throttled inside; `update` every frame.
 */
import type { ArcadeAudio } from '../kit/audio';
import type { Phase } from './view';

export type RingCue =
  | 'bell' | 'touch' | 'jab' | 'punch' | 'body' | 'kick' | 'blocked' | 'slip' | 'whoosh' | 'takedown'
  | 'slowIn' | 'slowOut' | 'ready' | 'release' | 'down' | 'count' | 'rise' | 'ko' | 'win' | 'lose' | 'crowd';

export class RingSound {
  constructor(readonly audio: ArcadeAudio, readonly o: { reducedMotion: boolean }) {}
  start(): void {}
  /** a moment's sound; strength 0..1 */
  cue(c: RingCue, strength = 1): void { void c; void strength; }
  update(dt: number, s: { phase: Phase; slow: number; crowd: number; energy: number; breath: number }): void { void dt; void s; }
  pause(p: boolean): void { void p; }
  finish(): void {}
  destroy(): void {}
}
