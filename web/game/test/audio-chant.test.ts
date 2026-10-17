import { describe, expect, it } from 'vitest';
import {
  B_FLAT_MODES, RANGE, generatePhrase, isInMode, organum, type Phrase, type PhraseOptions, type Realm,
} from '../src/audio/chant';
import { Rng } from '../src/audio/rng';
import type { ChantMode } from '../src/types';

const MODES: ChantMode[] = [1, 2, 3, 4, 5, 6, 7, 8];
const REALMS: Realm[] = ['earth', 'heaven', 'hell'];
// Gregorian finals and reciting tones as pitch classes: 1 D/A, 2 D/F, 3 E/C, 4 E/A, 5 F/C, 6 F/A, 7 G/D, 8 G/C
const FINAL_PC: Record<ChantMode, number> = { 1: 2, 2: 2, 3: 4, 4: 4, 5: 5, 6: 5, 7: 7, 8: 7 };
const TENOR_PC: Record<ChantMode, number> = { 1: 9, 2: 5, 3: 0, 4: 9, 5: 0, 6: 9, 7: 2, 8: 0 };

const pc = (midi: number): number => ((midi % 12) + 12) % 12;
const phrase = (seed: number, o: Partial<PhraseOptions> = {}): Phrase =>
  generatePhrase(new Rng(seed), { mode: 1, intensity: 0.5, realm: 'earth', ...o });
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Every mode × realm × intensity × plain/ornate, a few seeds each. */
const CORPUS = MODES.flatMap(mode =>
  REALMS.flatMap(realm =>
    [0, 0.5, 1].flatMap(intensity =>
      [0, 0.9].flatMap(ornate =>
        [1, 2, 3, 4, 5, 6].map(seed => {
          const opts = { mode, realm, intensity, ornate };
          return { opts, p: phrase(seed * 7919 + mode, opts) };
        }),
      ),
    ),
  ),
);
const PLAIN = CORPUS.filter(c => c.opts.ornate === 0);

/** Notes grouped by syllable. */
function syllables(p: Phrase): Phrase['events'][] {
  const groups: Phrase['events'][] = [];
  for (const e of p.events) (groups[e.syllable] ??= []).push(e);
  return groups;
}

/** The two half-verses, split at the breath. */
function halves(p: Phrase): [Phrase['events'], Phrase['events']] {
  const i = p.events.findIndex((e, k) => k > 0 && e.start > p.events[k - 1].start + p.events[k - 1].dur + 0.2);
  return [p.events.slice(0, i), p.events.slice(i)];
}

