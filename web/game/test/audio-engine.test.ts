import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudio } from '../src/audio';
import { BELL_SAMPLE_RATE } from '../src/audio/bells';
import type { ChantMode, SfxName, SoundscapeId } from '../src/types';

const SFX: SfxName[] = [
  'eat', 'digest', 'shoot', 'hit', 'weaken', 'hurt', 'seed', 'grace', 'levelup', 'door',
  'fragment', 'boss', 'revelation', 'prayer_word', 'ultimate', 'bell', 'click', 'fall', 'rank',
];

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
  start(): void {
    if (this.started) throw new Error('started twice');
    this.started = true;
  }
  stop(): void {
    if (!this.started) throw new Error('stopped before start');
    this.stopped = true;
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
    audio.setMood({ mode: 4, intensity: 0.7, realm: 'hell' });
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
    for (const soundscape of ['gregorianski', 'bizantyjski', 'dzwony', 'cisza', 'gregorianski'] as SoundscapeId[]) {
      audio.setSoundscape(soundscape);
      audio.setMood({ mode: 6, intensity: soundscape === 'dzwony' ? 0.8 : 0.9, realm: 'heaven' });
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
        audio.setMood({ mode: modes[k], intensity: k / 7, realm: (['earth', 'heaven', 'hell'] as const)[k % 3] });
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
});
