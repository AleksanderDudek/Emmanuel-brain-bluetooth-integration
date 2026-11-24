/** The shapes the meditation and its music share (re-exported by ./index.ts). */

/** The meditation's stage, for the music's colour (the meditation's own stage ids). */
export type MusicStage = 'arrive' | 'gather' | 'gold' | 'beat' | 'radiance' | 'close';

/** What the meditation tells the music every frame. */
export interface MusicMood {
  stage: MusicStage;
  /** the light the player's focus shows now, 0..1 (already smoothed by the meditation) */
  light: number;
  /** a rest block: the music settles */
  rest: boolean;
}

/** Moments the music marks with a small sound (soft, never a game "ding"). */
export type MusicCue = 'lift' | 'clean' | 'place' | 'seam' | 'beat' | 'bloom';

/** A rectangle in canvas CSS px. */
export interface Rect { x: number; y: number; w: number; h: number }
