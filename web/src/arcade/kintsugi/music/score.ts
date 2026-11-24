/**
 * The score of Złote serce's heart music (pure: no audio here, ambient.ts plays it).  E-flat major — warm, low, the
 * key of the heart in this meditation — in slow chords voiced for close, singing voice leading (added ninths and major
 * sevenths as colours), a soft root under them, and a sparse melody on the major pentatonic for a harp or a celesta.
 *
 * Each stage of the meditation has its own progression and character:
 *
 *   arrive    the dark: vi9 – IVmaj7 – I(add9) – V7sus, 14–16 s a chord, low, the filter closed, a note now and then
 *   gather    warm and moving: I – vi – IV – V7sus – I/3 – IV – ii9 – V7sus, 10–12 s, a harp walking gently
 *   gold      brighter: IV – I/3 – ii9 – V – vi – IV – Imaj7 – V7sus, a celesta, a high shimmer over the pads
 *   beat      the heart: a pedal on E-flat (I – IV/I – I – V7sus/I), 60 to the minute, the harp sparse
 *   radiance  the fullest: the canon's walk I – V – vi – iii – IV – I/3 – ii9 – V7sus, 8–10 s, shimmer and glints
 *   close     a long resolution: IV – iv (the minor plagal, A-flat minor six) – I, then I held to the end
 *
 * Pitches are MIDI numbers (60 = middle C); E-flat 4 = 63.
 */
import type { MusicStage } from './types';

export const midiHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);
/** The key's tonic as a pitch class (E-flat). */
export const TONIC = 3;
/** E-flat major, as pitch classes. */
export const KEY_PCS: readonly number[] = [3, 5, 7, 8, 10, 0, 2];
/** E-flat major pentatonic (E♭ F G B♭ C), as pitch classes: the melody's notes. */
export const PENTA_PCS: readonly number[] = [3, 5, 7, 10, 0];

export const pc = (m: number): number => ((m % 12) + 12) % 12;

export type ChordName = 'I' | 'Imaj7' | 'I/3' | 'vi' | 'iii' | 'IV' | 'ii7' | 'V' | 'V7sus' | 'iv' | 'IV/I' | 'V7sus/I';

export interface Chord { bass: number; pad: readonly number[] }

/** The voicings (bass under four pad voices), chosen so that one chord flows into the next by small steps. */
export const CHORDS: Readonly<Record<ChordName, Chord>> = {
  'I': { bass: 39, pad: [55, 58, 63, 65] },        // E♭ add9: G3 B♭3 E♭4 F4 over E♭2
  'Imaj7': { bass: 39, pad: [55, 58, 62, 67] },    // E♭maj7: G3 B♭3 D4 G4
  'I/3': { bass: 43, pad: [58, 63, 65, 70] },      // E♭ add9 over G2
  'vi': { bass: 36, pad: [51, 58, 62, 67] },       // Cm9: E♭3 B♭3 D4 G4 over C2
  'iii': { bass: 43, pad: [53, 58, 62, 65] },      // Gm7: F3 B♭3 D4 F4 over G2
  'IV': { bass: 44, pad: [55, 60, 63, 68] },       // A♭maj7: G3 C4 E♭4 A♭4 over A♭2
  'ii7': { bass: 41, pad: [56, 60, 63, 67] },      // Fm9: A♭3 C4 E♭4 G4 over F2
  'V': { bass: 46, pad: [53, 58, 62, 65] },        // B♭: F3 B♭3 D4 F4 over B♭2
  'V7sus': { bass: 46, pad: [53, 56, 63, 70] },    // B♭7sus4: F3 A♭3 E♭4 B♭4
  'iv': { bass: 44, pad: [53, 59, 63, 68] },       // A♭m6: F3 C♭4 E♭4 A♭4 — the one borrowed chord (the close)
  'IV/I': { bass: 39, pad: [56, 60, 63, 68] },     // A♭ over E♭ (the heartbeat's pedal)
  'V7sus/I': { bass: 39, pad: [53, 56, 63, 70] },  // B♭7sus over E♭
};

