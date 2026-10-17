/**
 * The music director: turns the soundscape and mood into a stream of timed cues for the choir
 * and the bells. No Web Audio here, so it is unit-testable.
 *
 * Music is composed one block at a time (a psalm-tone phrase, or a touch of bells) just in time:
 * when the lookahead window reaches the end of the previous block and its silence. A mood change
 * therefore takes effect from the next phrase and never cuts one in half; a soundscape change
 * releases what is sounding (a fade of about a second) and starts the new soundscape CROSSFADE
 * seconds later, while bells already struck ring on.
 */
import type { MusicMood, SoundscapeId } from '../types';
import { plainHunt } from './bells';
import { clamp, finalDegree, generatePhrase, midiOfDegree, organum, type ChantEvent, type Vowel } from './chant';
import { Rng } from './rng';
import { CueQueue } from './scheduler';

/** The choir's two sections: the melody, and a lower part for organum, ison and drones. */
export type Part = 'lead' | 'low';

export interface NoteCue {
  kind: 'note';
  at: number;
  part: Part;
  midi: number;
  dur: number;
  vowel: Vowel;
  /** loudness of the section, 0–1 */
  level: number;
  /** singers active in the section */
  voices: number;
  /** continues the previous note's syllable (a melisma, a held drone): no consonant between */
  tie: boolean;
}

export interface RestCue {
  kind: 'rest';
  at: number;
  part: Part;
  /** release time constant, s */
  release: number;
  /** an audible breath (at the half-verse, or the ison re-taking breath) */
  breath: boolean;
}

export interface BellCue { kind: 'bell'; at: number; midi: number; level: number; pan: number }

export type Cue = NoteCue | RestCue | BellCue;

/** Seconds from releasing the old soundscape to the first cue of the new one. */
export const CROSSFADE = 1.6;

/** "Veni Creator Spiritus, mentes tuorum visita, imple superna gratia, quae tu creasti pectora": one vowel per syllable. */
const VENI = 'eieaoiiueeuouiiaieueaaiaeueaieoa';

const steady = (mood: MusicMood): MusicMood => ({ ...mood, intensity: clamp(mood.intensity, 0, 1) });

/** Silence between phrases: 1.5–4 s, longer when calm; Hell lingers longer still. */
export function phraseGap(rng: Rng, { intensity, realm }: MusicMood): number {
  const gap = clamp(4 - 2.5 * intensity + rng.range(-0.3, 0.3), 1.5, 4);
  return realm === 'hell' ? gap + 1.5 : gap;
}

export class Composer {
  private readonly queue = new CueQueue<Cue>();
  private readonly rng: Rng;
  private mood: MusicMood;
  /** the next block may begin here */
  private horizon = 0;
  /** cues before this time have been handed out */
  private scheduled = 0;

  constructor(
    private soundscape: SoundscapeId,
    mood: MusicMood,
    seed = 1,
  ) {
    this.rng = new Rng(seed);
    this.mood = steady(mood);
  }

  /** Cues due before `until`, composing new blocks as the window reaches them. */
  take(now: number, until: number): Cue[] {
    while (this.soundscape !== 'cisza' && this.horizon < until) {
      this.horizon = this.compose(Math.max(this.horizon, now + 0.05));
    }
    this.scheduled = Math.max(this.scheduled, until);
    return this.queue.take(until);
  }

  setSoundscape(id: SoundscapeId): void {
    if (id === this.soundscape) return;
    this.soundscape = id;
    this.fadeOut();
  }

  /** Takes effect from the next phrase. */
  setMood(mood: MusicMood): void {
    this.mood = steady(mood);
  }

  /**
   * The hymn to the Holy Spirit: one strike of a deep bell, then three solemn phrases in mode 8 on
   * the vowels of "Veni Creator Spiritus"; afterwards the soundscape carries on.
   */
  invocation(): void {
    this.fadeOut();
    let t = this.scheduled + 0.8;
    this.queue.push({ kind: 'bell', at: t, midi: 55, level: 0.9, pan: 0 }); // G, the final of mode 8
    t += 4;
    let syllable = 0;
    for (let i = 0; i < 3; i++) {
      const s = syllable % VENI.length;
      const vowels = VENI.slice(s) + VENI.slice(0, s);
      const phrase = generatePhrase(this.rng, { mode: 8, intensity: 0.1, realm: 'earth', solemn: true, vowels });
      this.line('lead', phrase.events, t, 0.85, 3);
      syllable += phrase.events[phrase.events.length - 1].syllable + 1;
      t += phrase.length + 2.5;
    }
    this.horizon = t;
  }

  /**
   * Releases whatever is sounding; the next block starts after the crossfade. The release comes
   * just after the notes already handed out, whose automation runs up to 10 ms past their start.
   */
  private fadeOut(): void {
    const at = this.scheduled + 0.05;
    this.queue.clear();
    for (const part of ['lead', 'low'] as const) this.queue.push({ kind: 'rest', at, part, release: 0.45, breath: false });
    this.horizon = at + CROSSFADE;
  }