describe('chant generator', () => {
  it('sings only notes of the mode: white notes, B♭ only in modes 1, 2, 5, 6', () => {
    for (const { opts, p } of CORPUS) {
      for (const e of p.events) {
        expect(isInMode(e.midi, opts.mode), `mode ${opts.mode}: midi ${e.midi}`).toBe(true);
        if (pc(e.midi) === 10) expect(B_FLAT_MODES.has(opts.mode)).toBe(true);
      }
    }
    const flats = (mode: ChantMode) => CORPUS.filter(c => c.opts.mode === mode).some(c => c.p.events.some(e => pc(e.midi) === 10));
    expect(flats(5) && flats(6) && flats(1)).toBe(true);
  });

  it('ends every phrase on the final, and recites on the Gregorian tenor', () => {
    for (const { opts, p } of CORPUS) {
      expect(p.events[p.events.length - 1].midi).toBe(p.final);
      expect(pc(p.final)).toBe(FINAL_PC[opts.mode]);
      expect(pc(p.tenor)).toBe(TENOR_PC[opts.mode]);
    }
  });

  it('recites on the tenor: in plain psalmody each half-verse has 4+ repeated tenor notes', () => {
    for (const { p } of PLAIN) {
      for (const half of halves(p)) {
        let run = 0;
        let best = 0;
        for (const e of half) best = Math.max(best, (run = e.midi === p.tenor ? run + 1 : 0));
        expect(best).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('breathes once, at the half-verse', () => {
    for (const { p } of CORPUS) {
      const gaps = p.events.slice(1).map((e, i) => e.start - (p.events[i].start + p.events[i].dur));
      expect(gaps.filter(g => g > 1e-9)).toHaveLength(1);
      expect(Math.max(...gaps)).toBeGreaterThanOrEqual(0.45);
    }
  });

  it('keeps time: starts increase, notes never overlap, durations are sane', () => {
    for (const { p } of CORPUS) {
      p.events.forEach((e, i) => {
        expect(e.dur).toBeGreaterThan(0.1);
        expect(e.dur).toBeLessThan(2.6);
        if (i > 0) expect(e.start).toBeGreaterThanOrEqual(p.events[i - 1].start + p.events[i - 1].dur - 1e-9);
      });
      const last = p.events[p.events.length - 1];
      expect(p.length).toBeCloseTo(last.start + last.dur, 9);
    }
  });

  it('paces syllables at 0.4–0.55 s, slower when calm and when solemn', () => {
    const beat = (o: Partial<PhraseOptions>) => median(phrase(11, o).events.filter(e => !e.melisma).map(e => e.dur));
    expect(beat({ intensity: 0 })).toBeGreaterThan(0.5);
    expect(beat({ intensity: 0 })).toBeLessThan(0.6);
    expect(beat({ intensity: 1 })).toBeGreaterThan(0.37);
    expect(beat({ intensity: 1 })).toBeLessThan(0.44);
    expect(beat({ intensity: 0, solemn: true })).toBeGreaterThan(beat({ intensity: 0 }) * 1.2);
  });

  it('lengthens the cadences (last note ≈ 1.6–2.2 × a syllable)', () => {
    for (const { p } of PLAIN) {
      const syllable = median(p.events.filter(e => e.midi === p.tenor && !e.melisma).map(e => e.dur));
      const ratio = p.events[p.events.length - 1].dur / syllable;
      expect(ratio).toBeGreaterThan(1.4);
      expect(ratio).toBeLessThan(2.5);
      expect(halves(p)[0].at(-1)!.dur / syllable).toBeGreaterThan(1.4);
    }
  });

  it('moves mostly by step, with occasional thirds and rarely a fourth or fifth', () => {
    const leaps = PLAIN.flatMap(({ p }) => p.events.slice(1).map((e, i) => Math.abs(e.midi - p.events[i].midi)));
    expect(Math.max(...leaps)).toBeLessThanOrEqual(7);
    expect(leaps.filter(d => d <= 2).length / leaps.length).toBeGreaterThan(0.85);
    expect(leaps.filter(d => d > 4).length / leaps.length).toBeLessThan(0.03);
  });

  it('groups melismas of 2–3 notes on one syllable, more of them in ornate (Byzantine) singing', () => {
    for (const { p } of CORPUS) {
      for (const g of syllables(p)) {
        expect(g.length).toBeLessThanOrEqual(3);
        expect(g.every(e => e.melisma === (g.length > 1 ? true : undefined) && e.vowel === g[0].vowel)).toBe(true);
      }
    }
    const share = (ornate: number) => {
      const all = CORPUS.filter(c => c.opts.ornate === ornate).flatMap(c => c.p.events);
      return all.filter(e => e.melisma).length / all.length;
    };
    expect(share(0)).toBeGreaterThan(0.02);
    expect(share(0.9)).toBeGreaterThan(2 * share(0));
  });

  it('keeps to a men’s range, lower in Hell', () => {
    for (const { opts, p } of CORPUS) {
      const [lo, hi] = RANGE[opts.realm];
      for (const e of p.events) {
        expect(e.midi).toBeGreaterThanOrEqual(lo);
        expect(e.midi).toBeLessThanOrEqual(hi);
      }
    }
    expect(RANGE.earth).toEqual([48, 64]);
    const mean = (realm: Realm) => {
      const all = CORPUS.filter(c => c.opts.realm === realm).flatMap(c => c.p.events.map(e => e.midi));
      return all.reduce((a, b) => a + b, 0) / all.length;
    };
    expect(mean('earth') - mean('hell')).toBeCloseTo(12, 0);
  });

  it('doubles at the upper octave only in Heaven at high intensity', () => {
    expect(phrase(3, { realm: 'heaven', intensity: 0.8 }).octaveDouble).toBe(true);
    expect(phrase(3, { realm: 'heaven', intensity: 0.3 }).octaveDouble).toBe(false);
    expect(phrase(3, { realm: 'earth', intensity: 1 }).octaveDouble).toBe(false);
  });

  it('is deterministic for a seed', () => {
    expect(phrase(42, { mode: 7 })).toEqual(phrase(42, { mode: 7 }));
    expect(phrase(42, { mode: 7 })).not.toEqual(phrase(43, { mode: 7 }));
  });

  it('sings the doxology’s vowels, every phrase closing on E-U-O-U-A-E, or the given text', () => {
    for (const { p } of CORPUS.slice(0, 60)) {
      const vowels = syllables(p).map(g => g[0].vowel);
      expect(vowels.slice(-6).join('')).toBe('euouae');
    }
    const veni = syllables(phrase(5, { vowels: 'eieaoiiu' })).map(g => g[0].vowel);
    expect(veni.slice(0, 10).join('')).toBe('eieaoiiuei');
  });

  it('adds parallel organum a fourth below (a fifth where the fourth would leave the mode)', () => {
    for (const { opts, p } of PLAIN) {
      organum(p.events, opts.mode).forEach((o, i) => {
        const e = p.events[i];
        expect([5, 7]).toContain(e.midi - o.midi);
        expect(isInMode(o.midi, opts.mode)).toBe(true);
        expect([o.start, o.dur, o.vowel]).toEqual([e.start, e.dur, e.vowel]);
      });
    }
  });
});