export const PROGRESSIONS: Readonly<Record<MusicStage, readonly ChordName[]>> = {
  arrive: ['vi', 'IV', 'I', 'V7sus'],
  gather: ['I', 'vi', 'IV', 'V7sus', 'I/3', 'IV', 'ii7', 'V7sus'],
  gold: ['IV', 'I/3', 'ii7', 'V', 'vi', 'IV', 'Imaj7', 'V7sus'],
  beat: ['I', 'IV/I', 'I', 'V7sus/I'],
  radiance: ['I', 'V', 'vi', 'iii', 'IV', 'I/3', 'ii7', 'V7sus'],
  close: ['IV', 'iv', 'I'],
};

/** The close does not loop: its last chord holds to the end. */
export const LOOPS: Readonly<Record<MusicStage, boolean>> = { arrive: true, gather: true, gold: true, beat: true, radiance: true, close: false };

export interface MoodSpec {
  /** how long a chord lasts (s), drawn between the two */
  chord: readonly [number, number];
  /** the pads' low-pass cutoff (Hz) at the light the meditation shows (opened a little more by it) */
  cutoff: number;
  /** the music's loudness against the others (0..1) */
  level: number;
  /** the soft root's loudness */
  bass: number;
  /** how often a melody phrase comes when its turn is due (0..1), and how many notes it has */
  phrase: number;
  notes: readonly [number, number];
  /** the melody's beat (s) and the rest after a phrase (in beats) */
  beat: number;
  gap: readonly [number, number];
  /** the melody's range (MIDI) */
  range: readonly [number, number];
  /** the plucked voice: a harp (warm, low partials) or a celesta (a bell-like shine) */
  voice: 'harp' | 'celesta';
  /** the high shimmer over the pads (0..1) and how often a tiny glint sounds above it (per beat) */
  shimmer: number;
  glint: number;
  /** a phrase walks down rather than up (the close) */
  fall: boolean;
}

export const MOODS: Readonly<Record<MusicStage, MoodSpec>> = {
  arrive: { chord: [14, 16], cutoff: 420, level: 0.62, bass: 0.85, phrase: 0.35, notes: [2, 3], beat: 1.15, gap: [5, 9], range: [58, 75], voice: 'harp', shimmer: 0, glint: 0, fall: false },
  gather: { chord: [10, 12], cutoff: 1100, level: 0.8, bass: 0.8, phrase: 0.65, notes: [3, 5], beat: 0.9, gap: [3, 6], range: [63, 79], voice: 'harp', shimmer: 0, glint: 0, fall: false },
  gold: { chord: [9, 11], cutoff: 1700, level: 0.85, bass: 0.75, phrase: 0.7, notes: [3, 5], beat: 0.82, gap: [3, 6], range: [67, 84], voice: 'celesta', shimmer: 0.6, glint: 0.05, fall: false },
  beat: { chord: [12, 14], cutoff: 1200, level: 0.75, bass: 0.6, phrase: 0.45, notes: [2, 4], beat: 1, gap: [4, 8], range: [63, 79], voice: 'harp', shimmer: 0.3, glint: 0, fall: false },
  radiance: { chord: [8, 10], cutoff: 2600, level: 0.95, bass: 0.8, phrase: 0.85, notes: [4, 6], beat: 0.76, gap: [2, 5], range: [67, 87], voice: 'celesta', shimmer: 1, glint: 0.1, fall: false },
  close: { chord: [14, 18], cutoff: 900, level: 0.72, bass: 0.85, phrase: 0.3, notes: [2, 3], beat: 1.25, gap: [6, 10], range: [58, 75], voice: 'harp', shimmer: 0.2, glint: 0, fall: true },
};

