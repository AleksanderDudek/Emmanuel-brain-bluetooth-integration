/**
 * Nowe siły's quiet tune (kit/song.ts): an original, slowly rising melody in F major at 60 beats a minute — a morning
 * song after a tired night, without words or drums: soft chords always, a low bass that joins, a bell melody that
 * climbs step by step and rests, and a harp of slow arpeggios when the picture grows fully.  The engine lets its
 * layers follow the light in a sighted push, rest at a gentle level and hold still in a blind block.
 *
 *   A  (beats 0–31)    I – vi – IV – V – I – iii – IV – V
 *   B  (beats 32–63)   vi – IV – I – V – IV – V – I – I
 */
import { MAJOR, chords, melody, type Song, type SongNote, type SongPart } from '../kit/song';

const ROOTS = [0, 5, 3, 4, 0, 2, 3, 4, 5, 3, 0, 4, 3, 4, 0, 0];

/** The bell's line, a bar a phrase: climbing slowly, as strength returns, and coming home. */
const TUNE = melody([
  '2:3 4:1', '5:2 4:2', '3:3 5:1', '4:4',
  '4:2 5:1 7:1', '6:2 4:2', '5:2 3:2', '4:4',
  '7:3 5:1', '5:2 3:2', '4:2 6:2', '7:4',
  '8:2 7:1 5:1', '6:2 4:2', '5:2 2:2', '4:4',
].join(' '));

export const BEATS = 64;

/** The whole tune (64 beats = 64 s at 60 bpm). */
export function buildTune(): Song {
  const bass: SongNote[] = ROOTS.map((d, i) => ({ at: i * 4, len: 3.7, deg: d, oct: -2, vel: 0.78 }));
  const harp: SongNote[] = ROOTS.flatMap((d, i) => [0, 2, 4, 7, 4, 2].map((k, j) => ({ at: i * 4 + j * (4 / 6), len: 0.66, deg: d + k, oct: -1, vel: j === 0 ? 0.6 : 0.36 })));
  const parts: SongPart[] = [
    { voice: 'pad', layer: 0, gain: 0.85, notes: chords(ROOTS, 4, 0, -1) },
    { voice: 'bass', layer: 1, gain: 0.46, notes: bass },
    { voice: 'bell', layer: 2, gain: 0.46, notes: TUNE.map(n => ({ ...n, oct: (n.oct ?? 0) + 1 })) },
    { voice: 'lead', layer: 2, gain: 0.26, notes: TUNE },
    { voice: 'pluck', layer: 3, gain: 0.28, notes: harp },
  ];
  return { bpm: 60, beats: BEATS, root: 174.61, scale: MAJOR, parts, lines: [] };
}
