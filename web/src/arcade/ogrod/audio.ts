/**
 * Ogród o świcie's soundscape (DESIGN.md §23), on the kit's synthesiser (kit/audio.ts): the night garden after rain
 * turning to dawn.  CONTRACT (lead): builder B owns this file and fills it; builder A's index.ts creates one per session
 * and drives it.  Change the shapes only through the status files.  LEAD STUB: every method a no-op until B's lands.
 */
import type { ArcadeAudio } from '../kit/audio';
import type { BreathState } from '../kit/breath';
import type { StationId } from './stations';

/** Where the session is: the arrival, a station, the dawn (its prayer), the close (the 0–10 and the blessing). */
export type Place = 'arrive' | StationId | 'dawn' | 'close';

/** A moment's sound, from the sim's events (builder A maps them). */
export type SoundCue =
  | 'wave' | 'drop'            // lzy: a wave of feeling rises; a tear of light gathered into the vessel
  | 'warm' | 'kind'            // dlon: the hands come to rest; the kind word written in light
  | 'fold' | 'sail'            // list: the letter folds into a boat; the boat sets out
  | 'gate' | 'rose'            // furtka: the gate closes softly; the rose opens over it
  | 'stone' | 'ring'           // kamienie: the stone falls into the water; its rings spread
  | 'lantern' | 'bless'        // latarnie: a lantern lights; its blessing
  | 'seed' | 'sprout'          // nasiona: a seed sown; it sprouts in the rain of light
  | 'bird' | 'sun' | 'bloom' | 'call' // the dawn: the first bird, the sun's rim, the garden's flowers opening, the name called
  | 'grace'                    // an act the time finished gently (no focus): a soft chord, never a failure sound
  | 'step';                    // the camera walks to the next station

export interface SoundState {
  place: Place;
  /** the night (0) to the risen sun (1) */
  dawn: number;
  /** a rest block (receptive, whole breaths) */
  rest: boolean;
  /** the focus light now, 0…1 (a sighted push past its lead-in; 0 elsewhere) */
  light: number;
  /** the breath in a rest (the breath guide's), else null */
  breath: BreathState | null;
}

export class GardenSound {
  constructor(private readonly a: ArcadeAudio, private readonly o: { reducedMotion?: boolean } = {}) {}
  /** The session's play begins (the calibration has its own sound). */
  start(): void { void this.a; void this.o; }
  /** Every frame. */
  update(dt: number, s: SoundState): void { void dt; void s; }
  cue(c: SoundCue): void { void c; }
  /** The session paused / resumed. */
  pause(on: boolean): void { void on; }
  /** The close's end: everything fades over a few seconds. */
  finish(): void {}
  destroy(): void {}
}