/** The chord after `i` in a stage's progression (the close holds its last). */
export function nextIndex(stage: MusicStage, i: number): number {
  const n = PROGRESSIONS[stage].length;
  return LOOPS[stage] ? (i + 1) % n : Math.min(n - 1, i + 1);
}

/** A chord's pitch classes (the root and the pad). */
export const chordPcs = (c: Chord): Set<number> => new Set([pc(c.bass), ...c.pad.map(pc)]);

/**
 * The melody's notes over a chord, within [lo, hi]: the pentatonic, without a passing note a semitone above a chord
 * tone (a minor ninth's rub) or a semitone below the root.
 */
export function melodyPool(c: Chord, lo: number, hi: number): number[] {
  const tones = chordPcs(c);
  const root = pc(c.bass);
  const out: number[] = [];
  for (let m = Math.ceil(lo); m <= hi; m++) {
    const p = pc(m);
    if (!PENTA_PCS.includes(p)) continue;
    if (!tones.has(p) && [...tones].some(t => pc(p - t) === 1)) continue;
    if (pc(root - p) === 1) continue;
    out.push(m);
  }
  return out;
}

/**
 * The next melody note: a gentle random walk — steps more likely than leaps, a repeated note rare, a chord tone
 * preferred, a phrase's last note a chord tone; the close leans downward.
 */
export function nextNote(prev: number | null, pool: readonly number[], c: Chord, rng: () => number, opts: { last?: boolean; fall?: boolean } = {}): number {
  if (!pool.length) return prev ?? 63;
  const tones = chordPcs(c);
  const from = prev ?? pool[Math.floor(pool.length / 2)];
  const w = pool.map(m => {
    const d = Math.abs(m - from);
    let x = d === 0 ? 0.25 : d <= 2 ? 3 : d <= 4 ? 2.2 : d <= 7 ? 0.8 : 0.15;
    if (tones.has(pc(m))) x *= opts.last ? 4 : 1.6;
    else if (opts.last) x *= 0.2;
    if (opts.fall && m < from) x *= 1.9;
    return x;
  });
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

export interface PhraseNote { at: number; len: number; vel: number }
export interface Phrase { notes: PhraseNote[]; /** seconds from the phrase's start to the next one */ next: number }

/**
 * A phrase's rhythm (seconds from its start): a few notes on the beat, mostly one beat, sometimes one and a half or
 * two, the last held; then a rest.  In a rest block, or when the turn is skipped, fewer notes or none.
 */
export function phrase(spec: MoodSpec, rng: () => number, rest: boolean): Phrase {
  const b = spec.beat;
  const gap = (spec.gap[0] + rng() * (spec.gap[1] - spec.gap[0])) * (rest ? 1.6 : 1) * b;
  if (rng() > spec.phrase * (rest ? 0.5 : 1)) return { notes: [], next: gap + 2 * b };
  let n = spec.notes[0] + Math.floor(rng() * (spec.notes[1] - spec.notes[0] + 1));
  if (rest) n = Math.max(1, n - 1);
  const notes: PhraseNote[] = [];
  let at = 0;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const len = (last ? 2 + rng() : [1, 1, 1, 1.5, 2][Math.floor(rng() * 5)]) * b;
    notes.push({ at, len, vel: (i === 0 ? 0.95 : 0.7 + rng() * 0.25) * (last ? 0.85 : 1) });
    at += len;
  }
  return { notes, next: at + gap };
}

/** A chord's length in this mood (s). */
export const chordLen = (spec: MoodSpec, rng: () => number): number => spec.chord[0] + rng() * (spec.chord[1] - spec.chord[0]);

/** The chord tones of `c` within [lo, hi], low to high (the cues' bells and the bloom's arpeggio). */
export function chordTonesIn(c: Chord, lo: number, hi: number): number[] {
  const tones = chordPcs(c);
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (tones.has(pc(m))) out.push(m);
  return out;
}
