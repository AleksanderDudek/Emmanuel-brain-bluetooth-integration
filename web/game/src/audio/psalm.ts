/**
 * "Psalm 150", the game soundtrack: a piece per chapter for the instruments of the psalm — lyre,
 * frame drum, tambourine, finger cymbals, flute, shofar — over a drone, in the chapter's church
 * mode. Pure TypeScript (no Web Audio), seeded, unit-tested; arranger.ts plays it bar by bar.
 *
 * This file is the score: each track's preset (tempo, meter, groove, lead, colours), the mode's
 * scale, the motif a piece grows from, and the form it unfolds in — sections of 8–16 bars (intro,
 * A, B, bridge, breakdown, climax, interlude) in which the motif is transposed, inverted, shifted,
 * ornamented and passed between harp and flute, over harmony that leans to the mode's colour
 * chords and back. A form lasts well over four minutes; then a new round of the same piece begins
 * with a fresh arrangement of the same motif. A variation (the player's "next track") keeps the
 * tempo, meter and key but grows from another motif.
 */
import type { ChantMode, SoundscapeId } from '../types';
import { MODES, type Realm } from './chant';
import { Rng } from './rng';

// ─── Meters and grooves ─────────────────────────────────────────────

export type MeterId = '4/4' | '3/4' | '6/8' | '7/8' | '7/8b' | '5/4';

export interface Meter {
  /** grid steps (sixteenths) per bar */
  steps: number;
  /** the step where each beat begins; the first is the downbeat */
  beats: readonly number[];
  /** steps per tempo beat: 4 = the tempo counts quarters, 6 = dotted quarters */
  sub: number;
  label: string;
}

export const METERS: Readonly<Record<MeterId, Meter>> = {
  '4/4': { steps: 16, beats: [0, 4, 8, 12], sub: 4, label: '4/4' },
  '3/4': { steps: 12, beats: [0, 4, 8], sub: 4, label: '3/4' },
  '6/8': { steps: 12, beats: [0, 6], sub: 6, label: '6/8' },
  '7/8': { steps: 14, beats: [0, 4, 8], sub: 4, label: '7/8 (2+2+3)' },
  '7/8b': { steps: 14, beats: [0, 6, 10], sub: 4, label: '7/8 (3+2+2)' },
  '5/4': { steps: 20, beats: [0, 4, 8, 12, 16], sub: 4, label: '5/4 (3+2)' },
};

/**
 * Frame-drum patterns, one character per sixteenth: D doum (centre), d soft doum, T tek (rim),
 * t soft tek, k ka (the other hand), . rest. The 4/4 ones are the classic Middle-Eastern rhythms.
 */
export const GROOVES = {
  maqsum: 'D.Tk.kT.D.k.T.k.',
  baladi: 'D.D...T.D...T...',
  saidi: 'D.T...D.D...T...',
  malfuf: 'D..T..T.D..T..T.',
  wahda: 'D.....k.T...k...',
  heart: 'Dd......Dd......',
  heartFull: 'Dd..Dd..Dd..Dd..',
  waltz: 'D...T...T...',
  waltzKa: 'D.k.T.k.T.kk',
  slow3: 'D.......t...',
  six: 'D...T.D.T...',
  rock: 'D...k.T...k.',
  caravan: 'D.k.T.D.k.T.',
  ruchenitsa: 'D.k.T.k.D...T.',
  ruchenitsaAlt: 'D...T...D.T.T.',
  kalamatianos: 'D.k...T.k.T.k.',
  kalamatianosAlt: 'D....kT...T...',
  five: 'D...T...T...D...T...',
  fiveKa: 'D.k.T...T.k.D.k.T.k.',
} as const;

const GROOVES_BY_METER: Readonly<Record<MeterId, readonly (readonly [string, string])[]>> = {
  '4/4': [[GROOVES.maqsum, GROOVES.baladi], [GROOVES.saidi, GROOVES.malfuf], [GROOVES.baladi, GROOVES.wahda]],
  '3/4': [[GROOVES.waltz, GROOVES.waltzKa]],
  '6/8': [[GROOVES.six, GROOVES.caravan], [GROOVES.rock, GROOVES.six]],
  '7/8': [[GROOVES.ruchenitsa, GROOVES.ruchenitsaAlt]],
  '7/8b': [[GROOVES.kalamatianos, GROOVES.kalamatianosAlt]],
  '5/4': [[GROOVES.five, GROOVES.fiveKa]],
};

