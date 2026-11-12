/**
 * Światło ciała's song (kit/song.ts): a lullaby at 66 beats a minute in C major — two verses of its own
 * about the light going through the body (original melody and words, four languages: i18n.ts `song.*`)
 * around the series' shared refrain ("Weź moc, obudź się", kit/song.ts `seriesChorus`), arranged softly:
 * a pad that always plays, then the voice and the bass, then a bell and a heartbeat (lub-dub on the
 * kick), then a harp of plucked arpeggios as the focus rises.  The refrain keeps its melody, chords, bass,
 * bell and kick; its snare and hat stay out of a lullaby.
 *
 *   A  (beats 0–31)    verse one        I – vi – IV – V
 *   R  (32–63)         the refrain
 *   B  (64–95)         verse two        IV – I – vi – V
 *   R  (96–127)        the refrain again
 */
import { CHORUS_BEATS, MAJOR, chords, melody, repeat, seriesChorus, steps, type Song, type SongLine, type SongNote, type SongPart } from '../kit/song';
import { t } from './i18n';

const VERSE_A = [
  '2:1 3:1 4:2 4:1 3:1 2:2',         // Światło idzie przeze mnie cicho,
  '1:1 2:1 3:1 2:1 1:2 -:2',         // od korony aż do stóp;
  '2:1 3:1 4:1 5:1 6:2 5:1 4:1',     // każdy narząd zna swą miarę,
  '3:1 2:1 1:1 1:1 0:3 -:1',         // ciało wraca w równy krok.
].join(' ');

const VERSE_B = [
  '4:1 4:1 5:1 4:1 3:2 2:2',         // Serce zwalnia, oddech długi,
  '1:1 2:1 3:2 2:2 -:2',             // płuca, nerki, krew i kość;
  '2:1 3:1 4:2 5:1 6:1 7:2',         // wszystko w swoim cichym rytmie —
  '5:1 4:1 3:1 2:1 1:2 0:2',         // dobrze jest i światła dość.
].join(' ');

const BEATS = 32;

/** A verse's parts at `start`: its melody, chords and bass, a bell an octave up, a lub-dub heartbeat, a harp. */
function verse(tune: string, roots: readonly number[], start: number): SongPart[] {
  const lead = melody(tune, start);
  const bass: SongNote[] = roots.flatMap((d, i) => [0, 2, 4, 6].map(k => ({ at: start + i * 8 + k, len: 1.8, deg: d, oct: -2, vel: k === 0 ? 0.9 : 0.6 })));
  const harp: SongNote[] = roots.flatMap((d, i) => [0, 2, 4, 7, 4, 2, 4, 7, 9, 7, 4, 2, 0, 2, 4, 2].map((k, j) => ({ at: start + i * 8 + j * 0.5, len: 0.5, deg: d + k, oct: -1, vel: j % 4 === 0 ? 0.8 : 0.55 })));
  return [
    { voice: 'pad', layer: 0, gain: 0.9, notes: chords(roots, 8, start, -1) },
    { voice: 'lead', layer: 1, gain: 0.9, notes: lead },
    { voice: 'bass', layer: 1, gain: 0.8, notes: bass },
    { voice: 'bell', layer: 2, gain: 0.45, notes: lead.filter(n => n.len >= 2).map(n => ({ ...n, oct: (n.oct ?? 0) + 1 })) },
    // lub-dub, twice a bar: the heart under the song
    { voice: 'kick', layer: 2, gain: 0.55, notes: repeat(steps('Xx......xx......', 0.25, start), BEATS / 4, 4) },
    { voice: 'pluck', layer: 3, gain: 0.5, notes: harp },
  ];
}

const lines = (keys: readonly string[], start: number): SongLine[] => keys.map((k, i) => ({ at: start + i * 8, text: t(k as 'song.a.1') }));

/** The whole song (128 beats ≈ 1 min 56 s at 66 bpm), the lines in the page's language. */
export function buildSong(): Song {
  // A at 0, the refrain at 32, B at 64, the refrain again at 96
  const r1 = seriesChorus(BEATS), r2 = seriesChorus(BEATS * 2 + BEATS);
  const soft = (p: SongPart) => p.voice !== 'snare' && p.voice !== 'hat';
  const parts: SongPart[] = [
    ...verse(VERSE_A, [0, 5, 3, 4], 0),
    ...r1.parts.filter(soft),
    ...verse(VERSE_B, [3, 0, 5, 4], BEATS * 2),
    ...r2.parts.filter(soft),
  ];
  return {
    bpm: 66, beats: BEATS * 2 + CHORUS_BEATS * 2, root: 261.63, scale: MAJOR, parts,
    lines: [
      ...lines(['song.a.1', 'song.a.2', 'song.a.3', 'song.a.4'], 0),
      ...r1.lines,
      ...lines(['song.b.1', 'song.b.2', 'song.b.3', 'song.b.4'], BEATS * 2),
      ...r2.lines,
    ],
  };
}
