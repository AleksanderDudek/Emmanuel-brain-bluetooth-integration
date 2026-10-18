import { describe, expect, it } from 'vitest';
import { createAudio, DEFAULT_VOLUMES, normaliseMood } from '../src/audio';
import { layerTargets, palette, STING_SECONDS, type InstCue } from '../src/audio/arranger';
import { Composer, TRACK_WAIT, type Cue } from '../src/audio/composer';
import { DRONE_LOOP, INSTRUMENT_RATE, renderInstrument, type Inst } from '../src/audio/instruments';
import {
  ambitus, darkScale, degreeMidi, finalPc, FORM_SECONDS, makeForm, makeMotif, makePiece, METERS, modeScale, nowPlayingLabel, PRESETS, presetFor,
  vary, type MeterId,
} from '../src/audio/psalm';
import { Rng } from '../src/audio/rng';
import { LOOKAHEAD, TICK_MS } from '../src/audio/scheduler';
import { melodicNotes } from '../src/audio/sfx';
import type { ChantMode, MusicMood, MusicScene } from '../src/types';

/** The soundtrack as specified: track → [title, mode, realm]. */
const TABLE: Record<string, [string, ChantMode, MusicMood['realm']]> = {
  menu: ['Drzewo Życia', 8, 'heaven'],
  malkut: ['Malkut — Kołyska', 1, 'earth'],
  jesod: ['Jesod — Dom', 2, 'earth'],
  hod: ['Hod — Szkoła', 3, 'earth'],
  necach: ['Necach — Pierwsza miłość', 4, 'earth'],
  tiferet: ['Tiferet — Ambicja', 5, 'earth'],
  gewura: ['Gewura — Gniew', 6, 'earth'],
  chesed: ['Chesed — Upadek', 7, 'earth'],
  bina: ['Bina — Ciemna noc', 2, 'heaven'],
  chochma: ['Chochma — Pustynia', 8, 'heaven'],
  keter: ['Keter — Dom Ojca', 8, 'heaven'],
  rod: ['Ród — Drzewo rodu', 1, 'earth'],
  szeol: ['Szeol — Zstąpienie', 4, 'hell'],
};
const CHAPTERS = Object.keys(TABLE).filter(t => t !== 'menu');
const MODES: ChantMode[] = [1, 2, 3, 4, 5, 6, 7, 8];
const DRUMS: ReadonlySet<Inst> = new Set<Inst>(['doum', 'tek', 'ka', 'jingle', 'shake']);

const pc = (midi: number): number => ((midi % 12) + 12) % 12;
const moodOf = (track: string, intensity: number, scene: MusicScene): MusicMood => {
  const [, mode, realm] = TABLE[track];
  return { mode, realm, intensity, track, scene };
};
const insts = (cues: readonly Cue[]): InstCue[] => cues.filter((c): c is InstCue => c.kind === 'inst');

/** Drives a composer the way the engine's timer does. */
class Clock {
  now = 0;
  /** the end of the window handed out so far */
  edge = 0;

  constructor(readonly composer: Composer) {}

  run(seconds: number): Cue[] {
    const cues: Cue[] = [];
    for (const end = this.now + seconds; this.now < end; this.now += TICK_MS / 1000) {
      const until = this.now + LOOKAHEAD;
      for (const cue of this.composer.take(this.now, until)) {
        expect(cue.at).toBeLessThan(until);
        expect(cue.at).toBeGreaterThanOrEqual(this.edge - 1e-9); // never handed out late
        cues.push(cue);
      }
      this.edge = until;
    }
    return cues;
  }

  /** Length of a bar of the piece playing, s. */
  get bar(): number {
    const piece = this.composer.piece!;
    return piece.meter.steps * piece.step;
  }
}

const play = (track: string, intensity = 0.75, scene: MusicScene = 'battle', seed = 7, variations: Record<string, number> = {}): Clock =>
  new Clock(new Composer('psalm', moodOf(track, intensity, scene), seed, variations));

/** The bars start at 0.05 s (the first take) and follow each other without gaps. */
const nextBarLine = (clock: Clock, t: number): number => 0.05 + Math.ceil((t - 0.05) / clock.bar - 1e-9) * clock.bar;