// ─── Presets: a piece per track ─────────────────────────────────────

export type Lead = 'flute' | 'harp';
/** The harp's accompaniment: rolling arpeggio, broken chords, a pulsing dyad (qanun-like), running sixteenths. */
export type HarpStyle = 'arp' | 'broken' | 'pulse' | 'run';

export interface Preset {
  id: string;
  /** Polish title, as the music controls show it */
  name: string;
  /** the key: the mode's final is the tonic, its scale the material */
  mode: ChantMode;
  realm: Realm;
  bpm: number;
  meter: MeterId;
  lead: Lead;
  /** the main groove and the contrasting one of the B sections */
  groove: string;
  alt: string;
  harp: HarpStyle;
  /** B♭, the "b molle", in a mode that admits it (1, 2, 5, 6) */
  bFlat: boolean;
  /** colours, 0–1: choir pad, tambourine, finger cymbals, shofar */
  pad: number;
  jingle: number;
  zil: number;
  shofar: number;
  /** delay of the off-beat sixteenths, in steps (0 = straight) */
  swing: number;
  /** Szeol: the frame drum beats like a heart */
  heartbeat?: boolean;
}

const preset = (id: string, name: string, p: Omit<Preset, 'id' | 'name'>): Preset => ({ id, name, ...p });

/** The curated soundtrack. Odd meters (Balkan, Byzantine) are kept for three pieces. */
export const PRESETS: Readonly<Record<string, Preset>> = {
  menu: preset('menu', 'Drzewo Życia', {
    mode: 8, realm: 'heaven', bpm: 76, meter: '3/4', lead: 'harp', groove: GROOVES.waltz, alt: GROOVES.slow3, harp: 'broken',
    bFlat: false, pad: 0.9, jingle: 0.2, zil: 0.6, shofar: 0, swing: 0,
  }),
  malkut: preset('malkut', 'Malkut — Kołyska', {
    mode: 1, realm: 'earth', bpm: 72, meter: '6/8', lead: 'flute', groove: GROOVES.rock, alt: GROOVES.six, harp: 'broken',
    bFlat: false, pad: 0.5, jingle: 0.4, zil: 0.3, shofar: 0.1, swing: 0.1,
  }),
  jesod: preset('jesod', 'Jesod — Dom', {
    mode: 2, realm: 'earth', bpm: 100, meter: '4/4', lead: 'harp', groove: GROOVES.maqsum, alt: GROOVES.baladi, harp: 'arp',
    bFlat: false, pad: 0.4, jingle: 0.5, zil: 0.3, shofar: 0.15, swing: 0.1,
  }),
  hod: preset('hod', 'Hod — Szkoła', {
    mode: 3, realm: 'earth', bpm: 116, meter: '4/4', lead: 'flute', groove: GROOVES.baladi, alt: GROOVES.malfuf, harp: 'run',
    bFlat: false, pad: 0.3, jingle: 0.6, zil: 0.3, shofar: 0.15, swing: 0,
  }),
  necach: preset('necach', 'Necach — Pierwsza miłość', {
    mode: 4, realm: 'earth', bpm: 120, meter: '7/8', lead: 'flute', groove: GROOVES.ruchenitsa, alt: GROOVES.ruchenitsaAlt, harp: 'pulse',
    bFlat: false, pad: 0.3, jingle: 0.7, zil: 0.5, shofar: 0.1, swing: 0,
  }),
  tiferet: preset('tiferet', 'Tiferet — Ambicja', {
    mode: 5, realm: 'earth', bpm: 126, meter: '4/4', lead: 'harp', groove: GROOVES.saidi, alt: GROOVES.maqsum, harp: 'arp',
    bFlat: false, pad: 0.3, jingle: 0.6, zil: 0.5, shofar: 0.4, swing: 0,
  }),
  gewura: preset('gewura', 'Gewura — Gniew', {
    mode: 6, realm: 'earth', bpm: 134, meter: '4/4', lead: 'flute', groove: GROOVES.malfuf, alt: GROOVES.saidi, harp: 'pulse',
    bFlat: false, pad: 0.2, jingle: 0.6, zil: 0.3, shofar: 0.7, swing: 0,
  }),
  chesed: preset('chesed', 'Chesed — Upadek', {
    mode: 7, realm: 'earth', bpm: 88, meter: '5/4', lead: 'flute', groove: GROOVES.five, alt: GROOVES.fiveKa, harp: 'broken',
    bFlat: false, pad: 0.4, jingle: 0.4, zil: 0.3, shofar: 0.15, swing: 0.1,
  }),
  bina: preset('bina', 'Bina — Ciemna noc', {
    mode: 2, realm: 'heaven', bpm: 68, meter: '3/4', lead: 'flute', groove: GROOVES.slow3, alt: GROOVES.waltzKa, harp: 'arp',
    bFlat: true, pad: 0.7, jingle: 0.1, zil: 0.3, shofar: 0.1, swing: 0,
  }),
  chochma: preset('chochma', 'Chochma — Pustynia', {
    mode: 8, realm: 'heaven', bpm: 84, meter: '6/8', lead: 'flute', groove: GROOVES.caravan, alt: GROOVES.six, harp: 'pulse',
    bFlat: false, pad: 0.5, jingle: 0.9, zil: 0.6, shofar: 0.2, swing: 0.15,
  }),
  keter: preset('keter', 'Keter — Dom Ojca', {
    mode: 8, realm: 'heaven', bpm: 80, meter: '4/4', lead: 'harp', groove: GROOVES.wahda, alt: GROOVES.maqsum, harp: 'arp',
    bFlat: false, pad: 0.9, jingle: 0.3, zil: 0.7, shofar: 0.6, swing: 0,
  }),
  rod: preset('rod', 'Ród — Drzewo rodu', {
    mode: 1, realm: 'earth', bpm: 110, meter: '7/8b', lead: 'harp', groove: GROOVES.kalamatianos, alt: GROOVES.kalamatianosAlt, harp: 'pulse',
    bFlat: true, pad: 0.4, jingle: 0.7, zil: 0.4, shofar: 0.3, swing: 0,
  }),
  szeol: preset('szeol', 'Szeol — Zstąpienie', {
    mode: 4, realm: 'hell', bpm: 70, meter: '4/4', lead: 'flute', groove: GROOVES.heart, alt: GROOVES.heartFull, harp: 'broken',
    bFlat: false, pad: 0.6, jingle: 0.1, zil: 0.1, shofar: 0.3, swing: 0, heartbeat: true,
  }),
};

