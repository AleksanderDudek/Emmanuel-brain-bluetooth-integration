/**
 * Chant generator: pure TypeScript (no Web Audio), seeded, unit-tested.
 *
 * Phrases follow the Gregorian psalm tones (Liber Usualis, "The Tones of the Psalms"). A verse
 * has two halves, each sung to a formula:
 *
 *   intonation (initium: 2–3 notes rising to the tenor) → recitation on the tenor (the reciting
 *   tone) → mediant cadence (mediatio) ‖ breath at the asterisk ‖ recitation on the tenor →
 *   termination (terminatio) descending to the final of the mode.
 *
 * The melody moves on the white-note scale, mostly by step, with the occasional third and,
 * rarely, a fourth or fifth (an intonation leaping up from the final). B may be flattened in
 * modes 1, 2, 5 and 6 — the "b molle" of chant, which softens the tritone against F. Cadence
 * notes are lengthened, short melismas decorate the cadences, and ornate (Byzantine) singing
 * adds turns and grace notes to the recitation.
 */
import type { ChantMode, MusicMood } from '../types';
import type { Rng } from './rng';

export type Vowel = 'a' | 'e' | 'i' | 'o' | 'u';
export type Realm = MusicMood['realm'];

/** One sung note; times are seconds from the start of the phrase. */
export interface ChantEvent {
  midi: number;
  start: number;
  dur: number;
  vowel: Vowel;
  /** index of the syllable in the phrase; the notes of a melisma share it */
  syllable: number;
  /** one of several notes sung on a single syllable */
  melisma?: boolean;
}

export interface Phrase {
  events: ChantEvent[];
  /** end of the last note, s */
  length: number;
  final: number;
  tenor: number;
  /** Heaven at high intensity: a second part may double the melody an octave higher. */
  octaveDouble: boolean;
}

export interface PhraseOptions extends Pick<MusicMood, 'mode' | 'intensity' | 'realm'> {
  /** 0 = plain psalmody … 1 = richly ornamented, Byzantine style */
  ornate?: number;
  /** a broader, slower delivery (the invocation hymn) */
  solemn?: boolean;
  /** vowels to sing, one per syllable (default: the Latin doxology, closing on its "EUOUAE") */
  vowels?: string;
}

const STEP_SEMITONES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const VOWELS: readonly Vowel[] = ['a', 'e', 'i', 'o', 'u'];

/** Each mode's final (as a scale step, C = 0) and its reciting tone (steps above the final). */
export const MODES: Readonly<Record<ChantMode, { final: number; tenor: number }>> = {
  1: { final: 1, tenor: 4 }, // Dorian:         final D, tenor A
  2: { final: 1, tenor: 2 }, // Hypodorian:     D, F
  3: { final: 2, tenor: 5 }, // Phrygian:       E, C
  4: { final: 2, tenor: 3 }, // Hypophrygian:   E, A
  5: { final: 3, tenor: 4 }, // Lydian:         F, C
  6: { final: 3, tenor: 2 }, // Hypolydian:     F, A
  7: { final: 4, tenor: 4 }, // Mixolydian:     G, D
  8: { final: 4, tenor: 3 }, // Hypomixolydian: G, C
};

/** Modes whose chants admit B♭. */
export const B_FLAT_MODES: ReadonlySet<ChantMode> = new Set<ChantMode>([1, 2, 5, 6]);
/** Modes that may close on the final from the whole tone below (D from C, G from F). */
const SUBTONAL: ReadonlySet<ChantMode> = new Set<ChantMode>([1, 2, 7, 8]);

/** Sung range per realm (MIDI): a men's schola from C3 to E4; Hell an octave lower. */
export const RANGE: Readonly<Record<Realm, readonly [number, number]>> = {
  heaven: [48, 64],
  earth: [48, 64],
  hell: [36, 52],
};

/** "Gloria Patri … saeculorum. Amen": one vowel per syllable. */
const DOXOLOGY = 'oiaaieiioeiiuiaoiueaiiiioeueeeeieuaeuouae';
/** "saeculorum. Amen": the vowels chant books print under every psalm-tone ending. */
const EUOUAE = DOXOLOGY.slice(-6);

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Diatonic degree (seven per octave, 0 = C0) → MIDI note. */
export function midiOfDegree(degree: number): number {
  const octave = Math.floor(degree / 7);
  return 12 * (octave + 1) + STEP_SEMITONES[degree - 7 * octave];
}

/** Degree of the mode's final: D3–G3, the floor of a men's range; Hell an octave lower. */
export function finalDegree(mode: ChantMode, realm: Realm): number {
  return (realm === 'hell' ? 14 : 21) + MODES[mode].final;
}

/** White notes belong to every mode; B♭ only to those that admit it. */
export function isInMode(midi: number, mode: ChantMode): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return STEP_SEMITONES.includes(pc) || (pc === 10 && B_FLAT_MODES.has(mode));
}

/** One syllable's notes as [degree, duration factor]; more than one note makes a melisma. */
type Neume = [degree: number, stretch: number][];

const one = (degree: number, stretch = 1): Neume => [[degree, stretch]];

