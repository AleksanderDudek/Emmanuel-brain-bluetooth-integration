/**
 * Background songs (src/arcade/kit/song.ts): the compact notation, the series' refrain, the
 * sing-along line, and the player's scheduling on a recording AudioContext.
 */
import { describe, expect, it } from 'vitest';
import type { ArcadeAudio } from '../src/arcade/kit/audio';
import {
  CHORUS_BEATS, MAJOR, SongPlayer, chords, degFreq, lineAt, melody, repeat, seriesChorus, shift, songProblems, steps, type Song,
} from '../src/arcade/kit/song';
import { LANGS } from '../src/i18n';

/** A Web Audio stand-in that records what is started (enough to test the scheduler). */
function fakeAudio() {
  const started: { type: string; f: number; t: number }[] = [];
  const noop = (..._a: unknown[]) => undefined;
  const param = () => ({ value: 0, v: undefined as number | undefined, setValueAtTime: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop, setTargetAtTime: noop, cancelScheduledValues: noop });
  const node = () => ({ connect(x: unknown) { return x; }, disconnect() {} });
  const ctx = {
    currentTime: 0, sampleRate: 48000, state: 'running',
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), type: '', frequency: param(), Q: param() }),
    createOscillator: () => {
      const o = { ...node(), type: 'sine', frequency: param(), detune: param(),
        start(t: number) { started.push({ type: o.type, f: o.frequency.v ?? 0, t }); }, stop() {} };
      o.frequency.setValueAtTime = (...a: unknown[]) => { o.frequency.v = a[0] as number; };
      return o;
    },
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => ({ ...node(), buffer: null, start(t: number) { started.push({ type: 'noise', f: 0, t }); }, stop() {} }),
  };
  const audio = { ctx, out: node() } as unknown as ArcadeAudio;
  return { audio, ctx, started };
}

const SONG: Song = {
  bpm: 120, beats: 8, root: 261.63, scale: MAJOR,
  parts: [{ voice: 'lead', layer: 0, notes: melody('0:1 2:1 4:2 -:1 7:1 4:2') }, { voice: 'kick', layer: 2, notes: steps('x.x.x.x.', 1) }],
  lines: [{ at: 0, text: 'one' }, { at: 4, text: 'two' }],
};

