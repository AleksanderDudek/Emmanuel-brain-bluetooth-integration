/**
 * Odnowa's song (DESIGN §13.12): warm and steady, 92 beats a minute in G major — two verses of its own about
 * the cell's renewal day by day (original words in four languages, i18n `song.a.*`, `song.b.*`; an original
 * melody) around the series' shared refrain "Weź moc, obudź się" (kit/song.ts `seriesChorus`).  Never the
 * viral song's words or melody.
 *
 * The layers mirror the machine: eight plucked notes a bar (eight protons turn the ring once), three bells
 * a bar (three ATP a turn), the bass and the melody first, the drums last — they join as the level rises
 * (SongPlayer.level), so in a sighted push the song fills with the player's focus.
 */
import { MAJOR, chords, melody, repeat, seriesChorus, steps, type Song, type SongLine, type SongNote, type SongPart } from '../kit/song';
import { t } from './i18n';

/** The verse's tune: four phrases of eight beats (one line each). */
const VERSE_A = [
  '2:1 2:1 3:1 4:1 4:1 3:1 2:2',              // Kręci się turbina w nas,
  '4:1 5:1 4:1 3:1 2:1 1:1 0:2',              // złote iskry raz po raz;
  '1:1 2:1 3:1 4:1 5:1 4:1 3:2',              // enzym łata każdy ślad —
  '4:1 4:0.5 3:0.5 2:1 1:1 2:1 1:1 0:2',      // dzień po dniu odnawia świat.
].join(' ');
const VERSE_B = [
  '2:1 2:1 3:1 4:1 4:1 3:1 2:2',              // Co zużyte, wraca w krąg,
  '4:1 5:1 4:1 3:1 2:1 1:1 0:2',              // lizosom ma pełno rąk;
  '1:1 2:1 3:1 4:1 5:1 6:1 7!:2',             // jedna dzieli się na dwie —
  '5:1 4:1 3:1 2:1 1:1 1:1 0!:2',             // dzień po dniu odnawiam się.
].join(' ');

/** The verse's chords, one a bar: I – V – vi – IV | I – IV – V – I. */
const ROOTS = [0, 4, 5, 3, 0, 3, 4, 0];

function verse(tune: string, start: number): SongPart[] {
  const lead = melody(tune, start);
  const pad = chords(ROOTS, 4, start, -1);
  const bass: SongNote[] = ROOTS.flatMap((d, i) => [
    { at: start + i * 4, len: 1.6, deg: d, oct: -2 },
    { at: start + i * 4 + 2, len: 1.4, deg: d + 4, oct: -2 },
  ]);
  // the c-ring: eight plucks a bar, up and down the bar's chord
  const pluck: SongNote[] = ROOTS.flatMap((d, i) => [0, 2, 4, 7, 4, 2, 4, 2].map((k, j) => ({ at: start + i * 4 + j * 0.5, len: 0.45, deg: d + k, vel: j === 0 ? 0.8 : 0.5 })));
  // three ATP a turn: three bells a bar
  const bell: SongNote[] = ROOTS.flatMap((d, i) => [0, 4 / 3, 8 / 3].map((o, j) => ({ at: start + i * 4 + o, len: 1, deg: d + [4, 2, 0][j], oct: 1, vel: 0.6 })));
  return [
    { voice: 'pad', layer: 0, gain: 0.85, notes: pad },
    { voice: 'bass', layer: 1, notes: bass },
    { voice: 'lead', layer: 1, notes: lead },
    { voice: 'pluck', layer: 2, gain: 0.55, notes: pluck },
    { voice: 'bell', layer: 2, gain: 0.45, notes: bell },
    { voice: 'kick', layer: 2, notes: repeat(steps('x...x...', 0.5, start), 8, 4) },
    { voice: 'hat', layer: 3, gain: 0.8, notes: repeat(steps('.x.x.x.x', 0.5, start), 8, 4) },
    { voice: 'snare', layer: 3, gain: 0.7, notes: repeat(steps('..x...x.', 0.5, start), 8, 4) },
  ];
}

function verseLines(key: 'a' | 'b', start: number): SongLine[] {
  return [1, 2, 3, 4].map((n, i) => ({ at: start + i * 8, text: t(`song.${key}.${n}` as 'song.a.1') }));
}

/** The whole loop: verse A, the refrain, verse B, the refrain (128 beats, about 83 s). */
export function buildSong(): Song {
  const c1 = seriesChorus(32);
  const c2 = seriesChorus(96);
  const parts: SongPart[] = [...verse(VERSE_A, 0), ...c1.parts, ...verse(VERSE_B, 64), ...c2.parts];
  const lines: SongLine[] = [...verseLines('a', 0), ...c1.lines, ...verseLines('b', 64), ...c2.lines];
  return { bpm: 92, beats: 64 + c1.beats + c2.beats, root: 196, scale: MAJOR, parts, lines };
}

/** For the tests: the verse tunes' lengths in beats (each must be 32). */
export const verseBeats = (): number[] => [VERSE_A, VERSE_B].map(v => {
  const notes = melody(v, 0);
  const last = notes[notes.length - 1];
  return last.at + last.len;
});

