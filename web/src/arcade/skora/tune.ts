/**
 * Żywa skóra's quiet tune (kit/song.ts): an original, slow melody in E♭ major at 58 beats a minute, without words or
 * drums — warm like skin in sunlight: a phrase that rises gently and settles, as a cell rises and comes to rest at the
 * surface.  Soft chords always, a low bass that joins, a bell melody, and slow glinting arpeggios when the picture
 * grows fully; the engine's layers follow the light in a push and rest at a gentle level in rest.
 *
 *   A  (beats 0–31)    I – iii – IV – I – vi – IV – V – I
 *   B  (beats 32–63)   IV – I – ii – V – vi – iii – IV – I
 */
import { MAJOR, chords, melody, type Song, type SongNote, type SongPart } from '../kit/song';

const ROOTS = [0, 2, 3, 0, 5, 3, 4, 0, 3, 0, 1, 4, 5, 2, 3, 0];

/** The bell's line, a bar a phrase: a gentle rise, a turn, and rest. */
const TUNE = melody([
  '2:2 4:1 5:1', '4:3 2:1', '5:2 7:2', '4:4',
  '5:2 4:1 2:1', '3:3 5:1', '6:2 4:1 1:1', '2:4',
  '5:2 7:1 8:1', '7:3 4:1', '3:2 5:2', '4:4',
  '7:2 5:1 4:1', '4:3 2:1', '3:2 1:2', '0:4',
].join(' '));

export const BEATS = 64;

/** The whole tune (64 beats ≈ 66 s at 58 bpm). */
export function buildTune(): Song {
  const bass: SongNote[] = ROOTS.map((d, i) => ({ at: i * 4, len: 3.7, deg: d, oct: -2, vel: 0.72 }));
  const glints: SongNote[] = ROOTS.flatMap((d, i) => [0, 2, 4, 7, 9, 7, 4, 2].map((k, j) => ({ at: i * 4 + j * 0.5, len: 0.5, deg: d + k, oct: -1, vel: j % 4 === 0 ? 0.58 : 0.34 })));
  const parts: SongPart[] = [
    { voice: 'pad', layer: 0, gain: 0.85, notes: chords(ROOTS, 4, 0, -1) },
    { voice: 'bass', layer: 1, gain: 0.46, notes: bass },
    { voice: 'bell', layer: 2, gain: 0.46, notes: TUNE.map(n => ({ ...n, oct: (n.oct ?? 0) + 1 })) },
    { voice: 'lead', layer: 2, gain: 0.26, notes: TUNE },
    { voice: 'pluck', layer: 3, gain: 0.28, notes: glints },
  ];
  return { bpm: 58, beats: BEATS, root: 155.56, scale: MAJOR, parts, lines: [] };
}
