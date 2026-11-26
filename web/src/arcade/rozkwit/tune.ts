/**
 * Rozkwit's quiet tune (kit/song.ts): an original, opening melody in A major at 62 beats a minute — a flower opening
 * slowly, without words or drums: soft chords always, a low bass that joins, a bell melody that climbs a step at a
 * time to the high third and comes home, and a harp of rising arpeggios when the picture grows fully.  The engine lets
 * its layers follow the light in a sighted push, rest at a gentle level and hold still in a blind block.
 *
 *   A  (beats 0–31)    I – vi – IV – V – I – iii – IV – V
 *   B  (beats 32–63)   vi – IV – I – V – ii – IV – V – I
 */
import { MAJOR, chords, melody, type Song, type SongNote, type SongPart } from '../kit/song';

const ROOTS = [0, 5, 3, 4, 0, 2, 3, 4, 5, 3, 0, 4, 1, 3, 4, 0];

/** The bell's line, a bar a phrase: a bud, a leaf, the petals one by one, the open flower, home. */
const TUNE = melody([
  '2:2 4:2', '5:3 4:1', '3:2 5:2', '4:4',
  '4:1 5:1 7:2', '6:2 4:2', '5:2 3:2', '1:4',
  '2:2 4:1 5:1', '7:3 5:1', '4:2 7:2', '9:4',
  '8:2 6:2', '7:2 5:1 3:1', '4:2 1:2', '0:4',
].join(' '));

export const BEATS = 64;

/** The whole tune (64 beats ≈ 62 s at 62 bpm). */
export function buildTune(): Song {
  const bass: SongNote[] = ROOTS.map((d, i) => ({ at: i * 4, len: 3.6, deg: d, oct: -2, vel: 0.8 }));
  const harp: SongNote[] = ROOTS.flatMap((d, i) => [0, 2, 4, 7, 9, 11, 9, 7].map((k, j) => ({ at: i * 4 + j * 0.5, len: 0.5, deg: d + k, oct: -1, vel: j % 4 === 0 ? 0.6 : 0.36 })));
  const parts: SongPart[] = [
    { voice: 'pad', layer: 0, gain: 0.85, notes: chords(ROOTS, 4, 0, -1) },
    { voice: 'bass', layer: 1, gain: 0.48, notes: bass },
    { voice: 'bell', layer: 2, gain: 0.46, notes: TUNE.map(n => ({ ...n, oct: (n.oct ?? 0) + 1 })) },
    { voice: 'lead', layer: 2, gain: 0.26, notes: TUNE },
    { voice: 'pluck', layer: 3, gain: 0.3, notes: harp },
  ];
  return { bpm: 62, beats: BEATS, root: 220, scale: MAJOR, parts, lines: [] };
}
