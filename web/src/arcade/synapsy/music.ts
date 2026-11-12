/**
 * "Połączenia" ("Connections"), Synapsy's song: light synth-pop at 112 bpm in D major, built on the kit's
 * sequencer (kit/song.ts).  Its own two verses — original words in four languages about sparks that wire
 * together, a bridge that grows, learning by day and sleep that sets it — around the series' shared refrain
 * "Weź moc, obudź się" (`seriesChorus`), twice: verse A, refrain, verse B, refrain (128 beats, ~69 s a loop).
 *
 * The layers: a pad, a bright pluck arpeggio and the refrain's pad always (layer 0); the bass and the sung
 * lead join first (layer 1, level 0.25), then the bells and the four-on-the-floor kick (layer 2), then the
 * snare and the off-beat hats (layer 3) — so a focused push block fills the song, and a rest block keeps it
 * gentle.  The inputs of the network fire on its beats (RULES.bpm).
 */
import type { Lang } from '../../i18n';
import { lang as pageLang } from '../../i18n';
import { CHORUS_BEATS, MAJOR, chords, melody, repeat, seriesChorus, steps, type Song, type SongLine, type SongNote, type SongPart } from '../kit/song';
import { verseLines } from './i18n';
import { RULES } from './rules';

/** D4: the lead sings from D4 to the D above. */
export const ROOT_HZ = 293.66;
export const VERSE_BEATS = 32;

/** Verse A: "Iskra tu i iskra tam…" — a skipping, bright tune; verse B answers it and leads into the refrain. */
const VERSE_A = [
  '4:0.5 4:0.5 5:1 4:0.5 2:0.5 4:1 7:2 -:2',
  '7:0.5 6:0.5 5:0.5 4:0.5 5:1 4:0.5 2:0.5 4:2 -:2',
  '4:0.5 5:0.5 7:1 7:0.5 8:0.5 7:1 9!:2 -:2',
  '8:0.5 7:0.5 5:1 4:0.5 5:0.5 2:1 0!:3 -:1',
].join(' ');
const VERSE_B = [
  '2:0.5 4:0.5 5:1 4:0.5 5:0.5 7:1 5:2 -:2',
  '4:0.5 5:0.5 7:0.5 5:0.5 4:1 2:0.5 4:0.5 5:2 -:2',
  '7:0.5 7:0.5 8:1 7:0.5 5:0.5 4:1 5:2 -:2',
  '4:0.5 2:0.5 4:1 5:0.5 4:0.5 2:1 1:2 -:2',
].join(' ');

/** I – V – vi – IV, a bar each, twice: the synth-pop wheel under both verses. */
const WHEEL = [0, 4, 5, 3, 0, 4, 5, 3];

/** The pluck's arpeggio over a chord (root, third, fifth, octave, fifth, third…), in eighths. */
function arpeggio(roots: readonly number[], start: number): SongNote[] {
  const shape = [0, 2, 4, 7, 4, 2, 4, 2];
  return roots.flatMap((d, bar) => shape.map((k, i) => ({ at: start + bar * 4 + i * 0.5, len: 0.45, deg: d + k, vel: i === 0 ? 0.9 : 0.6 })));
}

/** The bass: a pushing synth-pop line on the chord's root (with a lift to the fifth). */
function bassLine(roots: readonly number[], start: number): SongNote[] {
  return roots.flatMap((d, bar) => [
    { at: start + bar * 4, len: 0.75, deg: d, oct: -2 },
    { at: start + bar * 4 + 1, len: 0.45, deg: d, oct: -2 },
    { at: start + bar * 4 + 1.5, len: 0.45, deg: d + 4, oct: -2 },
    { at: start + bar * 4 + 2, len: 0.75, deg: d, oct: -2 },
    { at: start + bar * 4 + 3, len: 0.45, deg: d, oct: -2 },
    { at: start + bar * 4 + 3.5, len: 0.45, deg: d + 2, oct: -2 },
  ]);
}

/** One verse's parts from `start`. */
function verseParts(tune: string, start: number): SongPart[] {
  const lead = melody(tune, start);
  return [
    { voice: 'pad', layer: 0, gain: 0.7, notes: chords(WHEEL, 4, start, -1) },
    { voice: 'pluck', layer: 0, gain: 0.55, notes: arpeggio(WHEEL, start) },
    { voice: 'bass', layer: 1, notes: bassLine(WHEEL, start) },
    { voice: 'lead', layer: 1, notes: lead },
    { voice: 'bell', layer: 2, gain: 0.45, notes: lead.filter(n => n.len >= 1).map(n => ({ ...n, oct: (n.oct ?? 0) + 1 })) },
    { voice: 'kick', layer: 2, notes: repeat(steps('x.x.x.x.', 0.5, start), 8, 4) },
    { voice: 'snare', layer: 3, notes: repeat(steps('..x...x.', 0.5, start), 8, 4) },
    { voice: 'hat', layer: 3, notes: repeat(steps('.x.x.x.x', 0.5, start), 8, 4) },
  ];
}

/** The whole song in a language: verse A, the refrain, verse B, the refrain. */
export function buildSong(l: Lang = pageLang): Song {
  const words = verseLines(l);
  const c1 = seriesChorus(VERSE_BEATS, l);
  const bStart = VERSE_BEATS + CHORUS_BEATS;
  const c2 = seriesChorus(bStart + VERSE_BEATS, l);
  const lines: SongLine[] = [
    ...words.slice(0, 4).map((text, i) => ({ at: i * 8, text })),
    ...c1.lines,
    ...words.slice(4, 8).map((text, i) => ({ at: bStart + i * 8, text })),
    ...c2.lines,
  ];
  return {
    bpm: RULES.bpm,
    beats: 2 * (VERSE_BEATS + CHORUS_BEATS),
    root: ROOT_HZ,
    scale: MAJOR,
    parts: [...verseParts(VERSE_A, 0), ...c1.parts, ...verseParts(VERSE_B, bStart), ...c2.parts],
    lines,
  };
}
