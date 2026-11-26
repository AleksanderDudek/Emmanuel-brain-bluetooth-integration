/**
 * Każda komórka's quiet tune (kit/song.ts): an original, slow melody in G major at 60 beats a minute — a calm pulse,
 * like a resting heart — without words or drums: soft chords always, a low bass that joins, a bell melody that rises
 * through the middle and settles home, and a harp of slow arpeggios when the picture grows fully.  The engine lets its
 * layers follow the light in a sighted push, rest at a gentle level and hold still in a blind block.
 *
 *   A  (beats 0–31)    I – V – vi – IV – I – iii – IV – V
 *   B  (beats 32–63)   vi – IV – I – V – IV – I – ii – I
 */
import { MAJOR, chords, melody, type Song, type SongNote, type SongPart } from '../kit/song';

const ROOTS = [0, 4, 5, 3, 0, 2, 3, 4, 5, 3, 0, 4, 3, 0, 1, 0];

/** The bell's line, a bar a phrase. */
const TUNE = melody([
  '2:2 4:1 2:1', '1:2 6_:2', '0:2 2:1 4:1', '5:3 4:1',
  '4:2 7:2', '6:2 4:2', '5:1 4:1 3:2', '1:4',
  '2:2 4:2', '5:2 7:2', '9:3 7:1', '8:2 6:2',
  '7:2 5:2', '4:2 2:2', '3:2 1:2', '0:4',
].join(' '));

export const BEATS = 64;

/** The whole tune (64 beats = 64 s at 60 bpm). */
export function buildTune(): Song {
  const bass: SongNote[] = ROOTS.map((d, i) => ({ at: i * 4, len: 3.6, deg: d, oct: -2, vel: 0.8 }));
  const harp: SongNote[] = ROOTS.flatMap((d, i) => [0, 2, 4, 7, 4, 2, 4, 2].map((k, j) => ({ at: i * 4 + j * 0.5, len: 0.5, deg: d + k, oct: -1, vel: j % 4 === 0 ? 0.6 : 0.38 })));
  const parts: SongPart[] = [
    { voice: 'pad', layer: 0, gain: 0.85, notes: chords(ROOTS, 4, 0, -1) },
    { voice: 'bass', layer: 1, gain: 0.48, notes: bass },
    { voice: 'bell', layer: 2, gain: 0.48, notes: TUNE.map(n => ({ ...n, oct: (n.oct ?? 0) + 1 })) },
    { voice: 'lead', layer: 2, gain: 0.28, notes: TUNE },
    { voice: 'pluck', layer: 3, gain: 0.3, notes: harp },
  ];
  return { bpm: 60, beats: BEATS, root: 196, scale: MAJOR, parts, lines: [] };
}
