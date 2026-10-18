import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudio, DEFAULT_VOLUMES } from '../src/audio';
import { BELL_SAMPLE_RATE } from '../src/audio/bells';
import { INSTRUMENT_RATE } from '../src/audio/instruments';
import { BufferBank, MAX_VOICES, VoicePool } from '../src/audio/pool';
import { LOOKAHEAD } from '../src/audio/scheduler';
import { darkScale, finalPc, modeScale, PRESETS } from '../src/audio/psalm';
import type { ChantMode, MusicMood, SfxName, SoundscapeId } from '../src/types';

const SFX: SfxName[] = [
  'eat', 'digest', 'shoot', 'hit', 'weaken', 'hurt', 'seed', 'grace', 'levelup', 'door',
  'fragment', 'boss', 'revelation', 'prayer_word', 'ultimate', 'bell', 'click', 'fall', 'rank',
  'fire', 'flame', 'tier', 'combo',
];

/** A mood for the chant soundscapes (they ignore track and scene). */
const chant = (mode: ChantMode, intensity: number, realm: MusicMood['realm']): MusicMood => ({ mode, intensity, realm, track: 'malkut', scene: 'battle' });

// ─── A minimal stand-in for Web Audio: records nodes, connections and automation, ───
// ─── and throws where a browser would (bad times, ramps to zero, double starts).   ───

class FakeParam {
  events = 0;
  /** where the automation ends up: the value of the latest event (at equal times, the later call) */
  final: number;
  private latest = -Infinity;
  private current: number;
  constructor(value = 0) {
    this.current = this.final = value;
  }
  get value(): number {
    return this.current;
  }
  set value(v: number) {
    this.current = v;
    if (this.events === 0) this.final = v;
  }
  private record(time: number, ...values: number[]): this {
    if (!Number.isFinite(time) || time < 0 || !values.every(Number.isFinite)) throw new RangeError(`bad automation at ${time}`);
    this.events++;
    if (time >= this.latest) [this.latest, this.final] = [time, values[0]];
    return this;
  }
  setValueAtTime(v: number, t: number) { return this.record(t, v); }
  linearRampToValueAtTime(v: number, t: number) { return this.record(t, v); }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (!(v > 0)) throw new RangeError('exponential ramp to zero');
    return this.record(t, v);
  }
  setTargetAtTime(v: number, t: number, tau: number) {
    if (!(tau > 0)) throw new RangeError('time constant must be positive');
    return this.record(t, v);
  }
}

class FakeNode {
  readonly outputs = new Set<FakeNode | FakeParam>();
  constructor(ctx: FakeContext) { ctx.nodes.push(this); }
  connect<T extends FakeNode | FakeParam>(dest: T): T { this.outputs.add(dest); return dest; }
  disconnect(): void { this.outputs.clear(); }
}

class FakeSource extends FakeNode {
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  startAt = 0;
  /** the earliest stop asked for */
  stopAt = Infinity;
  start(when = 0): void {
    if (this.started) throw new Error('started twice');
    if (!Number.isFinite(when) || when < 0) throw new RangeError('bad start time');
    this.started = true;
    this.startAt = when;
  }
  stop(when = 0): void {
    if (!this.started) throw new Error('stopped before start');
    this.stopped = true;
    this.stopAt = Math.min(this.stopAt, when);
  }
}
class FakeOscillator extends FakeSource { type = 'sine'; frequency = new FakeParam(440); detune = new FakeParam(); }
class FakeBufferSource extends FakeSource { buffer: FakeBuffer | null = null; loop = false; playbackRate = new FakeParam(1); }
class FakeGain extends FakeNode { gain = new FakeParam(1); }
class FakeBiquad extends FakeNode { type = 'lowpass'; frequency = new FakeParam(350); Q = new FakeParam(1); }
class FakePanner extends FakeNode { pan = new FakeParam(); }
class FakeConvolver extends FakeNode { buffer: FakeBuffer | null = null; }
class FakeCompressor extends FakeNode {
  threshold = new FakeParam(); knee = new FakeParam(); ratio = new FakeParam(); attack = new FakeParam(); release = new FakeParam();
}
class FakeBuffer {
  private readonly channels: Float32Array[];
  constructor(count: number, readonly length: number, readonly sampleRate: number) {
    this.channels = Array.from({ length: count }, () => new Float32Array(length));
  }
  get duration(): number { return this.length / this.sampleRate; }
  getChannelData(i: number): Float32Array { return this.channels[i]; }
}

