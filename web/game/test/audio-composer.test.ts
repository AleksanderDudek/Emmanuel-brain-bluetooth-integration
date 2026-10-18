import { describe, expect, it } from 'vitest';
import { BELL_PARTIALS, renderBell, plainHunt } from '../src/audio/bells';
import { isInMode } from '../src/audio/chant';
import { CROSSFADE, Composer, type Cue, type NoteCue } from '../src/audio/composer';
import { impulseResponse } from '../src/audio/reverb';
import { CueQueue, LOOKAHEAD, Metronome, TICK_MS } from '../src/audio/scheduler';
import { MAX_SFX_VOICES, SfxGate } from '../src/audio/sfx';
import type { MusicMood, SfxName, SoundscapeId } from '../src/types';

const EARTH: MusicMood = { mode: 1, intensity: 0.4, realm: 'earth', track: 'malkut', scene: 'battle' };
/** A chant mood (chant ignores track and scene). */
const chantMood = (m: Pick<MusicMood, 'mode' | 'intensity' | 'realm'>): MusicMood => ({ ...m, track: 'malkut', scene: 'battle' });
const pc = (midi: number): number => ((midi % 12) + 12) % 12;
const notes = (cues: Cue[], part: 'lead' | 'low') => cues.filter((c): c is NoteCue => c.kind === 'note' && c.part === part);

/** Drives a composer the way the engine's timer does; checks every cue arrives inside its window. */
class Clock {
  now = 0;
  private until = 0;

  constructor(readonly composer: Composer) {}

  /** the end of the window handed out so far */
  get edge(): number {
    return this.until;
  }

  run(seconds: number): Cue[] {
    const cues: Cue[] = [];
    for (const end = this.now + seconds; this.now < end; this.now += TICK_MS / 1000) {
      const until = this.now + LOOKAHEAD;
      for (const cue of this.composer.take(this.now, until)) {
        expect(cue.at).toBeLessThan(until);
        expect(cue.at).toBeGreaterThanOrEqual(this.until - 1e-9); // never handed out late
        cues.push(cue);
      }
      this.until = until;
    }
    return cues;
  }
}

const start = (soundscape: SoundscapeId, mood: MusicMood = EARTH, seed = 7) => new Clock(new Composer(soundscape, mood, seed));

/** Silences between phrases: from each phrase's final release to the next phrase's first note. */
function phraseGaps(cues: Cue[]): number[] {
  const lead = cues.filter(c => (c.kind === 'note' || c.kind === 'rest') && c.part === 'lead');
  return lead.flatMap((c, i) => {
    const next = lead[i + 1];
    return c.kind === 'rest' && !c.breath && next?.kind === 'note' ? [next.at - c.at] : [];
  });
}

describe('lookahead scheduling', () => {
  it('pops exactly the cues inside the window, in time order', () => {
    const q = new CueQueue<{ at: number; id: string }>();
    for (const [at, id] of [[0.3, 'c'], [0.1, 'a'], [0.3, 'd'], [0.2, 'b'], [0.9, 'e']] as const) q.push({ at, id });
    expect(q.take(0.25).map(c => c.id)).toEqual(['a', 'b']);
    expect(q.take(0.25)).toEqual([]);
    expect(q.take(0.5).map(c => c.id)).toEqual(['c', 'd']); // equal times keep insertion order
    expect(q.size).toBe(1);
    q.clear();
    expect(q.take(10)).toEqual([]);
  });

  it('cuts what follows a moment, keeping the cues asked for', () => {
    const q = new CueQueue<{ at: number; id: string }>();
    for (const [at, id] of [[0.1, 'a'], [0.5, 'keep'], [0.6, 'b'], [0.2, 'c']] as const) q.push({ at, id });
    q.cut(0.3, c => c.id === 'keep');
    expect(q.take(10).map(c => c.id)).toEqual(['a', 'c', 'keep']);
  });

  it('beats the heart at the given rate, keeping phase when it changes and skipping missed beats', () => {
    const m = new Metronome();
    m.set(60, 0);
    expect(m.due(0, 2.05)).toEqual([0.1, 1.1, 2.1].filter(t => t < 2.05));
    m.set(120, 2);
    expect(m.due(2, 3.2)).toEqual([2.1, 2.6, 3.1]);
    expect(m.due(10, 10.3).length).toBe(1); // the timer slept: no burst of stale beats
    m.set(null, 11);
    expect(m.due(11, 20)).toEqual([]);
  });
});