/** FNV-1a: a stable seed from a track id. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const METER_IDS: readonly MeterId[] = ['4/4', '4/4', '3/4', '6/8', '4/4', '6/8'];
const HARP_STYLES: readonly HarpStyle[] = ['arp', 'broken', 'pulse', 'run'];

/**
 * The preset of a track; an unknown id gets a piece of its own from its hash (in the mode and
 * realm the game asks for), so every chapter added later still has distinct music.
 */
export function presetFor(track: string, mode: ChantMode = 1, realm: Realm = 'earth'): Preset {
  const known = Object.hasOwn(PRESETS, track) ? PRESETS[track] : undefined;
  if (known) return known;
  const rng = new Rng(hashString(track));
  const meter = rng.pick(METER_IDS);
  const [groove, alt] = rng.pick(GROOVES_BY_METER[meter]);
  return {
    id: track, name: 'Psalm 150', mode, realm, bpm: rng.int(80, 128), meter, lead: rng.chance(0.6) ? 'flute' : 'harp', groove, alt,
    harp: rng.pick(HARP_STYLES), bFlat: rng.chance(0.3) && (mode === 1 || mode === 2 || mode === 5 || mode === 6),
    pad: rng.range(0.2, 0.8), jingle: rng.range(0.2, 0.8), zil: rng.range(0.2, 0.6), shofar: rng.range(0, 0.4), swing: rng.chance(0.3) ? 0.1 : 0,
  };
}

// ─── Labels ─────────────────────────────────────────────────────────

const SOUNDSCAPE_LABELS: Readonly<Record<Exclude<SoundscapeId, 'psalm'>, string>> = {
  gregorianski: 'Chorał gregoriański',
  bizantyjski: 'Śpiew bizantyjski',
  dzwony: 'Dzwony',
  cisza: 'Cisza',
};

/** What the music controls show, e.g. "Malkut — Kołyska · wariacja 2". `variation` counts from 0. */
export function nowPlayingLabel(soundscape: SoundscapeId, track: string, variation: number): string {
  if (soundscape !== 'psalm') return SOUNDSCAPE_LABELS[soundscape];
  return `${presetFor(track).name} · wariacja ${variation + 1}`;
}

