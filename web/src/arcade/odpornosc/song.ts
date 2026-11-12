/**
 * Odporność's song (DESIGN.md §13.9, kit/song.ts): two upbeat verses about the defenders — the white
 * patrol that squeezes through the vessel wall and follows the trail; the golden tags of the antibodies and
 * the calm that knits new skin — each followed by the series' shared refrain ("Weź moc, obudź się").  The
 * words and the melody are our own (never the viral song's), in the page's language; C major, 112 bpm,
 * a bright pluck under a bouncing lead.
 *
 * The layers follow the signal (the game passes the level): the pad and the pluck always play; the bass
 * and the lead join first, then the bell and the kick, then the snare and the hats.
 */
import { MAJOR, chords, melody, repeat, seriesChorus, shift, steps, type Song, type SongNote, type SongPart } from '../kit/song';
import { t, type Key } from './i18n';

/** the verse's tune: four lines of two bars each */
const VERSE = [
  '4:0.5 4:0.5 4:0.5 5:0.5 4:1 2:1', '3:0.5 3:0.5 2:0.5 1:0.5 0:2',          // Biały patrol, raźny krok,
  '2:0.5 2:0.5 4:0.5 4:0.5 5:1 5:1', '4:0.5 3:0.5 2:0.5 1:0.5 2:2',          // przez ścianę naczynia skok;
  '4:0.5 5:0.5 7!:1 7:0.5 6:0.5 5:1', '4:0.5 5:0.5 4:0.5 2:0.5 3:2',         // tropię ślad i mknę jak wiatr —
  '4!:1 2:0.5 2:0.5 3:1 1:1', '0:0.5 1:0.5 2:0.5 1:0.5 0:2',                // am! i czysty cały świat.
].join(' ');

/** the verse's chords, a bar each (I IV V I · vi IV V V into the refrain) */
const ROOTS = [0, 3, 4, 0, 5, 3, 4, 4];

/** The parts of one verse placed at `at` (32 beats). */
function verse(at: number, second: boolean): SongPart[] {
  const tune = melody(VERSE, at);
  // the second verse lifts its last line an octave for the run into the refrain
  if (second) for (const n of tune) if (n.at >= at + 28) n.oct = (n.oct ?? 0) + 1;
  const pluck: SongNote[] = ROOTS.flatMap((d, bar) => [0, 2, 4, 2, 0, 2, 4, 7].map((k, i) => ({ at: at + bar * 4 + i * 0.5, len: 0.5, deg: d + k, vel: i % 2 ? 0.55 : 0.75 })));
  const bass: SongNote[] = ROOTS.flatMap((d, bar) => [
    { at: at + bar * 4, len: 1.2, deg: d, oct: -2 },
    { at: at + bar * 4 + 2, len: 1.2, deg: d, oct: -2 },
    { at: at + bar * 4 + 3.5, len: 0.5, deg: d, oct: -1, vel: 0.6 },
  ]);
  const bell: SongNote[] = ROOTS.flatMap((d, bar) => [{ at: at + bar * 4 + 1, len: 1, deg: d + 4, oct: 1, vel: 0.6 }, { at: at + bar * 4 + 3, len: 1, deg: d + 2, oct: 1, vel: 0.5 }]);
  return [
    { voice: 'pad', layer: 0, gain: 0.7, notes: chords(ROOTS, 4, at, -1) },
    { voice: 'pluck', layer: 0, gain: 0.55, notes: pluck },
    { voice: 'bass', layer: 1, notes: bass },
    { voice: 'lead', layer: 1, notes: tune },
    { voice: 'bell', layer: 2, gain: 0.45, notes: bell },
    { voice: 'kick', layer: 2, notes: repeat(steps('x...x...', 0.5, at), 8, 4) },
    { voice: 'snare', layer: 3, notes: repeat(steps('..x...x.', 0.5, at), 8, 4) },
    { voice: 'hat', layer: 3, notes: repeat(steps('x.xxx.xx', 0.5, at), 8, 4) },
  ];
}

const words = (v: 1 | 2): string[] => [1, 2, 3, 4].map(i => t(`song.v${v}.${i}` as Key));

/** The whole song: verse 1, the refrain, verse 2, the refrain (128 beats, ~69 s), looping. */
export function buildSong(): Song {
  const c1 = seriesChorus(32), c2 = seriesChorus(96);
  const v1 = words(1), v2 = words(2);
  return {
    bpm: 112,
    beats: 128,
    root: 261.63,
    scale: MAJOR,
    parts: [...verse(0, false), ...c1.parts, ...verse(64, true), ...c2.parts],
    lines: [
      ...v1.map((text, i) => ({ at: i * 8, text })),
      ...c1.lines,
      ...v2.map((text, i) => ({ at: 64 + i * 8, text })),
      ...c2.lines,
    ],
  };
}

/** The refrain's place in the loop (beats): the view pulses brighter there. */
export const isChorus = (beat: number): boolean => {
  const b = ((beat % 128) + 128) % 128;
  return (b >= 32 && b < 64) || b >= 96;
};

/** shift is re-exported for the tests that place the song elsewhere */
export { shift };