describe('kit/song', () => {
  it('reads the compact melody notation: degrees, rests, octaves, accents', () => {
    const n = melody('0:1 -:0.5 4^:0.5 3_!:2', 8);
    expect(n).toEqual([
      { at: 8, len: 1, deg: 0 },
      { at: 9.5, len: 0.5, deg: 4, oct: 1 },
      { at: 10, len: 2, deg: 3, oct: -1, vel: 1 },
    ]);
    expect(() => melody('0:1 x:2')).toThrow(/bad token/);
    expect(melody('-2:1')[0].deg).toBe(-2);
  });

  it('builds drum steps, repeats, chords and shifts', () => {
    expect(steps('x.X.', 0.5).map(n => [n.at, n.vel])).toEqual([[0, 0.7], [1, 1]]);
    expect(repeat([{ at: 0, len: 1, deg: 0 }], 3, 4).map(n => n.at)).toEqual([0, 4, 8]);
    expect(chords([0, 3], 4).map(n => [n.at, n.deg])).toEqual([[0, 0], [0, 2], [0, 4], [4, 3], [4, 5], [4, 7]]);
    expect(shift([{ at: 1, len: 1, deg: 0 }], 32)[0].at).toBe(33);
  });

  it('turns degrees into frequencies over octaves, up and down', () => {
    const s = { root: 220, scale: MAJOR };
    expect(degFreq(s, 0)).toBeCloseTo(220);
    expect(degFreq(s, 7)).toBeCloseTo(440);
    expect(degFreq(s, -7)).toBeCloseTo(110);
    expect(degFreq(s, 4)).toBeCloseTo(220 * 2 ** (7 / 12));
    expect(degFreq(s, 0, 1)).toBeCloseTo(440);
  });

  it('has the series refrain in four languages: eight bars, notes inside, four lines', () => {
    for (const l of LANGS) {
      const c = seriesChorus(16, l);
      expect(c.beats).toBe(CHORUS_BEATS);
      expect(c.lines).toHaveLength(4);
      expect(c.lines.map(x => x.at)).toEqual([16, 24, 32, 40]);
      for (const line of c.lines) expect(line.text.length).toBeGreaterThan(8);
      if (l !== 'pl') for (const line of c.lines) expect(line.text).not.toMatch(/[ąćęłńśźż]/i);
      const song: Song = { bpm: 96, beats: 48, root: 261.63, scale: MAJOR, parts: c.parts, lines: c.lines };
      expect(songProblems(song)).toEqual([]);
      // the tune fills the eight bars exactly
      const lead = c.parts.find(p => p.voice === 'lead')!.notes;
      const end = Math.max(...lead.map(n => n.at + n.len));
      expect(end).toBe(48);
    }
    expect(seriesChorus(0, 'pl').lines[0].text).toBe('Weź moc, obudź się,');
  });

  it('finds the problems a listener would hear', () => {
    const bad: Song = { ...SONG, beats: 4, lines: [{ at: 3, text: 'b' }, { at: 1, text: 'a' }] };
    const p = songProblems(bad);
    expect(p.some(x => x.includes('outside the loop'))).toBe(true);
    expect(p.some(x => x.includes('starts before'))).toBe(true);
    expect(songProblems(SONG)).toEqual([]);
  });

  it('shows the sing-along line with its progress, across the loop', () => {
    expect(lineAt(SONG, 0)).toEqual({ text: 'one', next: 'two', p: 0 });
    expect(lineAt(SONG, 2)!.p).toBeCloseTo(0.5);
    expect(lineAt(SONG, 5)!.text).toBe('two');
    expect(lineAt(SONG, 8 + 1)!.text).toBe('one');   // the second loop
    const late: Song = { ...SONG, lines: [{ at: 2, text: 'a' }, { at: 6, text: 'b' }] };
    expect(lineAt(late, 1)!.text).toBe('b');          // before the first line: the last one is still on
    expect(lineAt({ beats: 8, lines: [] }, 3)).toBeNull();
  });

  it('schedules the loop ahead on the audio clock, layer by layer, and stops cleanly', () => {
    const { audio, ctx, started } = fakeAudio();
    const player = new SongPlayer(audio, SONG);
    player.start();
    // 120 bpm: a beat is 0.5 s; the first pump covers the lookahead only
    const first = started.length;
    expect(first).toBeGreaterThan(0);
    for (let k = 0; k < 40; k++) {
      ctx.currentTime += 0.1;
      (player as unknown as { pump(): void }).pump();
    }
    // 4 s = one loop of 8 beats: the lead's 5 notes (two voices each) and the kick's 4 hits
    const leads = started.filter(s => s.type === 'triangle').length;
    expect(leads).toBeGreaterThanOrEqual(5);
    expect(started.filter(s => s.type === 'sine' && s.f === 120).length).toBeGreaterThanOrEqual(4);
    // every start lies on the beat grid (t0 + k × 0.25 s)
    for (const s of started) expect(Math.abs(((s.t - 0.12) / 0.25) - Math.round((s.t - 0.12) / 0.25))).toBeLessThan(1e-6);
    expect(player.beat).toBeGreaterThan(7);
    player.level(1);
    player.level(null);
    expect(player.currentLevel).toBe(1);
    player.stop();
    const after = started.length;
    ctx.currentTime += 2;
    (player as unknown as { pump(): void }).pump();
    expect(started.length).toBe(after);
    expect(player.line()).toBeNull();
  });

  it('is a quiet no-op without audio, and its beat still follows the clock', () => {
    const player = new SongPlayer({ ctx: null, out: null } as unknown as ArcadeAudio, SONG);
    player.start();
    expect(player.beat).toBeGreaterThanOrEqual(0);
    expect(player.line()?.text).toBe('one');
    player.level(0.8);
    player.stop();
  });
});