// ─── Scales ─────────────────────────────────────────────────────────

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const FINAL_PC = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B: the pitch class of a white-note step

/** Pitch class of the mode's final: D, E, F or G. */
export const finalPc = (mode: ChantMode): number => FINAL_PC[MODES[mode].final];

/** The mode's scale as semitones above its final: the white notes (B♭ for B when `bFlat`). */
export function modeScale(mode: ChantMode, bFlat = false): number[] {
  const f = finalPc(mode);
  return WHITE.map(pc => (bFlat && pc === 11 ? 10 : pc)).map(pc => (pc - f + 12) % 12).sort((a, b) => a - b);
}

/** A darker scale on the same tonic for boss fights: Dorian → Phrygian, Phrygian → Hijaz, Lydian and Mixolydian → Aeolian. */
export function darkScale(mode: ChantMode): number[] {
  switch (MODES[mode].final) {
    case 1: return [0, 1, 3, 5, 7, 8, 10];
    case 2: return [0, 1, 4, 5, 7, 8, 10];
    default: return [0, 2, 3, 5, 7, 8, 10];
  }
}

/** MIDI of a scale degree (0 = tonic; seven per octave, negative below) above `tonic`. */
export function degreeMidi(tonic: number, scale: readonly number[], degree: number): number {
  const octave = Math.floor(degree / 7);
  return tonic + 12 * octave + scale[degree - 7 * octave];
}

/** Whether `degree` carries a perfect fifth in `scale` (open-fifth harmony needs one). */
export function hasFifth(scale: readonly number[], degree: number): boolean {
  return degreeMidi(0, scale, degree + 4) - degreeMidi(0, scale, degree) === 7;
}

// ─── Motifs and their development ───────────────────────────────────

/** A note of a melody: grid position and length in steps, scale degree, ornament. */
export interface MotifNote {
  at: number;
  len: number;
  deg: number;
  /** 0 plain, 1 mordent (a quick turn to the upper neighbour and back), 2 grace note from above */
  orn: 0 | 1 | 2;
}

/** Motif rhythms per meter, in steps; each fills one bar. */
const RHYTHMS: Readonly<Record<MeterId, readonly (readonly number[])[]>> = {
  '4/4': [[4, 2, 2, 4, 4], [2, 2, 4, 4, 4], [6, 2, 4, 4], [4, 4, 2, 2, 4], [3, 3, 2, 4, 4], [2, 2, 2, 2, 4, 4], [4, 2, 2, 2, 2, 4], [6, 2, 2, 2, 4]],
  '3/4': [[4, 2, 2, 4], [6, 2, 4], [2, 2, 4, 4], [4, 4, 2, 2], [3, 1, 4, 4], [2, 2, 2, 2, 4]],
  '6/8': [[4, 2, 4, 2], [6, 4, 2], [2, 2, 2, 6], [4, 2, 6], [2, 2, 2, 4, 2]],
  '7/8': [[4, 4, 6], [2, 2, 4, 6], [4, 2, 2, 6], [2, 2, 2, 2, 6], [4, 4, 4, 2]],
  '7/8b': [[6, 4, 4], [6, 2, 2, 4], [4, 2, 4, 4], [2, 2, 2, 4, 4], [6, 4, 2, 2]],
  '5/4': [[6, 2, 4, 4, 4], [4, 4, 4, 8], [6, 6, 4, 4], [4, 2, 2, 4, 8], [2, 2, 2, 6, 4, 4]],
};

/** Cadence rhythms: a few approach notes, then the goal held to the bar line. */
const CADENCES: Readonly<Record<MeterId, readonly (readonly number[])[]>> = {
  '4/4': [[4, 4, 8], [2, 2, 4, 8], [4, 2, 2, 8]],
  '3/4': [[4, 8], [2, 2, 8]],
  '6/8': [[4, 2, 6], [2, 2, 2, 6]],
  '7/8': [[4, 4, 6], [2, 2, 4, 6]],
  '7/8b': [[6, 4, 4], [2, 2, 2, 8]],
  '5/4': [[6, 2, 12], [4, 4, 4, 8]],
};

/** Range of a melody in degrees about the final: authentic modes rise an octave from it, plagal ones surround it. */
export const ambitus = (mode: ChantMode): readonly [number, number] => (mode % 2 ? [-1, 8] : [-4, 5]);