  /** Composes one block from `start`; returns when the next may begin. */
  private compose(start: number): number {
    if (this.soundscape === 'dzwony') return this.bells(start);
    const { mode, intensity, realm } = this.mood;
    const byzantine = this.soundscape === 'bizantyjski';
    const phrase = generatePhrase(this.rng, { ...this.mood, ornate: byzantine ? 0.5 + 0.4 * intensity : 0 });
    const level = (0.6 + 0.35 * intensity) * (realm === 'hell' ? 0.75 : 1); // Hell: darker and more distant
    // Byzantine: a solo cantor, joined by more singers as intensity rises; the Gregorian schola is three strong
    const voices = byzantine ? 1 + Number(intensity >= 0.3) + Number(intensity >= 0.7) : 3;
    this.line('lead', phrase.events, start, level, voices);
    const end = start + phrase.length + phraseGap(this.rng, this.mood);
    if (byzantine) this.drone(start, end, phrase.final, 'o', 0.8); // the ison holds the final
    else if (realm === 'hell') this.drone(start, end, phrase.final, 'u', 0.35);
    else if (phrase.octaveDouble) this.line('low', phrase.events.map(e => ({ ...e, midi: e.midi + 12 })), start, 0.5 * level, 2);
    else if (intensity >= 0.6) this.line('low', organum(phrase.events, mode), start, 0.7 * level, 2);
    return end;
  }

  /** A sung line: legato notes, a breath wherever the melody pauses, a release at its end. */
  private line(part: Part, events: readonly ChantEvent[], start: number, level: number, voices: number): void {
    let end = start;
    events.forEach((e, i) => {
      const at = start + e.start;
      if (i > 0 && at > end + 0.01) this.queue.push({ kind: 'rest', at: end, part, release: 0.08, breath: true });
      const tie = i > 0 && events[i - 1].syllable === e.syllable;
      this.queue.push({ kind: 'note', at, part, midi: e.midi, dur: e.dur, vowel: e.vowel, level, voices, tie });
      end = at + e.dur;
    });
    this.queue.push({ kind: 'rest', at: end, part, release: 0.15, breath: false });
  }

  /**
   * A drone on the low part (the Byzantine ison): it swells and ebbs with each breath of
   * 2.5–4.5 s, and every 9–15 s the singers re-take breath. It closes exactly at `to`, where the
   * next block may take it up again without a seam.
   */
  private drone(from: number, to: number, midi: number, vowel: Vowel, level: number): void {
    let t = from;
    let tie = false;
    let untilBreath = this.rng.range(9, 15);
    while (to - t > 0.01) {
      const len = to - t < 5.5 ? to - t : this.rng.range(2.5, 4.5);
      this.queue.push({ kind: 'note', at: t, part: 'low', midi, dur: len, vowel, level: level * this.rng.range(0.82, 1), voices: 2, tie });
      t += len;
      tie = true;
      untilBreath -= len;
      if (untilBreath <= 0 && to - t > 2) {
        this.queue.push({ kind: 'rest', at: t, part: 'low', release: 0.06, breath: true });
        t += 0.45;
        tie = false;
        untilBreath = this.rng.range(9, 15);
      }
    }
    this.queue.push({ kind: 'rest', at: to, part: 'low', release: 0.3, breath: false });
  }

  /**
   * Usually a touch of change ringing (rounds, a plain course of Plain Hunt, rounds) on a ring of
   * 4–6 bells tuned down the mode's scale to its final; sometimes the Angelus on the tenor bell
   * (three strokes, thrice, then nine). A soft hummed drone holds the final beneath.
   */
  private bells(start: number): number {
    const { mode, intensity, realm } = this.mood;
    const tenor = finalDegree(mode, realm) + 7; // the heaviest bell sounds the final, an octave above the chant
    const loud = 0.55 + 0.3 * intensity;
    let t = start;
    const strike = (degree: number, level: number, pan: number): void => {
      this.queue.push({ kind: 'bell', at: t + this.rng.range(0, 0.02), midi: midiOfDegree(degree), level: level * this.rng.range(0.9, 1), pan });
    };
    if (this.rng.chance(0.25)) {
      for (const [strokes, pause] of [[3, 3], [3, 3], [3, 3], [9, 0]]) {
        for (let i = 0; i < strokes; i++, t += 2) strike(tenor, loud, 0);
        t += pause;
      }
    } else {
      const n = realm === 'hell' ? 4 : intensity >= 0.6 ? 6 : 5;
      const stroke = (0.8 - 0.3 * intensity) * (realm === 'hell' ? 1.25 : 1); // s between strikes
      const rounds = Array.from({ length: n }, (_, i) => i);
      [rounds, rounds, ...plainHunt(n), rounds].forEach((row, r) => {
        for (const bell of row) {
          // bell 0 is the treble (highest, softest, on the left), n − 1 the tenor
          strike(tenor + n - 1 - bell, loud * (0.6 + (0.4 * bell) / (n - 1)), 0.9 * (bell / (n - 1) - 0.5));
          t += stroke;
        }
        if (r % 2 === 1) t += stroke; // the open handstroke lead after each backstroke row
      });
    }
    const end = t + 2 + phraseGap(this.rng, this.mood); // let the last bells ring out
    this.drone(start, end, midiOfDegree(tenor - 7), 'u', 0.25);
    return end;
  }
}