/** One verse of a psalm tone in the given mood. */
export function generatePhrase(rng: Rng, o: PhraseOptions): Phrase {
  const f = finalDegree(o.mode, o.realm);
  const t = f + MODES[o.mode].tenor;
  const ornate = o.ornate ?? 0;
  const halves = [
    [...intonation(rng, f, t), ...recitation(rng, t, ornate), ...cadence(rng, mediant(rng, t), t, ornate)],
    [...recitation(rng, t, ornate), ...cadence(rng, termination(rng, o.mode, f, t), t, ornate)],
  ];
  const flatB = B_FLAT_MODES.has(o.mode) && rng.chance(0.5);
  const pitch = (degree: number): number => {
    const m = midiOfDegree(degree);
    return flatB && m % 12 === 11 ? m - 1 : m;
  };
  const intensity = clamp(o.intensity, 0, 1);
  const pace = o.solemn ? 1.3 : 1;
  const beat = (0.55 - 0.15 * intensity) * pace; // s per syllable at the tenor: calm is slower
  const vowels = vowelsFor(rng, halves[0].length + halves[1].length, o.vowels);
  const events: ChantEvent[] = [];
  let time = 0;
  let syllable = 0;
  halves.forEach((half, h) => {
    if (h === 1) time += (0.9 - 0.4 * intensity) * pace; // breath at the half-verse
    for (const neume of half) {
      for (const [degree, stretch] of neume) {
        const dur = beat * stretch * rng.range(0.94, 1.06);
        const event: ChantEvent = { midi: pitch(degree), start: time, dur, vowel: vowels[syllable], syllable };
        if (neume.length > 1) event.melisma = true;
        events.push(event);
        time += dur;
      }
      syllable++;
    }
  });
  return { events, length: time, final: pitch(f), tenor: pitch(t), octaveDouble: o.realm === 'heaven' && intensity >= 0.6 };
}

/**
 * Parallel organum (Musica enchiriadis, 9th century): a second voice a perfect fourth below the
 * chant, or a fifth below where the fourth would leave the mode (F♯ under B♮).
 */
export function organum(events: readonly ChantEvent[], mode: ChantMode): ChantEvent[] {
  return events.map(e => ({ ...e, midi: isInMode(e.midi - 5, mode) ? e.midi - 5 : e.midi - 7 }));
}

/** Initium: two or three notes climbing to the tenor (tone 1: F G|A, tone 8: G A|C); now and then a leap up from the final. */
function intonation(rng: Rng, f: number, t: number): Neume[] {
  if (t - f <= 4 && rng.chance(0.12)) return [one(f)];
  return rng.pick([[t - 2, t - 1], [t - 3, t - 2], [t - 3, t - 2, t - 1]]).map(d => one(d));
}

/** Recitation: 4–10 syllables on the tenor; ornate singing decorates some with turns and grace notes. */
function recitation(rng: Rng, t: number, ornate: number): Neume[] {
  return Array.from({ length: rng.int(4, 10) }, (_, i): Neume => {
    if (i === 0 || !rng.chance(0.35 * ornate)) return one(t);
    return rng.pick<Neume>([
      [[t, 0.5], [t + 1, 0.4], [t, 0.6]], // upper turn
      [[t + 1, 0.3], [t, 0.9]], // grace note from above
      [[t, 0.5], [t - 1, 0.4], [t, 0.6]], // lower neighbour
    ]);
  });
}

/** Mediatio: a two- or three-note cadence about the tenor, closing the first half-verse. */
function mediant(rng: Rng, t: number): number[] {
  return rng.pick([[t + 1, t], [t + 1, t, t - 1], [t - 1, t], [t, t + 1, t]]);
}

/**
 * Terminatio: down by step from the tenor (at most one third skipped), the final reached from
 * above — or, in modes 1, 2, 7 and 8, from the whole tone below.
 */
function termination(rng: Rng, mode: ChantMode, f: number, t: number): number[] {
  const path = rng.chance(0.35) ? [t + 1] : [];
  let skipped = false;
  for (let d = t - 1; d > f; d--) {
    if (!skipped && d < t - 1 && d - 1 > f && rng.chance(0.2)) skipped = true;
    else path.push(d);
  }
  if (SUBTONAL.has(mode) && rng.chance(0.3)) path.push(f - 1);
  path.push(f);
  return path;
}

/**
 * Cadence notes are lengthened (the last by 1.6–2.2×); the penultimate syllable may carry a short
 * melisma, more often (and as a turn) in ornate singing.
 */
function cadence(rng: Rng, degrees: number[], t: number, ornate: number): Neume[] {
  const neumes = degrees.map(d => one(d));
  const last = degrees.length - 1;
  neumes[last] = one(degrees[last], rng.range(1.6, 2.2));
  const penult = degrees[last - 1];
  if (last >= 2 && rng.chance(0.3 + 0.4 * ornate)) {
    neumes.splice(last - 2, 2, [[degrees[last - 2], 0.7], [penult, 1]]); // two syllables become one two-note neume
  } else if (ornate > 0 && rng.chance(0.6 * ornate)) {
    const turn = penult + 1 <= t + 1 ? penult + 1 : penult - 1;
    neumes[last - 1] = [[penult, 0.5], [turn, 0.4], [penult, 0.8]];
  } else {
    neumes[last - 1] = one(penult, 1.25);
  }
  return neumes;
}

/** One vowel per syllable: the given text, or the doxology from a random syllable, closing on "EUOUAE". */
function vowelsFor(rng: Rng, count: number, text?: string): Vowel[] {
  const start = rng.int(0, DOXOLOGY.length - 1);
  return Array.from({ length: count }, (_, i) => {
    const fromEnd = count - i;
    const char = text
      ? text[i % text.length]
      : fromEnd <= EUOUAE.length
        ? EUOUAE[EUOUAE.length - fromEnd]
        : DOXOLOGY[(start + i) % DOXOLOGY.length];
    return VOWELS.find(v => v === char) ?? 'a';
  });
}
