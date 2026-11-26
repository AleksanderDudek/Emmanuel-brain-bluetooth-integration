/**
 * Mocne zęby's quiet tune (kit/song.ts): an original, slow melody in A major at 58 beats a minute, without words or
 * drums — like clear water lapping: a third down and back up, phrases that rest on the fifth, then home.  Soft
 * chords always, a low bass that joins, a bell melody, and slow arpeggios like drops when the picture grows fully;
 * the engine's layers follow the light in a push and rest at a gentle level in rest.
 *
 *   A  (beats 0–31)    I – IV – vi – V – I – iii – IV – V
 *   B  (beats 32–63)   vi – IV – I – V – ii – IV – V – I
 */
import { MAJOR, chords, melody, type Song, type SongNote, type SongPart } from '../kit/song';

const ROOTS = [0, 3, 5, 4, 0, 2, 3, 4, 5, 3, 0, 4, 1, 3, 4, 0];

/** The bell's line, a bar a chord: a lapping third, a held note, and home. */
const TUNE = melody([
  '4:2 2:1 4:1', '5:3 3:1', '2:2 0:1 2:1', '1:4',
  '4:2 6:1 7:1', '6:3 4:1', '5:2 3:1 5:1', '4:4',
  '7:2 5:1 4:1', '3:3 5:1', '4:2 2:1 0:1', '1:4',
  '1:2 3:1 5:1', '5:3 3:1', '4:2 1:1 2:1', '0:4',
].join(' '));

export const BEATS = 64;

/** The whole tune (64 beats ≈ 66 s at 58 bpm). */
export function buildTune(): Song {
  const bass: SongNote[] = ROOTS.map((d, i) => ({ at: i * 4, len: 3.6, deg: d, oct: -2, vel: 0.7 }));
  const drops: SongNote[] = ROOTS.flatMap((d, i) => [0, 2, 4, 7, 9, 7, 4, 2].map((k, j) => ({ at: i * 4 + j * 0.5, len: 0.5, deg: d + k, oct: -1, vel: j % 4 === 0 ? 0.55 : 0.32 })));
  const parts: SongPart[] = [
    { voice: 'pad', layer: 0, gain: 0.85, notes: chords(ROOTS, 4, 0, -1) },
    { voice: 'bass', layer: 1, gain: 0.45, notes: bass },
    { voice: 'bell', layer: 2, gain: 0.46, notes: TUNE.map(n => ({ ...n, oct: (n.oct ?? 0) + 1 })) },
    { voice: 'lead', layer: 2, gain: 0.26, notes: TUNE },
    { voice: 'pluck', layer: 3, gain: 0.28, notes: drops },
  ];
  return { bpm: 58, beats: BEATS, root: 220.0, scale: MAJOR, parts, lines: [] };
}
