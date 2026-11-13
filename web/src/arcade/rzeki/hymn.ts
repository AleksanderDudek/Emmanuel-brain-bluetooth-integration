/**
 * Rzeki żywej wody's quiet chorale (kit/song.ts): a slow hymn-like tune in D major at 54 beats a minute,
 * without words (the prayer on the screen is the text) and without drums — an organ of soft chords that
 * always plays, a low bass that joins, a bell melody above, and a harp of slow arpeggios when the light is
 * high.  Its layers follow the light in a sighted push, rest at a gentle level, hold still in a blind block.
 * An original tune, in the key of the place bells (audio.ts), so they ring inside it.
 *
 *   A  (beats 0–31)    I – vi – IV – V – I – IV – ii – V
 *   B  (beats 32–63)   I – iii – IV – I – vi – ii – V – I
 */
import { MAJOR, chords, melody, type Song, type SongNote, type SongPart } from '../kit/song';

const ROOTS_A = [0, 5, 3, 4, 0, 3, 1, 4];
const ROOTS_B = [0, 2, 3, 0, 5, 1, 4, 0];
const ROOTS = [...ROOTS_A, ...ROOTS_B];

/** The bell's line, a bar a phrase: rising in A as the light comes, settling home in B. */
const TUNE = melody([
  '4:2 2:2', '0:2 2:2', '3:3 2:1', '1:4',            // A, bars 1–4
  '4:2 5:2', '5:2 3:2', '1:2 3:2', '4:4',            // A, bars 5–8
  '7:2 6:2', '4:2 6:2', '5:3 4:1', '2:4',            // B, bars 1–4
  '0:2 2:2', '3:2 1:2', '1:2 6_:2', '0:4',           // B, bars 5–8
].join(' '));

export const BEATS = 64;

/** The whole chorale (64 beats ≈ 71 s at 54 bpm). */
export function buildHymn(): Song {
  const bass: SongNote[] = ROOTS.flatMap((d, i) => [
    { at: i * 4, len: 3.6, deg: d, oct: -2, vel: 0.8 },
  ]);
  const harp: SongNote[] = ROOTS.flatMap((d, i) => [0, 2, 4, 7, 4, 2, 4, 9].map((k, j) => ({ at: i * 4 + j * 0.5, len: 0.5, deg: d + k, oct: -1, vel: j % 4 === 0 ? 0.7 : 0.45 })));
  const parts: SongPart[] = [
    { voice: 'pad', layer: 0, gain: 0.9, notes: chords(ROOTS, 4, 0, -1) },
    { voice: 'bass', layer: 1, gain: 0.55, notes: bass },
    { voice: 'bell', layer: 2, gain: 0.55, notes: TUNE.map(n => ({ ...n, oct: (n.oct ?? 0) + 1 })) },
    { voice: 'lead', layer: 2, gain: 0.35, notes: TUNE },
    { voice: 'pluck', layer: 3, gain: 0.35, notes: harp },
  ];
  return { bpm: 54, beats: BEATS, root: 146.83, scale: MAJOR, parts, lines: [] };
}