describe('composer', () => {
  it('never stops: phrase after phrase, 1.5–4 s apart, longer when calm, longer still in Hell', () => {
    const gaps = (mood: MusicMood) => phraseGaps(start('gregorianski', mood).run(240));
    const calm = gaps({ ...EARTH, intensity: 0 });
    const intense = gaps({ ...EARTH, intensity: 1 });
    expect(calm.length).toBeGreaterThan(8);
    for (const g of [...calm, ...intense]) {
      expect(g).toBeGreaterThanOrEqual(1.5 - 1e-9);
      expect(g).toBeLessThanOrEqual(4 + 1e-9);
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(calm)).toBeGreaterThan(mean(intense) + 1);
    expect(Math.min(...gaps({ ...EARTH, realm: 'hell' }))).toBeGreaterThanOrEqual(3);
  });

  it('Gregorian: a unison schola, joined by organum a fourth/fifth below at high intensity (Heaven: the octave above)', () => {
    const lowAgainstLead = (mood: MusicMood) => {
      const cues = start('gregorianski', mood).run(60);
      const lead = new Map(notes(cues, 'lead').map(n => [n.at, n.midi]));
      return notes(cues, 'low').map(n => lead.get(n.at)! - n.midi);
    };
    expect(lowAgainstLead({ ...EARTH, intensity: 0.3 })).toEqual([]);
    const organum = lowAgainstLead({ ...EARTH, intensity: 0.8 });
    expect(organum.length).toBeGreaterThan(20);
    expect(new Set(organum)).toEqual(new Set([5, 7]));
    expect(new Set(lowAgainstLead({ ...EARTH, realm: 'heaven', intensity: 0.8 }))).toEqual(new Set([-12]));
    expect(new Set(notes(start('gregorianski').run(30), 'lead').map(n => n.voices))).toEqual(new Set([3]));
  });

  it('Byzantine: an ornamented melody over an ison that holds the final, re-taking breath now and then', () => {
    const cues = start('bizantyjski', chantMood({ mode: 5, intensity: 0.5, realm: 'earth' })).run(120);
    const ison = notes(cues, 'low');
    expect(new Set(ison.map(n => n.midi))).toEqual(new Set([53])); // F3, the final of mode 5
    expect(ison.every(n => n.vowel === 'o' && n.level >= 0.6)).toBe(true);
    const sounding = ison.reduce((sum, n) => sum + n.dur, 0);
    expect(sounding / 120).toBeGreaterThan(0.9);
    expect(cues.some(c => c.kind === 'rest' && c.part === 'low' && c.breath)).toBe(true);
    const melisma = (c: Cue[]) => notes(c, 'lead').filter(n => n.tie).length / notes(c, 'lead').length;
    expect(melisma(cues)).toBeGreaterThan(2 * melisma(start('gregorianski', chantMood({ mode: 5, intensity: 0.5, realm: 'earth' })).run(120)));
  });

  it('bells: change ringing tuned to the mode, over a soft drone on the final', () => {
    const cues = start('dzwony', chantMood({ mode: 7, intensity: 0.5, realm: 'earth' }), 3).run(300);
    const bells = cues.filter(c => c.kind === 'bell');
    expect(bells.length).toBeGreaterThan(60);
    expect(bells.every(b => isInMode(b.midi, 7) && b.level > 0 && b.level <= 1 && Math.abs(b.pan) <= 0.5)).toBe(true);
    expect(Math.min(...bells.map(b => b.midi))).toBe(67); // the tenor bell: G4
    const drone = notes(cues, 'low');
    expect(new Set(drone.map(n => pc(n.midi)))).toEqual(new Set([7]));
    expect(drone.every(n => n.level <= 0.25)).toBe(true);
    expect(notes(cues, 'lead')).toEqual([]);
  });

  it('a soundscape change releases the music and starts the new one after the crossfade', () => {
    const clock = start('gregorianski');
    // switch just after a note that begins at the very edge of what is already scheduled
    let last: NoteCue | undefined;
    for (let tick = 0; !last || last.at < clock.edge - 0.01; tick++) {
      expect(tick).toBeLessThan(5000);
      last = notes(clock.run(TICK_MS / 1000), 'lead').at(-1);
    }
    const edge = clock.edge;
    clock.composer.setSoundscape('dzwony');
    const cues = clock.run(30);
    const [lead, low, next] = cues;
    for (const rest of [lead, low]) {
      expect(rest.kind).toBe('rest');
      expect(rest.at).toBeGreaterThan(last.at + 0.01); // after that note's articulation …
      expect(rest.at - edge).toBeLessThan(0.1); // … but straight away
    }
    expect(next.at).toBeGreaterThanOrEqual(lead.at + CROSSFADE - 1e-9);
    expect(cues.some(c => c.kind === 'bell')).toBe(true);
    expect(notes(cues, 'lead')).toEqual([]);
  });

  it('silence (cisza) stops the music until another soundscape is chosen', () => {
    const clock = start('gregorianski');
    clock.run(10);
    clock.composer.setSoundscape('cisza');
    expect(clock.run(60).every(c => c.kind === 'rest')).toBe(true);
    clock.composer.setSoundscape('gregorianski');
    expect(notes(clock.run(10), 'lead').length).toBeGreaterThan(5);
  });

  it('a mood change waits for the phrase in progress', () => {
    const clock = start('gregorianski', chantMood({ mode: 1, intensity: 0.4, realm: 'earth' }));
    let cues = clock.run(2); // the first phrase has begun
    clock.composer.setMood(chantMood({ mode: 3, intensity: 0.4, realm: 'earth' }));
    cues = [...cues, ...clock.run(40)];
    const endings = cues.flatMap((c, i) => (c.kind === 'rest' && c.part === 'lead' && !c.breath ? [notes(cues.slice(0, i), 'lead').at(-1)!.midi] : []));
    expect(pc(endings[0])).toBe(2); // the phrase in progress still ends on D …
    expect(endings.slice(1).every(m => pc(m) === 4)).toBe(true); // … the next ones on E
  });

  it('the invocation: a deep bell, three slow phrases in mode 8, then the soundscape again', () => {
    const clock = start('gregorianski', chantMood({ mode: 3, intensity: 0.9, realm: 'earth' }));
    clock.run(5);
    clock.composer.invocation();
    const cues = clock.run(90);
    const first = cues.find(c => c.kind !== 'rest')!;
    expect(first).toMatchObject({ kind: 'bell', midi: 55 });
    const hymn = cues.filter(c => c.at < cues.filter(x => x.kind === 'rest' && x.part === 'lead' && !x.breath)[3].at + 0.01);
    const endings = hymn.flatMap((c, i) => (c.kind === 'rest' && c.part === 'lead' && !c.breath && i > 2 ? [notes(hymn.slice(0, i), 'lead').at(-1)!] : []));
    expect(endings.map(n => pc(n.midi))).toEqual([7, 7, 7]); // each phrase closes on G
    expect(notes(hymn, 'lead').every(n => isInMode(n.midi, 8) && n.voices === 3)).toBe(true);
    const later = notes(cues, 'lead').filter(n => n.at > endings[2].at + 1);
    expect(later.length).toBeGreaterThan(10); // the soundscape resumes …
    expect(pc(later.at(-1)!.midi)).not.toBe(7); // … in its own mode (3, final E)
  });
});