/** Degrees a phrase may rest on: final, third, fifth (or the fourth below), the reciting tone. */
const restingDegrees = (mode: ChantMode): number[] => (mode % 2 ? [0, 2, 4, MODES[mode].tenor] : [0, 2, -3, MODES[mode].tenor]);

/**
 * A motif: one bar of a rhythm the meter suggests, moving mostly by step (now and then a third,
 * rarely a leap that then turns back) within the mode's range, closing on a resting degree; its
 * longest inner note may carry a mordent. At least three different notes.
 */
export function makeMotif(rng: Rng, meter: MeterId, mode: ChantMode): MotifNote[] {
  const [lo, hi] = ambitus(mode);
  const resting = restingDegrees(mode);
  for (let attempt = 0; ; attempt++) {
    const rhythm = rng.pick(RHYTHMS[meter]);
    const notes: MotifNote[] = [];
    let deg = rng.pick(mode % 2 ? [0, 2, 4] : [0, 2, -1]);
    let dir = rng.chance(0.5) ? 1 : -1;
    let at = 0;
    rhythm.forEach((len, i) => {
      if (i === rhythm.length - 1) {
        const near = resting.filter(d => Math.abs(d - deg) <= 3 && d !== deg);
        deg = near.length ? rng.pick(near) : resting.reduce((a, b) => (Math.abs(b - deg) < Math.abs(a - deg) ? b : a));
      } else if (i > 0) {
        const r = rng.next();
        const step = r < 0.55 ? 1 : r < 0.8 ? 2 : r < 0.92 ? rng.int(3, 4) : 0;
        if (rng.chance(0.3)) dir = -dir;
        if (deg + dir * step < lo || deg + dir * step > hi) dir = -dir;
        deg = Math.min(hi, Math.max(lo, deg + dir * step));
        if (step >= 3) dir = -dir; // after a leap, turn back
      }
      notes.push({ at, len, deg, orn: 0 });
      at += len;
    });
    if (new Set(notes.map(n => n.deg)).size < 3 && attempt < 8) continue;
    const inner = notes.slice(1, -1);
    if (inner.length && rng.chance(0.45)) inner.reduce((a, b) => (b.len > a.len ? b : a)).orn = 1;
    if (inner.length && rng.chance(0.3)) rng.pick(inner).orn ||= 2;
    if (notes.length >= 4 && rng.chance(0.2)) notes.shift(); // it starts after a rest: a pickup feel
    return notes;
  }
}

/** How a motif is developed: transposed by `k` degrees, inverted, its pitches reversed, displaced, ornamented. */
export interface Variant {
  k?: number;
  inv?: boolean;
  retro?: boolean;
  /** rhythmic displacement in steps: it enters late, its last note shortened to fit the bar */
  shift?: number;
  orn?: boolean;
}

export function vary(motif: readonly MotifNote[], v: Variant, steps: number): MotifNote[] {
  let notes = motif.map(n => ({ ...n }));
  if (v.retro) {
    const degs = notes.map(n => n.deg).reverse();
    notes.forEach((n, i) => (n.deg = degs[i]));
  }
  if (v.inv && notes.length) {
    const axis = notes[0].deg; // mirrored about its first note
    for (const n of notes) n.deg = 2 * axis - n.deg;
  }
  if (v.k) for (const n of notes) n.deg += v.k;
  if (v.shift) {
    const shift = v.shift;
    notes = notes.map(n => ({ ...n, at: n.at + shift })).filter(n => n.at < steps - 1);
    for (const n of notes) n.len = Math.min(n.len, steps - n.at);
  }
  if (v.orn) {
    for (const n of notes) if (n.orn === 0 && n.len >= 4) n.orn = 1;
    const first = notes.find(n => n.orn === 0 && n.len >= 2);
    if (first) first.orn = 2;
  }
  return notes;
}

/** The first half of a motif: a fragment for sequences and answers. */
export function fragment(motif: readonly MotifNote[], steps: number): MotifNote[] {
  const half = steps / 2;
  return motif.filter(n => n.at < half).map(n => ({ ...n, len: Math.min(n.len, half - n.at) }));
}

/**
 * A cadence onto `goal`: down by step (or, in modes 1, 2, 7 and 8, sometimes from the whole tone
 * below, like the chant's endings), the goal held to the bar line.
 */