class FakeContext {
  static last: FakeContext;
  currentTime = 0;
  readonly sampleRate = 8000;
  state: AudioContextState = 'suspended';
  readonly nodes: FakeNode[] = [];
  readonly destination: FakeNode = new FakeNode(this);
  constructor() { FakeContext.last = this; }
  createGain() { return new FakeGain(this); }
  createOscillator() { return new FakeOscillator(this); }
  createBufferSource() { return new FakeBufferSource(this); }
  createBiquadFilter() { return new FakeBiquad(this); }
  createStereoPanner() { return new FakePanner(this); }
  createConvolver() { return new FakeConvolver(this); }
  createDynamicsCompressor() { return new FakeCompressor(this); }
  createBuffer(count: number, length: number, rate: number) { return new FakeBuffer(count, length, rate); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  oscillators(): FakeOscillator[] { return this.nodes.filter(n => n instanceof FakeOscillator); }
}

/** Lets audio time and the scheduler's timer run together. */
function advance(ctx: FakeContext, seconds: number): void {
  for (let t = 0; t < seconds; t += 0.05) {
    ctx.currentTime += 0.05;
    vi.advanceTimersByTime(50);
  }
}

async function unlockedAudio(before?: (audio: ReturnType<typeof createAudio>) => void) {
  vi.useFakeTimers();
  vi.setSystemTime(0); // the engine seeds its randomness from the clock
  vi.stubGlobal('AudioContext', FakeContext);
  const audio = createAudio();
  before?.(audio);
  await audio.unlock();
  return { audio, ctx: FakeContext.last };
}

/** A soundtrack mood for a track of the table. */
const track = (id: string, intensity: number, scene: MusicMood['scene']): MusicMood => ({ mode: PRESETS[id].mode, realm: PRESETS[id].realm, intensity, track: id, scene });

/** The soundtrack's rendered notes (not the bells, the breath or the effects' noise). */
const voices = (ctx: FakeContext): FakeBufferSource[] =>
  ctx.nodes.filter((n): n is FakeBufferSource => n instanceof FakeBufferSource && n.buffer?.sampleRate === INSTRUMENT_RATE && n.buffer.length !== 6 * BELL_SAMPLE_RATE);
/** When a voice falls silent: its stop, or the end of a buffer that does not loop. */
const endOf = (v: FakeBufferSource): number => Math.min(v.stopAt, v.loop ? Infinity : v.startAt + v.buffer!.duration / v.playbackRate.value);

/** The two choir sections' envelopes and the breath: the gains feeding "music in". */
function choirEnvelopes(ctx: FakeContext): FakeGain[] {
  const gains = ctx.nodes.filter((n): n is FakeGain => n instanceof FakeGain);
  const tone = ctx.nodes.find(n => n instanceof FakeBiquad && [...n.outputs].some(o => o instanceof FakeGain && o.outputs.size === 2))!;
  const musicIn = gains.find(g => g.outputs.has(tone))!;
  return gains.filter(g => g.outputs.has(musicIn));
}

describe('audio engine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('works in Node without Web Audio: every method is a safe no-op before unlock', async () => {
    expect(typeof AudioContext).toBe('undefined');
    const audio = createAudio();
    expect(audio.unlocked).toBe(false);
    audio.setSoundscape('bizantyjski');
    audio.setMood(chant(4, 0.7, 'hell'));
    audio.playInvocation();
    for (const name of SFX) audio.sfx(name, { pan: -1, pitch: 2, volume: 0.5 });
    audio.setVolumes({ master: 0.5, music: Number.NaN, sfx: 2 });
    audio.setMuted(true);
    audio.setHeartRate(72);
    audio.setHeartRate(null);
    audio.suspend();
    audio.resume();
    await audio.unlock();
    expect(audio.unlocked).toBe(false);
  });

  it('builds the graph on unlock; the choir keeps ≤ 12 oscillators, never creating any per note', async () => {
    const { audio, ctx } = await unlockedAudio(a => a.setHeartRate(64));
    expect(audio.unlocked).toBe(true);
    expect(ctx.state).toBe('running');
    const oscillators = ctx.oscillators().length;
    expect(oscillators).toBeLessThanOrEqual(12);
    for (const soundscape of ['gregorianski', 'bizantyjski', 'dzwony', 'psalm', 'cisza', 'gregorianski'] as SoundscapeId[]) {
      audio.setSoundscape(soundscape);
      audio.setMood(soundscape === 'psalm' ? { mode: 6, intensity: 0.9, realm: 'earth', track: 'gewura', scene: 'boss' } : chant(6, soundscape === 'dzwony' ? 0.8 : 0.9, 'heaven'));
      advance(ctx, 40);
    }
    audio.playInvocation();
    advance(ctx, 60);
    expect(ctx.oscillators()).toHaveLength(oscillators);
    expect(ctx.oscillators().every(o => o.started && !o.stopped)).toBe(true);
    const glides = ctx.oscillators().reduce((n, o) => n + o.frequency.events, 0);
    expect(glides).toBeGreaterThan(500); // it really sang
    const strikes = ctx.nodes.filter(n => n instanceof FakeBufferSource && n.buffer?.sampleRate === BELL_SAMPLE_RATE);
    expect(strikes.length).toBeGreaterThan(10); // and rang
  });

  it('releases every voice when the music stops: no stuck notes, whenever the switch comes', async () => {
    const { audio, ctx } = await unlockedAudio();
    const gains = ctx.nodes.filter(n => n instanceof FakeGain);
    // music in → tone (low-pass) → music volume, which splits into dry and wet
    const tone = ctx.nodes.find(n => n instanceof FakeBiquad && [...n.outputs].some(o => o instanceof FakeGain && o.outputs.size === 2))!;
    const musicIn = gains.find(g => g.outputs.has(tone))!;
    const envelopes = gains.filter(g => g.outputs.has(musicIn)); // the two choir sections and the breath
    expect(envelopes.length).toBe(3);
    const modes: ChantMode[] = [1, 2, 3, 4, 5, 6, 7, 8];
    for (const soundscape of ['gregorianski', 'bizantyjski', 'dzwony', 'invocation'] as const) {
      for (let k = 0; k < 8; k++) {
        audio.setMood(chant(modes[k], k / 7, (['earth', 'heaven', 'hell'] as const)[k % 3]));
        if (soundscape === 'invocation') {
          audio.setSoundscape('gregorianski');
          audio.playInvocation();
        } else {
          audio.setSoundscape(soundscape);
        }
        advance(ctx, 2 + ((k * 7) % 11) * 0.37); // vary the moment of the switch
        audio.setSoundscape('cisza');
        advance(ctx, 4);
        expect(envelopes.map(e => e.gain.final), `${soundscape} #${k}`).toEqual([0, 0, 0]);
      }
    }
  });

  it('plays every effect on its own short-lived nodes, all disconnected once they end', async () => {
    const { audio, ctx } = await unlockedAudio();
    for (const name of SFX) {
      ctx.currentTime += 1;
      const before = ctx.nodes.length;
      audio.sfx(name, { pan: 0.5, pitch: 1.2, volume: 0.8 });
      const fresh = ctx.nodes.slice(before);
      const sources = fresh.filter(n => n instanceof FakeSource);
      expect(sources.length, name).toBeGreaterThan(0);
      expect(sources.every(s => s.started && s.stopped), name).toBe(true);
      for (const s of sources) s.onended?.();
      expect(fresh.every(n => n.outputs.size === 0), name).toBe(true);
    }
  });

  it('rate-limits rapid fire and stays silent while suspended', async () => {
    const { audio, ctx } = await unlockedAudio();
    const sources = () => ctx.nodes.filter(n => n instanceof FakeSource).length;
    let before = sources();
    for (let i = 0; i < 10; i++) audio.sfx('shoot');
    expect(sources() - before).toBe(2); // one shot: its noise burst and its pluck
    audio.suspend();
    expect(ctx.state).toBe('suspended');
    before = sources();
    ctx.currentTime += 1;
    audio.sfx('bell');
    expect(sources()).toBe(before);
    audio.resume();
    await Promise.resolve();
    expect(ctx.state).toBe('running');
  });

  it('ramps volumes and mute smoothly on the master bus', async () => {
    const { audio, ctx } = await unlockedAudio();
    const master = ctx.nodes.find((n): n is FakeGain => n instanceof FakeGain && [...n.outputs].some(o => o instanceof FakeCompressor))!;
    const events = master.gain.events;
    audio.setMuted(true);
    audio.setVolumes({ master: 0.4, music: 0.6, sfx: 0.9 });
    expect(master.gain.events).toBe(events + 2);
  });

  it('starts with the soundtrack at quiet default volumes, with no oscillator per note', async () => {
    expect(DEFAULT_VOLUMES).toEqual({ master: 0.7, music: 0.4, sfx: 0.7 });
    const { audio, ctx } = await unlockedAudio();
    const master = ctx.nodes.find((n): n is FakeGain => n instanceof FakeGain && [...n.outputs].some(o => o instanceof FakeCompressor))!;
    expect(master.gain.final).toBeCloseTo(0.7, 9);
    expect(audio.nowPlaying).toBe('Drzewo Życia · wariacja 1');
    const oscillators = ctx.oscillators().length;
    advance(ctx, 20);
    expect(voices(ctx).length).toBeGreaterThan(10); // the menu's harp and drone
    expect(ctx.oscillators()).toHaveLength(oscillators);
  });

  it('composes but neither renders nor plays the soundtrack while the music is silent, and picks it up again', async () => {
    const { audio, ctx } = await unlockedAudio(a => a.setMood(track('jesod', 0.7, 'battle')));
    advance(ctx, 5);
    audio.setVolumes({ master: 0.7, music: 0, sfx: 0.7 });
    const before = voices(ctx).length;
    advance(ctx, 20);
    const during = voices(ctx).filter(v => v.startAt > ctx.currentTime - 19);
    expect(during.filter(v => !v.loop)).toHaveLength(0);   // no one-shot notes at all (held drones may stay)
    audio.setVolumes({ master: 0.7, music: 0.4, sfx: 0.7 });
    advance(ctx, 10);
    expect(voices(ctx).length).toBeGreaterThan(before + 10);
    audio.sfx('seed');                                     // effects play on regardless
  });

  it('caps the soundtrack at MAX_VOICES voices, stealing the least important, and disconnects every voice when it ends', async () => {
    const { audio, ctx } = await unlockedAudio(a => a.setMood(track('tiferet', 1, 'boss')));
    advance(ctx, 50);
    audio.setMood(track('necach', 0.8, 'battle'));
    advance(ctx, 30);
    const all = voices(ctx);
    expect(all.length).toBeGreaterThan(500);
    expect(MAX_VOICES).toBe(24);
    let busiest = 0;
    for (const v of all) {
      // voices sounding when this one starts, not counting those already fading out (stolen or released)
      busiest = Math.max(busiest, all.filter(u => u.startAt <= v.startAt && endOf(u) > v.startAt + 0.1).length);
    }
    expect(busiest).toBeLessThanOrEqual(MAX_VOICES);
    expect(busiest).toBeGreaterThan(MAX_VOICES / 2); // it really was busy
    const envelopes = all.map(v => [...v.outputs][0] as FakeGain);
    expect(envelopes.every(e => e instanceof FakeGain && e.outputs.size === 1)).toBe(true);
    for (const v of all) v.onended?.();
    expect(all.every(v => v.outputs.size === 0)).toBe(true);
    expect(envelopes.every(e => e.outputs.size === 0)).toBe(true);
  });

  it('leaves no note hanging when the soundscape changes or the audio is suspended', async () => {
    const { audio, ctx } = await unlockedAudio(a => a.setMood(track('malkut', 0.8, 'battle')));
    const held = (): FakeBufferSource[] => voices(ctx).filter(v => v.loop);
    for (const [k, leave] of (['soundscape', 'suspend', 'invocation', 'suspend', 'soundscape', 'suspend'] as const).entries()) {
      audio.setSoundscape('psalm');
      audio.resume();
      await Promise.resolve();
      advance(ctx, 20 + ((k * 7) % 11) * 0.37); // vary the moment within the bar
      expect(held().some(v => endOf(v) === Infinity), leave).toBe(true); // the drone is holding
      if (leave === 'soundscape') audio.setSoundscape('cisza');
      else if (leave === 'suspend') audio.suspend();
      else {
        audio.setSoundscape('gregorianski'); // the chant's invocation replaces the soundtrack
        audio.playInvocation();
      }
      const at = ctx.currentTime;
      advance(ctx, 2);
      // faded out (τ ≤ 0.3 s) right after what was already handed out, stopped once at −52 dB
      expect(held().every(v => endOf(v) < at + LOOKAHEAD + 0.05 + 6 * 0.3 + 1e-6), leave).toBe(true);
      expect(voices(ctx).every(v => endOf(v) < at + 2.5), leave).toBe(true);
      if (leave !== 'invocation') expect(choirEnvelopes(ctx).map(e => e.gain.final), leave).toEqual([0, 0, 0]);
    }
    // after a suspend the music picks up again from the next bar
    audio.setSoundscape('psalm');
    audio.resume();
    await Promise.resolve();
    const before = voices(ctx).length;
    advance(ctx, 8);
    expect(voices(ctx).length).toBeGreaterThan(before);
  });

  it('silences everything on suspend, even notes already scheduled ahead, wherever in the bar it comes', async () => {
    const { audio, ctx } = await unlockedAudio(a => a.setMood(track('menu', 0.12, 'menu'))); // the choir's pad changes chord every two bars
    const bar = (60 / PRESETS.menu.bpm) * 3;
    for (let k = 0; k < 16; k++) {
      audio.resume();
      await Promise.resolve();
      advance(ctx, 4 + (k * bar) / 8);
      audio.suspend();
      const at = ctx.currentTime;
      advance(ctx, 1);
      expect(choirEnvelopes(ctx).map(e => e.gain.final), `#${k}`).toEqual([0, 0, 0]);
      expect(voices(ctx).every(v => endOf(v) < at + LOOKAHEAD + 0.3), `#${k}`).toBe(true);
    }
  });

  it('tunes the melodic effects to the key of the music, whatever plays', async () => {
    const { audio, ctx } = await unlockedAudio(a => a.setMood(track('malkut', 0.5, 'battle')));
    advance(ctx, 2);
    const notesOf = (name: SfxName, step: number): number[] => {
      ctx.currentTime += 1; // past every rate limit
      const before = ctx.nodes.length;
      audio.sfx(name, { step });
      return ctx.nodes.slice(before).filter(n => n instanceof FakeOscillator).map(o => 69 + 12 * Math.log2(o.frequency.final / 440));
    };
    const check = (tonic: number, scale: readonly number[]): void => {
      for (const name of ['combo', 'digest', 'flame', 'tier', 'fire'] as const) {
        for (const step of [0, 1, 2, 3, 5, 9, 14]) {
          const notes = notesOf(name, step);
          expect(notes.length, name).toBeGreaterThan(0);
          for (const m of notes) {
            expect(Math.abs(m - Math.round(m)), name).toBeLessThan(1e-6);
            expect(scale, `${name} ${step}`).toContain((((Math.round(m) - tonic) % 12) + 12) % 12);
          }
        }
      }
    };
    check(PRESETS.malkut.mode === 1 ? 62 : 0, modeScale(1)); // Malkut: D Dorian
    const combo = [1, 2, 3, 4].map(step => notesOf('combo', step)[0]);
    combo.slice(1).forEach((m, i) => expect(m).toBeGreaterThan(combo[i]));
    audio.setMood(track('gewura', 1, 'boss'));
    advance(ctx, 6);
    check(65, darkScale(6)); // a boss fight: the darker scale on F
    audio.setSoundscape('gregorianski');
    audio.setMood({ mode: 3, intensity: 0.5, realm: 'earth', track: 'hod', scene: 'battle' });
    check(64, modeScale(3)); // chant: the mode on its final, E
    expect(finalPc(3)).toBe(4);
  });

  it('steals the least important, oldest voice when full, and holds and releases looping notes by name', () => {
    const ctx = new FakeContext();
    const pool = new VoicePool(ctx as unknown as BaseAudioContext, 4);
    const out = ctx.createGain() as unknown as AudioNode;
    const buffer = ctx.createBuffer(1, 22050, 22050) as unknown as AudioBuffer; // 1 s
    const sources = (): FakeBufferSource[] => ctx.nodes.filter((n): n is FakeBufferSource => n instanceof FakeBufferSource);
    pool.hold(buffer, out, 0, 'drone', 0.5, 0.2, 6);
    [[0.1, 1], [0.2, 4], [0.3, 1], [0.4, 2]].forEach(([at, rank]) => pool.play(buffer, out, at, { level: 0.5, rank }));
    expect(pool.stolen).toBe(1); // the fifth voice took the place of the oldest rank-1 one
    expect(sources()[1].stopAt).toBeCloseTo(0.4 + 6 * 0.015, 9);
    expect(pool.live(0.45)).toBe(4);
    pool.play(buffer, out, 0.5, { level: 0.5, rank: 3, dur: 0.2, release: 0.05 });
    expect(sources()[3].stopAt).toBeLessThan(1); // then the other rank-1 voice
    expect(sources()[5].stopAt).toBeCloseTo(0.5 + 0.2 + 6 * 0.05, 9); // a note cut short stops after its release
    expect(pool.live(2)).toBe(1); // only the drone rings on
    pool.hold(buffer, out, 2, 'drone', 0.3, 0.5, 6); // the same note: just a new level, no new voice
    expect(sources()).toHaveLength(6);
    expect(sources()[0].stopAt).toBe(Infinity);
    pool.release('drone', 3, 0.4);
    expect(sources()[0].stopAt).toBeCloseTo(3 + 6 * 0.4, 9);
    expect(pool.live(6)).toBe(0);
    pool.hold(buffer, out, 6, 'drone', 0.3, 0.5, 6);
    pool.stopAll(7, 0.1);
    expect(sources().at(-1)!.stopAt).toBeCloseTo(7 + 6 * 0.1, 9); // the one still holding fades and stops
    expect(pool.live(7.7)).toBe(0);
  });

  it('renders each note once, when first needed or a little ahead, forgetting the least recently used beyond its budget', () => {
    const ctx = new FakeContext();
    const bank = new BufferBank(ctx as unknown as BaseAudioContext, 1.2e6);
    const harp = bank.get('harp', 62);
    expect(bank.get('harp', 62)).toBe(harp); // cached by instrument and pitch
    expect(bank.get('tek', 30)).toBe(bank.get('tek', 90)); // unpitched: one buffer
    expect(bank.get('drone', 38, 'hell')).not.toBe(bank.get('drone', 38, 'heaven')); // the drone by realm, too
    expect(bank.renders).toBe(4);
    bank.prewarm([['flute', 67, 'earth'], ['flute', 69, 'earth'], ['harp', 62, 'earth'], ['bass', 40, 'earth']]);
    bank.warm(2);
    expect(bank.renders).toBe(6);
    expect(bank.has('flute', 69)).toBe(true);
    bank.warm(5); // the harp note was cached already: only the bass is left
    expect(bank.renders).toBe(7);
    // over budget (two 4 s drones are 0.7 MB, the rest ≈ 1 MB): the oldest went first
    expect(bank.has('harp', 62)).toBe(false);
    expect(bank.has('bass', 40)).toBe(true);
    expect(bank.size).toBeLessThan(7);
  });
});