describe('bells', () => {
  it('has the partials of a tuned church bell: hum, prime, minor third, fifth, nominal', () => {
    const ratios = BELL_PARTIALS.map(([r]) => r);
    expect(ratios.slice(0, 5)).toEqual([0.5, 1, 1.2, 1.5, 2]);
    expect(ratios[2]).toBeCloseTo(2 ** (3 / 12), 1); // the tierce: a minor third above the prime
    expect(ratios.every((r, i) => i === 0 || r > ratios[i - 1])).toBe(true);
    const taus = BELL_PARTIALS.map(([, , tau]) => tau);
    expect(taus.every((t, i) => i === 0 || t < taus[i - 1])).toBe(true); // higher partials die sooner
  });

  it('renders a struck, decaying, click-free bell', () => {
    const bell = renderBell(8000, 6);
    const rms = (from: number, to: number) => Math.sqrt(bell.slice(from, to).reduce((s, x) => s + x * x, 0) / (to - from));
    expect(bell.every(Number.isFinite)).toBe(true);
    expect(Math.max(...bell.map(Math.abs))).toBeCloseTo(0.8, 5);
    expect(rms(40000, 48000)).toBeLessThan(rms(0, 8000) / 10);
    expect(Math.abs(bell[0])).toBeLessThan(0.01);
    expect(bell.at(-1)).toBeCloseTo(0, 6);
  });

  it('rings Plain Hunt: every row a permutation, each bell moving at most one place, back to rounds after 2n changes', () => {
    for (const n of [4, 5, 6]) {
      const rows = plainHunt(n);
      const rounds = Array.from({ length: n }, (_, i) => i);
      expect(rows).toHaveLength(2 * n);
      expect(rows.at(-1)).toEqual(rounds);
      expect(rows.slice(0, -1).some(r => r.join() === rounds.join())).toBe(false);
      [rounds, ...rows].forEach((row, i, all) => {
        expect([...row].sort()).toEqual(rounds);
        if (i > 0) for (const bell of rounds) expect(Math.abs(row.indexOf(bell) - all[i - 1].indexOf(bell))).toBeLessThanOrEqual(1);
      });
    }
  });
});