export function cadence(rng: Rng, meter: MeterId, mode: ChantMode, goal: number): MotifNote[] {
  const rhythm = rng.pick(CADENCES[meter]);
  const n = rhythm.length;
  const below = (mode === 1 || mode === 2 || mode === 7 || mode === 8) && rng.chance(0.35);
  const degs = rhythm.map((_, i) => goal + (n - 1 - i));
  if (below) degs[n - 2] = goal - 1;
  let at = 0;
  return rhythm.map((len, i) => {
    const note: MotifNote = { at, len, deg: degs[i], orn: i === n - 2 && rng.chance(0.3) ? 1 : 0 };
    at += len;
    return note;
  });
}

// ─── Pieces ─────────────────────────────────────────────────────────

/** A track in one variation: everything its music is made from. */
export interface Piece {
  track: string;
  preset: Preset;
  variation: number;
  /** the motif and every arrangement of this variation grow from it */
  seed: number;
  meter: Meter;
  /** seconds per grid step */
  step: number;
  /** MIDI of the tonic in the melody register (D4–G4) */
  tonic: number;
  scale: readonly number[];
  /** the boss variant's darker scale, on the same tonic */
  dark: readonly number[];
  /** the mode's colour chords: roots (degrees) with a perfect fifth, the harmony leans on them */
  colours: readonly number[];
  /** root of a half cadence */
  half: number;
  motif: MotifNote[];
  /** a second idea, for the B sections */
  answer: MotifNote[];
}

/** Preferred colour chords per final (degrees): Dorian VII IV V, Phrygian II VII IV, Lydian II V VI, Mixolydian VII IV V. */
const COLOURS: Readonly<Record<number, readonly number[]>> = { 1: [6, 3, 4], 2: [1, 6, 3], 3: [1, 4, 5], 4: [6, 3, 4] };

export function makePiece(track: string, variation: number, mode: ChantMode = 1, realm: Realm = 'earth'): Piece {
  const preset = presetFor(track, mode, realm);
  const seed = (hashString(track) ^ Math.imul(variation + 1, 0x9e3779b9)) >>> 0;
  const rng = new Rng(seed);
  const meter = METERS[preset.meter];
  const scale = modeScale(preset.mode, preset.bFlat);
  const colours = COLOURS[MODES[preset.mode].final].filter(d => hasFifth(scale, d)).slice(0, 2);
  const motif = makeMotif(rng, preset.meter, preset.mode);
  let answer = makeMotif(rng, preset.meter, preset.mode);
  if (answer.map(n => n.deg).join() === motif.map(n => n.deg).join()) answer = vary(answer, { inv: true }, meter.steps);
  return {
    track, preset, variation, seed, meter, step: 60 / preset.bpm / meter.sub,
    tonic: 60 + finalPc(preset.mode), scale, dark: darkScale(preset.mode), colours, half: hasFifth(scale, 4) ? 4 : 3, motif, answer,
  };
}

// ─── Form ───────────────────────────────────────────────────────────

export type SectionKind = 'intro' | 'A' | 'B' | 'bridge' | 'breakdown' | 'climax' | 'interlude';
/** Drum fills that close a section (or its first half). */
export type Fill = 'roll' | 'doums' | 'flam' | 'break' | 'shake' | 'call';

/** A melody for one bar, `oct` octaves above the instrument's register. */
export interface Line {
  notes: MotifNote[];
  oct: number;
}

export interface BarPlan {
  /** degree of the chord root under the bar */
  root: number;
  /** the lead instrument's melody, if it plays */
  lead: Line | null;
  /** the other one (flute ↔ harp): an answer (call and response) or a line in parallel */
  alt: Line | null;
  /** a drum fill in this bar */
  fill: Fill | null;
}

export interface Section {
  kind: SectionKind;
  bars: BarPlan[];
  groove: string;
  harp: HarpStyle;
  /** 0–1, how busy the accompaniment is */
  density: number;
}

/** A form lasts at least this long, s, before the next round re-arranges the piece. */
export const FORM_SECONDS = 280;

