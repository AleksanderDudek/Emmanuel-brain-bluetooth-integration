/**
 * Pełnia radości's quiet tune (kit/song.ts): an original, gently lilting melody in D major at 66 beats a minute —
 * brighter than the section's lullabies, still without words or drums: soft chords always, a low bass that joins, a
 * bell melody that climbs to the octave and comes home, and a harp of arpeggios when the picture grows fully.  The
 * engine lets its layers follow the light in a sighted push, rest at a gentle level and hold still in a blind block.
 *
 *   A  (beats 0–31)    I – IV – vi – V – I – IV – ii – V
 *   B  (beats 32–63)   IV – V – iii – vi – IV – I – V – I
 */
import { MAJOR, chords, melody, type Song, type SongNote, type SongPart } from '../kit/song';

const ROOTS = [0, 3, 5, 4, 0, 3, 1, 4, 3, 4, 2, 5, 3, 0, 4, 0];

/** The bell's line, a bar a phrase: rising like light, settling home. */
const TUNE = melody([
  '4:2 5:1 4:1', '3:2 5:2', '7:3 5:1', '4:4',
  '4:1 5:1 7:2', '7:2 5:2', '5:2 3:2', '4:4',
  '5:2 7:2', '8:3 7:1', '6:2 4:2', '5:4',
  '3:1 5:1 7:2', '9:2 7:2', '8:1 6:1 4:2', '7:4',
].join(' '));

export const BEATS = 64;

/** The whole tune (64 beats ≈ 58 s at 66 bpm). */
export function buildTune(): Song {
  const bass: SongNote[] = ROOTS.map((d, i) => ({ at: i * 4, len: 3.6, deg: d, oct: -2, vel: 0.8 }));
  const harp: SongNote[] = ROOTS.flatMap((d, i) => [0, 2, 4, 7, 9, 7, 4, 2].map((k, j) => ({ at: i * 4 + j * 0.5, len: 0.5, deg: d + k, oct: -1, vel: j % 4 === 0 ? 0.6 : 0.38 })));
  const parts: SongPart[] = [
    { voice: 'pad', layer: 0, gain: 0.85, notes: chords(ROOTS, 4, 0, -1) },
    { voice: 'bass', layer: 1, gain: 0.48, notes: bass },
    { voice: 'bell', layer: 2, gain: 0.48, notes: TUNE.map(n => ({ ...n, oct: (n.oct ?? 0) + 1 })) },
    { voice: 'lead', layer: 2, gain: 0.28, notes: TUNE },
    { voice: 'pluck', layer: 3, gain: 0.3, notes: harp },
  ];
  return { bpm: 66, beats: BEATS, root: 146.83, scale: MAJOR, parts, lines: [] };
}