describe('cathedral reverb', () => {
  it('generates a stereo, decaying, decorrelated impulse response after a short pre-delay', () => {
    const rate = 8000;
    const [l, r] = impulseResponse(rate, 4.8, 4.4, 0.03);
    expect(l.length).toBe(4.8 * rate);
    expect(l.slice(0, 0.03 * rate).every(x => x === 0)).toBe(true);
    const energy = (x: Float32Array, a: number, b: number) => x.slice(a * rate, b * rate).reduce((s, v) => s + v * v, 0);
    expect(energy(l, 4.3, 4.8)).toBeLessThan(energy(l, 0.03, 0.53) / 1000);
    let lr = 0;
    for (let i = 0; i < l.length; i++) lr += l[i] * r[i];
    expect(Math.abs(lr) / Math.sqrt(energy(l, 0, 4.8) * energy(r, 0, 4.8))).toBeLessThan(0.3);
  });
});

describe('sound-effect gate', () => {
  const admitted = (name: SfxName, perSecond: number, gate = new SfxGate()) => {
    let n = 0;
    for (let i = 0; i < perSecond; i++) if (gate.admit(name, i / perSecond)) n++;
    return n;
  };

  it('rate-limits rapid fire: ≤ 8 shots, 15 seeds, 12 hits per second', () => {
    expect(admitted('shoot', 1000)).toBe(8);
    expect(admitted('seed', 1000)).toBe(15);
    expect(admitted('hit', 1000)).toBe(12);
    expect(admitted('levelup', 50)).toBe(50); // meaningful effects are never dropped
  });

  it('caps simultaneous minor effects but always lets the major ones through', () => {
    const gate = new SfxGate();
    let playing = 0;
    for (let i = 0; i < 10; i++) for (const name of ['digest', 'fragment'] as const) if (gate.admit(name, i * 0.1)) playing++;
    expect(playing).toBe(MAX_SFX_VOICES);
    expect(gate.admit('revelation', 0.95)).toBe(true);
    expect(gate.admit('click', 0.95)).toBe(false);
    expect(gate.admit('click', 10)).toBe(true); // once the others have finished
  });
});