const FORMS: readonly (readonly SectionKind[])[] = [
  ['intro', 'A', 'B', 'A', 'bridge', 'B', 'breakdown', 'A', 'climax', 'interlude', 'B', 'bridge', 'A', 'climax', 'breakdown', 'A'],
  ['intro', 'A', 'A', 'B', 'bridge', 'A', 'breakdown', 'B', 'climax', 'A', 'interlude', 'B', 'A', 'bridge', 'climax', 'B'],
  ['intro', 'A', 'B', 'breakdown', 'A', 'bridge', 'B', 'climax', 'interlude', 'A', 'B', 'bridge', 'climax', 'A', 'breakdown', 'B'],
];
const FILLS: readonly Fill[] = ['roll', 'doums', 'flam', 'break', 'shake', 'call'];
const HARP_ALT: Readonly<Record<HarpStyle, HarpStyle>> = { arp: 'broken', broken: 'arp', pulse: 'arp', run: 'pulse' };
const DENSITY: Readonly<Record<SectionKind, number>> = { intro: 0.4, A: 0.7, B: 0.6, bridge: 0.8, breakdown: 0.3, climax: 1, interlude: 0.5 };

/** The arrangement of a piece for one round: sections until FORM_SECONDS are filled. */
export function makeForm(piece: Piece, round: number): Section[] {
  const rng = new Rng((piece.seed ^ Math.imul(round + 1, 0x85ebca6b)) >>> 0);
  const kinds = [...rng.pick(FORMS)];
  if (round > 0) kinds[0] = rng.chance(0.5) ? 'A' : 'interlude'; // later rounds need no intro
  const barSeconds = piece.meter.steps * piece.step;
  const sections: Section[] = [];
  let fill: Fill | null = null;
  for (let i = 0, seconds = 0; seconds < FORM_SECONDS; i++) {
    const kind = kinds[i % kinds.length];
    const bars = kind === 'intro' || kind === 'bridge' || kind === 'breakdown' || kind === 'interlude' ? 8 : rng.chance(0.5) ? 16 : 8;
    const section = makeSection(rng, piece, kind, bars, fill);
    fill = section.bars.at(-1)?.fill ?? fill;
    sections.push(section);
    seconds += bars * barSeconds;
  }
  return sections;
}

/** Ghost strokes and softened teks: the same groove, played a little differently. */
function ornamentGroove(rng: Rng, groove: string, amount: number): string {
  return [...groove].map((c, i) => {
    if (c === '.' && i % 2 === 0 && rng.chance(0.25 * amount)) return 'k';
    if (c === 'T' && i > 0 && rng.chance(0.15 * amount)) return 't';
    return c;
  }).join('');
}

/** Only the downbeat's doum and the lighter strokes: for intros and breakdowns. */
const thinGroove = (groove: string): string => [...groove].map((c, i) => (i === 0 ? 'D' : c === 'T' ? 't' : c === 'k' || c === 't' ? c : '.')).join('');

