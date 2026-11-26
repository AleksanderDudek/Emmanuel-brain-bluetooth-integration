/**
 * Sprężysty kręgosłup's quiet tune (kit/song.ts): an original, slow melody in G major at 54 beats a minute, without
 * words or drums — like water that settles and a body that straightens: phrases that rise a step at a time, rest,
 * and rise again.  Soft chords always, a low bass that joins, a bell melody, and slow arpeggios like drops when the
 * picture grows fully; the engine's layers follow the light in a push and rest at a gentle level in rest.
 *
 *   A  (beats 0–31)    I – vi – IV – V – I – iii – IV – I
 *   B  (beats 32–63)   IV – V – iii – vi – ii – V – I – I
 */
import { MAJOR, chords, melody, type Song, type SongNote, type SongPart } from '../kit/song';

const ROOTS = [0, 5, 3, 4, 0, 2, 3, 0, 3, 4, 2, 5, 1, 4, 0, 0];

/** The bell's line, a bar a phrase: up a step, a breath, up again — and home. */
const TUNE = melody([
  '4:2 5:1 6:1', '7:3 6:1', '5:2 4:2', '4:4',
  '2:2 4:1 5:1', '4:3 2:1', '3:2 2:1 1:1', '0:4',
  '3:2 4:1 5:1', '6:3 4:1', '4:2 6:2', '7:4',
  '8:2 7:1 6:1', '5:3 4:1', '2:2 1:2', '0:4',
].join(' '));

export const BEATS = 64;

/** The whole tune (64 beats ≈ 71 s at 54 bpm). */
export function buildTune(): Song {
  const bass: SongNote[] = ROOTS.map((d, i) => ({ at: i * 4, len: 3.7, deg: d, oct: -2, vel: 0.75 }));
  const drops: SongNote[] = ROOTS.flatMap((d, i) => [0, 4, 7, 11, 9, 7, 4, 2].map((k, j) => ({ at: i * 4 + j * 0.5, len: 0.5, deg: d + k, oct: -1, vel: j % 4 === 0 ? 0.6 : 0.36 })));
  const parts: SongPart[] = [
    { voice: 'pad', layer: 0, gain: 0.85, notes: chords(ROOTS, 4, 0, -1) },
    { voice: 'bass', layer: 1, gain: 0.48, notes: bass },
    { voice: 'bell', layer: 2, gain: 0.48, notes: TUNE.map(n => ({ ...n, oct: (n.oct ?? 0) + 1 })) },
    { voice: 'lead', layer: 2, gain: 0.28, notes: TUNE },
    { voice: 'pluck', layer: 3, gain: 0.3, notes: drops },
  ];
  return { bpm: 54, beats: BEATS, root: 196.0, scale: MAJOR, parts, lines: [] };
}