describe('Psalm 150: the score', () => {
  it('has a piece for the menu and every chapter, titled, keyed and placed as specified', () => {
    expect(Object.keys(PRESETS).sort()).toEqual(Object.keys(TABLE).sort());
    for (const [track, [name, mode, realm]] of Object.entries(TABLE)) {
      const p = PRESETS[track];
      expect([p.name, p.mode, p.realm], track).toEqual([name, mode, realm]);
      expect(p.bpm).toBeGreaterThanOrEqual(66);
      expect(p.bpm).toBeLessThanOrEqual(135);
      expect(p.groove).toHaveLength(METERS[p.meter].steps);
      expect(p.alt).toHaveLength(METERS[p.meter].steps);
    }
    const meters = Object.values(PRESETS).map(p => p.meter);
    const odd = meters.filter(m => m === '7/8' || m === '7/8b' || m === '5/4').length;
    expect(odd).toBeGreaterThanOrEqual(1);
    expect(odd).toBeLessThanOrEqual(3);
    expect(meters).toContain('6/8');
    expect(meters).toContain('3/4');
    expect(new Set(Object.values(PRESETS).map(p => p.lead))).toEqual(new Set(['flute', 'harp']));
    expect(PRESETS.szeol.heartbeat).toBe(true);
  });

  it('gives every chapter its own piece: no two share tempo, meter and motif', () => {
    const pieces = CHAPTERS.map(t => makePiece(t, 0));
    pieces.forEach((a, i) => {
      for (const b of pieces.slice(i + 1)) {
        const same = a.preset.bpm === b.preset.bpm && a.preset.meter === b.preset.meter && JSON.stringify(a.motif) === JSON.stringify(b.motif);
        expect(same, `${a.track} = ${b.track}`).toBe(false);
      }
    });
    expect(new Set(CHAPTERS.map(t => PRESETS[t].bpm)).size).toBe(CHAPTERS.length); // in fact every tempo differs
  });

  it('gives an unknown track a stable piece of its own from its hash, in the mode and realm asked for', () => {
    const a = presetFor('nowy_rozdzial', 3, 'hell');
    expect(presetFor('nowy_rozdzial', 3, 'hell')).toEqual(a);
    expect([a.mode, a.realm]).toEqual([3, 'hell']);
    expect(a.groove).toHaveLength(METERS[a.meter].steps);
    expect(a.bpm).toBeGreaterThanOrEqual(70);
    expect(a.bpm).toBeLessThanOrEqual(135);
    const others = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6'].map(id => presetFor(id, 3));
    expect(new Set(others.map(p => `${p.bpm} ${p.meter}`)).size).toBeGreaterThan(3);
    expect(makePiece('nowy_rozdzial', 0, 3).scale).toEqual(modeScale(3));
    expect(presetFor('constructor').name).toBe('Psalm 150'); // not Object.prototype's
  });

  it('builds each mode on its final; the boss scale is a darker one on the same tonic', () => {
    expect(modeScale(1)).toEqual([0, 2, 3, 5, 7, 9, 10]); // Dorian on D
    expect(modeScale(3)).toEqual([0, 1, 3, 5, 7, 8, 10]); // Phrygian on E
    expect(modeScale(5)).toEqual([0, 2, 4, 6, 7, 9, 11]); // Lydian on F
    expect(modeScale(7)).toEqual([0, 2, 4, 5, 7, 9, 10]); // Mixolydian on G
    expect(modeScale(1, true)).toEqual([0, 2, 3, 5, 7, 8, 10]); // with B♭
    expect(MODES.map(finalPc)).toEqual([2, 2, 4, 4, 5, 5, 7, 7]);
    for (const mode of MODES) {
      const dark = darkScale(mode);
      expect(dark).not.toEqual(modeScale(mode));
      expect([dark[0], dark[4], dark.length]).toEqual([0, 7, 7]); // tonic and fifth kept
      expect(dark[2]).toBeLessThanOrEqual(modeScale(mode)[2] === 3 ? 4 : 3); // a minor third, or Hijaz's augmented second
    }
    expect([0, 7, -1, 9].map(d => degreeMidi(62, modeScale(1), d))).toEqual([62, 74, 60, 77]);
  });

  it('writes motifs that fill one bar, move mostly by step within the mode’s range, and close on a resting note', () => {
    for (const mode of MODES) {
      for (const meter of Object.keys(METERS) as MeterId[]) {
        for (let seed = 1; seed <= 6; seed++) {
          const m = makeMotif(new Rng(seed * 31 + mode), meter, mode);
          const [lo, hi] = ambitus(mode);
          expect(m.length).toBeGreaterThanOrEqual(2);
          m.forEach((n, i) => {
            expect(n.deg).toBeGreaterThanOrEqual(lo);
            expect(n.deg).toBeLessThanOrEqual(hi);
            expect(n.at + n.len).toBeLessThanOrEqual(METERS[meter].steps);
            if (i > 0) expect(n.at).toBe(m[i - 1].at + m[i - 1].len);
          });
          expect(m.at(-1)!.at + m.at(-1)!.len).toBe(METERS[meter].steps);
          expect(new Set(m.map(n => n.deg)).size).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('develops a motif: transposed, inverted, its pitches reversed, displaced, ornamented', () => {
    const m = [{ at: 0, len: 4, deg: 0, orn: 0 as const }, { at: 4, len: 4, deg: 2, orn: 0 as const }, { at: 8, len: 8, deg: 1, orn: 0 as const }];
    expect(vary(m, { k: 2 }, 16).map(n => n.deg)).toEqual([2, 4, 3]);
    expect(vary(m, { inv: true }, 16).map(n => n.deg)).toEqual([0, -2, -1]);
    expect(vary(m, { retro: true }, 16).map(n => n.deg)).toEqual([1, 2, 0]);
    const late = vary(m, { shift: 2 }, 16);
    expect(late.map(n => n.at)).toEqual([2, 6, 10]);
    expect(late.at(-1)!.at + late.at(-1)!.len).toBe(16);
    expect(vary(m, { orn: true }, 16).filter(n => n.orn > 0).length).toBeGreaterThanOrEqual(2);
    expect(m.map(n => n.deg)).toEqual([0, 2, 1]); // the original is left alone
  });

  it('arranges every piece in sections of 8 or 16 bars that last well over four minutes before the next round', () => {
    for (const track of Object.keys(PRESETS)) {
      for (const variation of [0, 1]) {
        const piece = makePiece(track, variation);
        const form = makeForm(piece, 0);
        const bar = piece.meter.steps * piece.step;
        expect(form.reduce((s, x) => s + x.bars.length * bar, 0)).toBeGreaterThanOrEqual(FORM_SECONDS);
        expect(FORM_SECONDS).toBeGreaterThan(240);
        expect(form[0].kind).toBe('intro');
        expect(new Set(form.map(x => x.kind)).size).toBeGreaterThanOrEqual(5);
        for (const section of form) {
          expect([8, 16]).toContain(section.bars.length);
          expect(section.bars.at(-1)!.fill).not.toBeNull(); // every section closes with a fill
          expect(section.groove).toHaveLength(piece.meter.steps);
        }
        const fills = form.flatMap(x => x.bars.flatMap(b => (b.fill ? [b.fill] : [])));
        fills.slice(1).forEach((f, i) => expect(f).not.toBe(fills[i])); // never the same fill twice running
        expect(makeForm(piece, 1)[0].kind).not.toBe('intro'); // a later round needs no intro
        expect(JSON.stringify(makeForm(piece, 1))).not.toBe(JSON.stringify(form));
      }
    }
  });

  it('labels what is playing in Polish', () => {
    expect(nowPlayingLabel('psalm', 'malkut', 1)).toBe('Malkut — Kołyska · wariacja 2');
    expect(nowPlayingLabel('psalm', 'menu', 0)).toBe('Drzewo Życia · wariacja 1');
    expect(nowPlayingLabel('psalm', 'nowy', 0)).toBe('Psalm 150 · wariacja 1');
    expect(nowPlayingLabel('gregorianski', 'malkut', 3)).toBe('Chorał gregoriański');
    expect(nowPlayingLabel('bizantyjski', 'malkut', 0)).toBe('Śpiew bizantyjski');
    expect(nowPlayingLabel('dzwony', 'malkut', 0)).toBe('Dzwony');
    expect(nowPlayingLabel('cisza', 'malkut', 0)).toBe('Cisza');
  });
});

describe('Psalm 150: playing', () => {
  it('is deterministic for a seed', () => {
    const a = play('hod').run(40);
    expect(play('hod').run(40)).toEqual(a);
    expect(play('hod', 0.75, 'battle', 8).run(40)).not.toEqual(a);
  });

  it('sets the layers by intensity and scene', () => {
    const p = PRESETS.jesod;
    const on = (scene: MusicScene, i: number): string[] => Object.entries(layerTargets(scene, i, p)).filter(([, v]) => v > 0).map(([k]) => k).sort();
    expect(on('battle', 0.1)).toEqual(['drone', 'harp', 'pad']);
    expect(on('battle', 0.4)).toEqual(['bass', 'drone', 'hand', 'harp']);
    expect(on('battle', 0.7)).toEqual(['bass', 'drone', 'groove', 'harp', 'lead']);
    expect(on('battle', 0.9)).toEqual(['bass', 'boss', 'drone', 'groove', 'harp', 'lead']);
    expect(on('boss', 0.5)).toEqual(on('battle', 0.9));
    expect(on('chapel', 0.9)).toEqual(['drone', 'harp', 'lead', 'pad']);
    expect(on('victory', 0.9)).toEqual(on('chapel', 0.9));
    expect(on('sabbath', 0.9)).toEqual(['drone', 'harp', 'pad']);
    expect(on('menu', 0.9)).toEqual(on('battle', 0.5));
    expect(layerTargets('sabbath', 0, p).harp).toBeLessThan(1); // the sparsest harp
  });

  it('never repeats an 8-bar block more than twice running, and keeps changing for over four minutes', () => {
    for (const [track, intensity, scene] of [['malkut', 0.75, 'battle'], ['gewura', 0.9, 'boss'], ['necach', 0.4, 'battle'], ['menu', 0.12, 'menu'], ['keter', 0.12, 'chapel']] as const) {
      const clock = play(track, intensity, scene);
      const cues = insts(clock.run(300));
      const { step } = clock.composer.piece!;
      const block = 8 * clock.bar;
      const blocks: string[] = [];
      for (let from = 0.05; from + block <= 300; from += block) {
        blocks.push(cues.filter(c => c.at >= from - 1e-6 && c.at < from + block - 1e-6).map(c => `${c.inst}:${c.midi}:${Math.round((c.at - from) / step)}`).sort().join());
      }
      for (let i = 2; i < blocks.length; i++) expect(blocks[i] === blocks[i - 1] && blocks[i] === blocks[i - 2], `${track} block ${i}`).toBe(false);
      const first = blocks.slice(0, Math.floor(240 / block));
      expect(new Set(first).size, track).toBeGreaterThanOrEqual(first.length - 1);
    }
  });

  it('brings layers in and out only at bar lines: in over two bars, out over one', () => {
    const clock = play('jesod', 0.1);
    let cues = insts(clock.run(26)); // past the 8-bar intro
    const loud = (c: InstCue): boolean => DRUMS.has(c.inst) || c.inst === 'bass' || c.inst === 'flute';
    expect(cues.filter(loud)).toEqual([]);
    clock.run(0.4); // somewhere inside a bar
    const change = nextBarLine(clock, clock.edge);
    clock.composer.setMood(moodOf('jesod', 0.8, 'battle'));
    cues = insts(clock.run(20));
    expect(cues.filter(c => loud(c) && c.at < change - 1e-6)).toEqual([]);
    const first = Math.min(...cues.filter(loud).map(c => c.at));
    expect(first - change).toBeGreaterThanOrEqual(-1e-6);
    expect(first - change).toBeLessThan(0.02); // the bass and the doum come in on the downbeat
    const bar = clock.bar;
    const mean = (k: number): number => {
      const hits = cues.filter(c => c.inst === 'doum' && c.at >= change + k * bar && c.at < change + (k + 1) * bar);
      return hits.reduce((s, c) => s + c.level, 0) / hits.length;
    };
    expect(mean(0)).toBeLessThan(0.8 * mean(2)); // a crescendo over the first bars
    // and out again: nothing loud after the bar that follows the change
    clock.run(0.3);
    const out = nextBarLine(clock, clock.edge);
    clock.composer.setMood(moodOf('jesod', 0.1, 'battle'));
    cues = insts(clock.run(20));
    expect(cues.filter(c => loud(c) && c.at >= out + bar - 1e-6)).toEqual([]);
    expect(cues.filter(c => loud(c) && c.at >= out - 1e-6).length).toBeGreaterThan(0); // the bar of the fade
  });

  it('plays the chapel and the Sabbath as calm variants: same key and motif, no drums, the Sabbath sparsest', () => {
    const piece = makePiece('malkut', 0);
    const variant = (scene: MusicScene): Cue[] => play('malkut', 0.12, scene).run(120);
    const chapel = variant('chapel');
    const sabbath = variant('sabbath');
    for (const cues of [chapel, sabbath]) {
      expect(insts(cues).filter(c => DRUMS.has(c.inst) || c.inst === 'shofar' || c.inst === 'stab' || c.inst === 'bass')).toEqual([]);
      expect(insts(cues).every(c => c.inst !== 'zil' || c.level < 0.35)).toBe(true);
      expect(cues.find(c => c.kind === 'hold')).toMatchObject({ midi: piece.tonic - 24 });
      for (const c of insts(cues).filter(n => n.inst === 'harp' || n.inst === 'flute')) expect(piece.scale).toContain(pc(c.midi - piece.tonic));
    }
    expect(insts(chapel).some(c => c.inst === 'flute')).toBe(true); // Malkut's flute still sings the motif
    expect(insts(sabbath).some(c => c.inst === 'flute')).toBe(false);
    expect(insts(sabbath).length).toBeLessThan(insts(chapel).length / 1.5);
  });

  it('makes a boss fight heavier: denser drums, shofar blasts, a darker scale on the same tonic', () => {
    const piece = makePiece('tiferet', 0);
    const battle = play('tiferet', 0.75, 'battle').run(90);
    const boss = play('tiferet', 0.75, 'boss').run(90);
    const after = (cues: Cue[]): InstCue[] => insts(cues).filter(c => c.at > 20); // past the intro
    const drums = (cues: Cue[]): number => after(cues).filter(c => DRUMS.has(c.inst)).length;
    expect(drums(boss)).toBeGreaterThan(1.3 * drums(battle));
    expect(insts(boss).some(c => c.inst === 'shofar')).toBe(true);
    expect(after(boss).filter(c => c.inst === 'stab').length).toBeGreaterThan(5);
    expect(insts(battle).some(c => c.inst === 'stab')).toBe(false);
    const melodic = after(boss).filter(c => c.inst === 'harp' || c.inst === 'flute').map(c => pc(c.midi - piece.tonic));
    for (const x of melodic) expect(piece.dark).toContain(x);
    expect(melodic.some(x => !piece.scale.includes(x))).toBe(true);
    const drone = (cues: Cue[]): number | undefined => cues.find(c => c.kind === 'hold')?.midi;
    expect(drone(boss)).toBe(drone(battle));
  });

  it('answers a victory with a 3–5 s fanfare of shofar and harp on the next beat, then the calm variant', () => {
    const clock = play('jesod', 0.75);
    clock.run(30.3);
    const edge = clock.edge;
    clock.composer.setMood(moodOf('jesod', 0.75, 'victory'));
    const cues = insts(clock.run(40));
    const start = cues.find(c => c.inst === 'stab')!.at;
    const piece = clock.composer.piece!;
    expect(start - edge).toBeLessThan(piece.step * piece.meter.sub + 0.03); // the next beat
    expect(STING_SECONDS).toBeGreaterThanOrEqual(3);
    expect(STING_SECONDS).toBeLessThanOrEqual(5);
    const sting = cues.filter(c => c.at >= start - 1e-6 && c.at < start + STING_SECONDS);
    expect(sting.some(c => c.inst === 'shofar')).toBe(true);
    expect(sting.filter(c => c.inst === 'harp').length).toBeGreaterThan(8);
    expect(sting.filter(c => c.inst === 'tek' || c.inst === 'ka' || c.inst === 'jingle')).toEqual([]); // the battle bar was cut
    const last = Math.max(...sting.map(c => c.at + (c.dur ?? 0)));
    expect(last - start).toBeGreaterThan(2.5);
    const later = cues.filter(c => c.at >= start + STING_SECONDS);
    expect(later.filter(c => DRUMS.has(c.inst) || c.inst === 'bass')).toEqual([]);
    expect(later.filter(c => c.inst === 'harp').length).toBeGreaterThan(5);
    clock.composer.setMood(moodOf('jesod', 0.5, 'victory')); // still the same victory: no second fanfare
    expect(insts(clock.run(20)).some(c => c.inst === 'stab')).toBe(false);
  });

  it('moves to a new chapter’s piece at the next bar line or within two seconds, crossfading; a scene change does not restart', () => {
    const clock = play('menu', 0.12, 'menu');
    clock.run(13.37);
    const menu = clock.composer.piece!;
    clock.composer.setMood(moodOf('menu', 0.4, 'menu'));
    expect(clock.composer.piece).toBe(menu);
    expect(clock.run(3).some(c => c.kind === 'release')).toBe(false);
    const edge = clock.edge;
    clock.composer.setMood(moodOf('hod', 0.7, 'battle'));
    const cues = clock.run(30);
    const release = cues.find(c => c.kind === 'release' && c.id === 'drone')!;
    expect(release.at - edge).toBeLessThanOrEqual(TRACK_WAIT + 0.05);
    expect(cues.find(c => c.kind === 'hold' && c.at >= release.at - 1e-6)).toMatchObject({ at: release.at, midi: 64 - 24 }); // Hod: E
    expect(cues.some(c => c.kind === 'rest' && Math.abs(c.at - release.at) < 1e-6)).toBe(true); // the choir's pad, too
    expect(insts(cues).filter(c => c.at > release.at + 0.01 && c.at < release.at + 2).every(c => c.inst !== 'harp' || piecePc(c.midi, 'hod'))).toBe(true);
    expect(clock.composer.piece!.track).toBe('hod');
  });

  it('lets no change of track undo the silencing of a soundscape change', () => {
    const clock = play('malkut', 0.8);
    clock.run(12);
    clock.composer.setSoundscape('gregorianski');
    clock.composer.setSoundscape('psalm'); // straight back: the stop must survive
    clock.composer.setMood(moodOf('gewura', 0.8, 'battle')); // and a new chapter in the same breath
    const cues = clock.run(10);
    const stop = cues.find(c => c.kind === 'stop');
    expect(stop).toBeDefined();
    expect(cues.filter(c => c.kind === 'rest' && c.at <= stop!.at + 1e-6).length).toBeGreaterThanOrEqual(2); // both choir parts
    const next = insts(cues)[0];
    expect(next.at).toBeGreaterThanOrEqual(stop!.at + 1.5); // the new piece after the crossfade
    expect(clock.composer.piece!.track).toBe('gewura');
  });

  it('follows the chapters while another soundscape plays, and comes back in the right piece without a stale fanfare', () => {
    const clock = play('menu', 0.12, 'menu');
    clock.run(8);
    clock.composer.setSoundscape('gregorianski');
    clock.run(5);
    clock.composer.setMood(moodOf('chesed', 0.75, 'battle'));
    clock.composer.setMood(moodOf('chesed', 0.75, 'victory')); // a victory while the chant sang
    clock.run(10);
    clock.composer.setSoundscape('psalm');
    const cues = clock.run(20);
    expect(clock.composer.piece!.track).toBe('chesed');
    expect(insts(cues).some(c => c.inst === 'stab')).toBe(false);
    expect(cues.find(c => c.kind === 'hold')).toMatchObject({ midi: 67 - 24 }); // Chesed: G
    const first = Math.min(...insts(cues).map(c => c.at));
    const harp = insts(cues).filter(c => c.inst === 'harp');
    expect(harp.filter(c => c.at < first + 2).every(c => c.level <= 0.5)).toBe(true); // ramping in again
  });

  it('moves to the next variation on "next track": same tempo, meter and key, another motif and arrangement', () => {
    for (const track of ['necach', 'menu', 'szeol']) {
      const variations: Record<string, number> = {};
      const clock = play(track, 0.75, 'battle', 7, variations);
      clock.run(20);
      const before = clock.composer.piece!;
      const edge = clock.edge;
      variations[track] = 1;
      clock.composer.nextTrack();
      const cues = clock.run(10);
      const after = clock.composer.piece!;
      expect(after.variation).toBe(1);
      expect([after.preset, after.step, after.meter, after.tonic, after.scale]).toEqual([before.preset, before.step, before.meter, before.tonic, before.scale]);
      expect(JSON.stringify(after.motif)).not.toBe(JSON.stringify(before.motif));
      expect(JSON.stringify(makeForm(after, 0))).not.toBe(JSON.stringify(makeForm(before, 0)));
      const release = cues.find(c => c.kind === 'release')!;
      expect(release.at - edge).toBeLessThanOrEqual(TRACK_WAIT + 0.05);
    }
    for (const track of Object.keys(PRESETS)) {
      expect(new Set([0, 1, 2, 3].map(v => JSON.stringify(makePiece(track, v).motif))).size, track).toBeGreaterThanOrEqual(3);
    }
  });

  it('plays a calm "Veni" in mode 8 for the invocation, then the piece from its intro', () => {
    const clock = play('malkut', 0.75);
    clock.run(5);
    clock.composer.invocation();
    const cues = clock.run(45);
    const stop = cues.find(c => c.kind === 'stop')!;
    expect(stop).toBeDefined(); // what was playing fades
    const hymnEnd = stop.at + 0.75 + 8 * 16 * (60 / 66 / 4);
    const hymn = insts(cues).filter(c => c.at < hymnEnd - 0.01);
    expect(hymn.some(c => c.inst === 'harp') && hymn.some(c => c.inst === 'flute')).toBe(true);
    expect(hymn.filter(c => DRUMS.has(c.inst))).toEqual([]);
    for (const c of hymn.filter(n => n.inst === 'harp' || n.inst === 'flute')) expect(modeScale(8)).toContain(pc(c.midi - 67));
    expect(cues.find(c => c.kind === 'hold')).toMatchObject({ midi: 55 }); // the drone on G (Heaven's, an octave up)
    expect(cues.some(c => c.kind === 'note')).toBe(true); // the choir's ooh
    expect(insts(cues).some(c => c.at > hymnEnd && c.inst === 'harp')).toBe(true); // then Malkut again
  });

  it('knows the key of what is playing, for the melodic effects', () => {
    const clock = play('tiferet', 0.75);
    clock.run(10);
    expect(clock.composer.key()).toEqual({ tonic: 65 + 12, scale: modeScale(5) });
    clock.composer.setMood(moodOf('tiferet', 0.95, 'boss'));
    clock.run(5);
    expect(clock.composer.key().scale).toEqual(darkScale(5));
    const chant = new Composer('gregorianski', { mode: 3, intensity: 0.5, realm: 'earth', track: 'hod', scene: 'battle' });
    expect(chant.key()).toEqual({ tonic: 76, scale: modeScale(3) }); // the mode on its final
  });

  it('lists the notes a piece needs, to render them ahead', () => {
    const piece = makePiece('chesed', 0);
    const notes = palette(piece, 'earth');
    expect(notes[0]).toEqual(['drone', piece.tonic - 24, 'earth']);
    expect(new Set(notes.map(n => n.join())).size).toBe(notes.length);
    expect(notes.length).toBeLessThan(70);
    const dark = palette(piece, 'earth', true);
    expect(dark.length).toBeGreaterThan(notes.length);
    expect(dark.slice(0, 10)).toEqual(notes.slice(0, 10)); // what comes first is the same
  });
});

/** Whether a MIDI note belongs to a track's scale. */
function piecePc(midi: number, track: string): boolean {
  const piece = makePiece(track, 0);
  return piece.scale.includes(pc(midi - piece.tonic));
}

describe('instruments', () => {
  const INSTS: Inst[] = ['harp', 'bass', 'flute', 'shofar', 'stab', 'doum', 'tek', 'ka', 'jingle', 'shake', 'zil', 'drone'];

  /** Fundamental frequency by autocorrelation around the expected period. */
  function pitchOf(x: Float32Array, hz: number, from: number, length: number): number {
    const period = INSTRUMENT_RATE / hz;
    const corr = (lag: number): number => {
      let s = 0;
      for (let i = from; i < from + length; i++) s += x[i] * x[i + lag];
      return s;
    };
    let best = 0;
    let lag = 0;
    for (let l = Math.floor(0.94 * period); l <= Math.ceil(1.06 * period); l++) {
      const c = corr(l);
      if (c > best) [best, lag] = [c, l];
    }
    const [a, b, c] = [corr(lag - 1), best, corr(lag + 1)];
    return INSTRUMENT_RATE / (lag + (0.5 * (a - c)) / (a - 2 * b + c));
  }

  it('renders clean notes: finite, normalised, silent at both ends (no clicks)', () => {
    for (const inst of INSTS) {
      for (const midi of [40, 62, 79]) {
        const x = renderInstrument(inst, midi);
        expect(x.every(Number.isFinite), inst).toBe(true);
        expect(Math.max(...x.map(Math.abs))).toBeCloseTo(0.9, 5);
        if (inst === 'drone') continue;
        expect(Math.abs(x[0]), inst).toBeLessThan(0.05);
        expect(Math.abs(x.at(-1)!), inst).toBeLessThan(1e-3);
        expect(x.length / INSTRUMENT_RATE).toBeLessThanOrEqual(2.6);
      }
    }
  });

  it('tunes the plucked strings, the flute and the drone to their notes', () => {
    for (const [inst, midi] of [['harp', 50], ['harp', 69], ['harp', 84], ['bass', 40], ['flute', 67], ['flute', 81], ['drone', 43]] as const) {
      const hz = 440 * 2 ** ((midi - 69) / 12);
      const x = renderInstrument(inst, midi);
      const found = pitchOf(x, hz, Math.round(0.3 * INSTRUMENT_RATE), 2048);
      expect(Math.abs(1200 * Math.log2(found / hz)), `${inst} ${midi}`).toBeLessThan(15); // cents
    }
  });

  it('loops the drone without a seam and gives Hell a darker one', () => {
    const d = renderInstrument('drone', 38);
    expect(d.length).toBe(DRONE_LOOP * INSTRUMENT_RATE);
    let step = 0;
    for (let i = 1; i < d.length; i++) step = Math.max(step, Math.abs(d[i] - d[i - 1]));
    expect(Math.abs(d[0] - d.at(-1)!)).toBeLessThanOrEqual(step); // the wrap is no bigger a step than any other
    const slope = (i: number): number => d[(i + 1) % d.length] - d[i];
    expect(Math.abs(slope(d.length - 1) - slope(d.length - 2))).toBeLessThan(0.01); // and keeps the waveform's slope
    const roughness = (x: Float32Array): number => {
      let s = 0;
      for (let i = 1; i < x.length; i++) s += Math.abs(x[i] - x[i - 1]);
      return s / x.length;
    };
    expect(roughness(renderInstrument('drone', 38, 'hell'))).toBeLessThan(roughness(renderInstrument('drone', 38, 'heaven')));
  });

  it('renders each note in a few milliseconds at most', () => {
    for (const inst of INSTS) renderInstrument(inst, 60); // warm up
    const t0 = performance.now();
    let n = 0;
    for (const inst of INSTS) for (const midi of [45, 57, 69, 81]) {
      renderInstrument(inst, midi);
      n++;
    }
    expect((performance.now() - t0) / n).toBeLessThan(5); // ≈ 0.1–0.7 ms on a laptop
  });
});

describe('melodic effects', () => {
  it('take every note from the key of the music, the combo climbing a scale step at a time', () => {
    for (const mode of MODES) {
      for (const scale of [modeScale(mode), darkScale(mode), modeScale(mode, true)]) {
        const key = { tonic: 72 + finalPc(mode), scale };
        for (const name of ['combo', 'digest', 'flame', 'tier', 'fire'] as const) {
          for (const step of [0, 1, 2, 3, 4, 5, 8, 13, 20, 40]) {
            for (const m of melodicNotes(name, step, key)) expect(scale, `${name} ${step}`).toContain(pc(m - key.tonic));
          }
        }
        const combo = Array.from({ length: 20 }, (_, i) => melodicNotes('combo', i + 1, key)[0]);
        expect(combo[0]).toBe(key.tonic - 12);
        combo.slice(1, 15).forEach((m, i) => expect(m).toBeGreaterThan(combo[i]));
        expect(Math.max(...combo) - combo[0]).toBeLessThanOrEqual(24);
        expect(melodicNotes('tier', 3, key)[0] - melodicNotes('tier', 1, key)[0]).toBe(12); // higher tiers sit higher
        expect([0, 1, 2, 3].map(step => melodicNotes('digest', step, key)[4])).toEqual([0, 2, 4, 0].map(d => degreeMidi(key.tonic, scale, d))); // chord tones in turn
        expect(melodicNotes('flame', 3, key)[0]).toBeGreaterThan(melodicNotes('flame', 1, key)[0]); // each flame a little higher
      }
    }
  });
});

describe('the audio facade', () => {
  it('starts with the soundtrack and quiet defaults, and labels what plays', () => {
    expect(DEFAULT_VOLUMES).toEqual({ master: 0.7, music: 0.4, sfx: 0.7 });
    const audio = createAudio();
    expect(audio.nowPlaying).toBe('Drzewo Życia · wariacja 1');
    audio.setMood(moodOf('malkut', 0.5, 'battle'));
    expect(audio.nowPlaying).toBe('Malkut — Kołyska · wariacja 1');
    audio.nextTrack();
    audio.nextTrack();
    expect(audio.nowPlaying).toBe('Malkut — Kołyska · wariacja 3');
    audio.setMood(moodOf('hod', 0.5, 'battle'));
    expect(audio.nowPlaying).toBe('Hod — Szkoła · wariacja 1');
    audio.setMood(moodOf('malkut', 0.5, 'chapel'));
    expect(audio.nowPlaying).toBe('Malkut — Kołyska · wariacja 3'); // each track remembers its variation
    audio.setSoundscape('gregorianski');
    expect(audio.nowPlaying).toBe('Chorał gregoriański');
    audio.nextTrack(); // chant: a new phrase, the soundtrack's variation untouched
    audio.setSoundscape('psalm');
    expect(audio.nowPlaying).toBe('Malkut — Kołyska · wariacja 3');
    for (const [id, label] of [['bizantyjski', 'Śpiew bizantyjski'], ['dzwony', 'Dzwony'], ['cisza', 'Cisza']] as const) {
      audio.setSoundscape(id);
      expect(audio.nowPlaying).toBe(label);
    }
  });

  it('accepts a mood without track or scene from an older caller', () => {
    const old = (m: Pick<MusicMood, 'mode' | 'intensity' | 'realm'>): MusicMood => normaliseMood(m as Partial<MusicMood>);
    expect(old({ mode: 8, intensity: 0.12, realm: 'heaven' })).toMatchObject({ track: 'menu', scene: 'menu' });
    expect(old({ mode: 4, intensity: 0.5, realm: 'hell' })).toMatchObject({ track: 'szeol', scene: 'battle' });
    expect(old({ mode: 3, intensity: 0.9, realm: 'earth' })).toMatchObject({ track: 'hod', scene: 'boss' });
    expect(old({ mode: 1, intensity: 0.05, realm: 'earth' })).toMatchObject({ track: 'malkut', scene: 'sabbath' });
    expect(normaliseMood({ mode: 9 as ChantMode, intensity: Number.NaN, realm: 'x' as MusicMood['realm'], track: 'bina', scene: 'x' as MusicScene }))
      .toEqual({ mode: 1, intensity: 0, realm: 'earth', track: 'bina', scene: 'sabbath' });
  });
});