function makeSection(rng: Rng, piece: Piece, kind: SectionKind, bars: number, prevFill: Fill | null): Section {
  const { preset, meter, motif, answer } = piece;
  const steps = meter.steps;
  const [c1, c2 = c1] = piece.colours.length ? piece.colours : [0];
  const h = piece.half;
  const harmony: Readonly<Record<SectionKind, readonly (readonly number[])[]>> = {
    intro: [[0, 0, 0, 0, c1, c1, 0, 0]],
    A: [[0, 0, c1, h, 0, c2, c1, 0], [0, c1, 0, h, 0, c1, h, 0]],
    B: [[c1, c1, 0, h, c2, c2, h, 0], [h, h, c1, c1, c2, 0, h, 0]],
    bridge: [[c2, c2, c1, c1, h, h, h, h], [c1, h, c2, h, c1, h, c2, h]],
    breakdown: [[0, 0, 0, 0, c1, c1, 0, 0], [0, 0, c2, c2, 0, 0, c1, 0]],
    climax: [[0, c1, h, 0, 0, c2, h, 0]],
    interlude: [[0, 0, c1, 0, 0, 0, c2, 0]],
  };
  const k = (): number => rng.pick([1, 2, 3, -1, -2, 4]);
  // developments go round a shuffled list, so neighbouring phrases never develop the motif alike
  const variants: Variant[] = [{ inv: true }, { shift: 2 }, { retro: true }, { inv: true, k: k() }, { k: k(), orn: true }, { retro: true, shift: 2 }];
  for (let i = variants.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [variants[i], variants[j]] = [variants[j], variants[i]];
  }
  let developed = 0;
  const develop = (m: readonly MotifNote[]): MotifNote[] => vary(m, variants[developed++ % variants.length], steps);
  const half = (): MotifNote[] => cadence(rng, preset.meter, preset.mode, rng.chance(0.5) ? 4 : MODES[preset.mode].tenor);
  const full = (): MotifNote[] => cadence(rng, preset.meter, preset.mode, 0);
  const longOnly = (m: readonly MotifNote[]): MotifNote[] => m.filter(n => n.len >= 4 || n.at === 0);
  /** one four-bar phrase; null = the melody rests */
  const phrase = (g: number): (MotifNote[] | null)[] => {
    const f = fragment(motif, steps);
    switch (kind) {
      case 'intro': return g === 0 ? [null, null, null, null] : [null, null, f, full()];
      case 'A': return g % 2 === 0 ? [motif, vary(motif, { k: k() }, steps), develop(motif), half()] : [vary(motif, { orn: rng.chance(0.5) }, steps), vary(motif, { k: k() }, steps), develop(motif), full()];
      case 'B': return g % 2 === 0 ? [answer, vary(answer, { k: k() }, steps), develop(answer), half()] : [answer, develop(motif), vary(answer, { k: k() }, steps), full()];
      case 'bridge': return g % 2 === 0 ? [f, vary(f, { k: 1 }, steps), vary(f, { k: 2 }, steps), vary(f, { k: 3 }, steps)] : [vary(answer, { inv: true }, steps), vary(answer, { k: k() }, steps), fragment(answer, steps), half()];
      case 'breakdown': return [longOnly(motif), null, longOnly(answer), null];
      case 'climax': return [motif, vary(motif, { k: k() }, steps), vary(motif, { inv: true }, steps), full()];
      case 'interlude': return [motif, null, vary(motif, { k: k() }, steps), null];
    }
  };
  const textures = { solo: 0, dialog: 1, unison: 2 } as const;
  const pickTexture = (): number => {
    const r = rng.next();
    switch (kind) {
      case 'intro': case 'breakdown': return textures.solo;
      case 'interlude': return textures.dialog;
      case 'climax': return r < 0.7 ? textures.unison : textures.dialog;
      case 'bridge': return r < 0.6 ? textures.dialog : textures.unison;
      case 'B': return r < 0.5 ? textures.dialog : r < 0.8 ? textures.solo : textures.unison;
      default: return r < 0.5 ? textures.solo : r < 0.8 ? textures.dialog : textures.unison;
    }
  };
  const oct = kind === 'climax' && preset.lead === 'harp' ? 1 : 0;
  const plans: BarPlan[] = [];
  for (let block = 0; block < bars / 8; block++) {
    const roots = rng.pick(harmony[kind]);
    const texture = pickTexture();
    const below = rng.chance(0.5) ? -2 : -7; // the parallel line: a third or an octave below
    for (let g = 0; g < 2; g++) {
      phrase(2 * block + g).forEach((notes, b) => {
        const i = 4 * g + b;
        let lead: Line | null = notes && { notes, oct };
        let alt: Line | null = null;
        if (kind === 'intro' && notes) [lead, alt] = [null, { notes, oct: 0 }]; // the other instrument hints at the motif
        else if (kind === 'interlude' && !notes) alt = { notes: vary(answer, { k: k() }, steps), oct: 0 };
        else if (texture === textures.dialog && notes && b % 2 === 1) [lead, alt] = [null, { notes, oct: 0 }];
        else if (texture === textures.unison && notes) alt = { notes: vary(notes, { k: below }, steps), oct: 0 };
        plans.push({ root: roots[i], lead, alt, fill: null });
      });
    }
  }
  // fills close the section and its first half, never the same twice running
  let last = prevFill;
  for (const i of bars === 16 ? [7, 15] : [bars - 1]) {
    last = rng.pick(FILLS.filter(f => f !== last));
    plans[i].fill = last;
  }
  const grooves: Readonly<Record<SectionKind, string>> = {
    intro: thinGroove(preset.groove), A: preset.groove, B: preset.alt, bridge: rng.chance(0.5) ? preset.alt : preset.groove,
    breakdown: thinGroove(preset.groove), climax: preset.groove, interlude: thinGroove(preset.alt),
  };
  return {
    kind,
    bars: plans,
    groove: ornamentGroove(rng, grooves[kind], kind === 'climax' || kind === 'bridge' ? 1 : 0.5),
    harp: kind === 'B' || kind === 'interlude' ? HARP_ALT[preset.harp] : kind === 'breakdown' ? 'broken' : preset.harp,
    density: Math.min(1, Math.max(0.2, DENSITY[kind] + rng.range(-0.1, 0.1))),
  };
}
