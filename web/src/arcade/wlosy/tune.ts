/**
 * Każdy włos's quiet tune (kit/song.ts): an original, slow lullaby-like melody in F major at 56 beats a minute,
 * without words or drums — soft chords always, a low bass that joins, a bell melody, and a harp of slow arpeggios when
 * the picture grows fully.  Its layers follow the light in a sighted push, rest at a gentle level, hold still in a
 * blind block; in the key of the scene bells (audio.ts), so they ring inside it.
 *
 *   A  (beats 0–31)    I – iii – IV – I – vi – IV – ii – V
 *   B  (beats 32–63)   IV – I – vi – iii – IV – I – V – I
 */
import { MAJOR, chords, melody, type Song, type SongNote, type SongPart } from '../kit/song';

const ROOTS = [0, 2, 3, 0, 5, 3, 1, 4, 3, 0, 5, 2, 3, 0, 4, 0];

/** The bell's line, a bar a phrase: rising slowly like a strand, settling home. */
const TUNE = melody([
  '2:2 4:2', '4:3 6:1', '5:2 4:2', '2:4',
  '0:2 2:2', '3:2 5:2', '4:3 3:1', '1:4',
  '3:2 5:2', '7:3 6:1', '5:2 4:2', '4:4',
  '5:2 4:2', '2:2 4:2', '1:2 6_:2', '0:4',
].join(' '));

export const BEATS = 64;

/** The whole tune (64 beats ≈ 69 s at 56 bpm). */
export function buildTune(): Song {
  const bass: SongNote[] = ROOTS.map((d, i) => ({ at: i * 4, len: 3.6, deg: d, oct: -2, vel: 0.8 }));
  const harp: SongNote[] = ROOTS.flatMap((d, i) => [0, 4, 7, 9, 7, 4, 2, 4].map((k, j) => ({ at: i * 4 + j * 0.5, len: 0.5, deg: d + k, oct: -1, vel: j % 4 === 0 ? 0.65 : 0.4 })));
  const parts: SongPart[] = [
    { voice: 'pad', layer: 0, gain: 0.85, notes: chords(ROOTS, 4, 0, -1) },
    { voice: 'bass', layer: 1, gain: 0.5, notes: bass },
    { voice: 'bell', layer: 2, gain: 0.5, notes: TUNE.map(n => ({ ...n, oct: (n.oct ?? 0) + 1 })) },
    { voice: 'lead', layer: 2, gain: 0.3, notes: TUNE },
    { voice: 'pluck', layer: 3, gain: 0.32, notes: harp },
  ];
  return { bpm: 56, beats: BEATS, root: 174.61, scale: MAJOR, parts, lines: [] };
}
