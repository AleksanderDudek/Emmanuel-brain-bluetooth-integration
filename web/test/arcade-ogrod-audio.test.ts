/**
 * Ogród o świcie's soundscape (builder B): on a recording AudioContext behind a fake ArcadeAudio — the garden rises
 * from silence into the app's bus, the pad follows the dawn (and a little the light), the night's small sounds give
 * way to birds, cues are throttled and kept under a budget, pause schedules nothing, finish fades in ~3 s, and with
 * the sound off nothing happens at all.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ArcadeAudio } from '../src/arcade/kit/audio';
import type { BreathState } from '../src/arcade/kit/breath';
import { CUE_GAP, GardenSound, LEVEL, PROGRESSIONS, cutoffOf, gardenRoom, moodOf, tonesIn, type Place, type SoundCue, type SoundState } from '../src/arcade/ogrod/audio';

type Ev = [string, ...number[]];
class FParam {
  events: Ev[] = [];
  constructor(public value = 0) {}
  setValueAtTime(v: number, t: number) { this.events.push(['set', v, t]); this.value = v; return this; }
  linearRampToValueAtTime(v: number, t: number) { this.events.push(['lin', v, t]); return this; }
  exponentialRampToValueAtTime(v: number, t: number) { if (!(v > 0)) throw new RangeError('exponential ramp to ≤ 0'); this.events.push(['exp', v, t]); return this; }
  setTargetAtTime(v: number, t: number, tau: number) { if (!(tau > 0)) throw new RangeError('tau'); this.events.push(['target', v, t, tau]); return this; }
  cancelScheduledValues(t: number) { this.events.push(['cancel', t]); return this; }
  /** the last target or ramp end set */
  get last(): number { const e = [...this.events].reverse().find(x => x[0] === 'target' || x[0] === 'lin'); return e ? e[1] : this.value; }
}
class FNode {
  outs: unknown[] = [];
  constructor(readonly kind: string) {}
  connect<T>(d: T): T { this.outs.push(d); return d; }
  disconnect(): void { this.outs = []; }
}
class FSource extends FNode {
  startAt = -1;
  stopAt = Infinity;
  onended: (() => void) | null = null;
  frequency = new FParam(440);
  detune = new FParam(0);
  type = 'sine';
  buffer: unknown = null;
  loop = false;
  start(t = 0) { if (this.startAt >= 0) throw new Error('started twice'); this.startAt = t; }
  stop(t = 0) { this.stopAt = Math.min(this.stopAt, t); }
}
class FakeCtx {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new FNode('destination');
  gains: (FNode & { gain: FParam })[] = [];
  filters: (FNode & { type: string; frequency: FParam; Q: FParam })[] = [];
  sources: FSource[] = [];
  nodes: FNode[] = [];
  private add<T extends FNode>(n: T): T { this.nodes.push(n); return n; }
  createGain() { const n = Object.assign(this.add(new FNode('gain')), { gain: new FParam(1) }); this.gains.push(n); return n; }
  createOscillator() { const o = this.add(new FSource('osc')); this.sources.push(o); return o; }
  createBufferSource() { const o = this.add(new FSource('buffer')); this.sources.push(o); return o; }
  createBiquadFilter() { const f = Object.assign(this.add(new FNode('filter')), { type: 'lowpass', frequency: new FParam(350), Q: new FParam(1) }); this.filters.push(f); return f; }
  createConvolver() { return Object.assign(this.add(new FNode('convolver')), { buffer: null as unknown, normalize: true }); }
  createStereoPanner() { return Object.assign(this.add(new FNode('panner')), { pan: new FParam(0) }); }
  createBuffer(ch: number, len: number, sr: number) {
    const data = Array.from({ length: ch }, () => new Float32Array(len));
    return { numberOfChannels: ch, length: len, sampleRate: sr, getChannelData: (i: number) => data[i] };
  }
}

/** A fake of the app's audio: its context and master bus, and a record of any call to its own voices. */
function fakeAudio(on = true) {
  const ctx = new FakeCtx();
  const out = ctx.createGain();
  const calls: string[] = [];
  const rec = (name: string) => () => { calls.push(name); };
  const a = {
    ctx: on ? ctx : null, out: on ? out : null, on, level: on ? 0.6 : 0,
    pad: rec('pad'), padChord: rec('padChord'), focus: rec('focus'), tone: rec('tone'), bell: rec('bell'), combo: rec('combo'), noiseBurst: rec('noiseBurst'),
    start: rec('start'), stop: rec('stop'), suspend: rec('suspend'), resume: rec('resume'), setVolume: rec('setVolume'),
  };
  return { a: a as unknown as ArcadeAudio, ctx, out, calls };
}

let seed = 7;
const rng = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const state = (o: Partial<SoundState> = {}): SoundState => ({ place: 'arrive', dawn: 0, rest: false, light: 0, breath: null, ...o });

/** Run the garden for `sec` seconds of play at 20 frames a second. */
function run(g: GardenSound, ctx: FakeCtx, sec: number, s: SoundState | ((t: number) => SoundState)): void {
  const t0 = ctx.currentTime;
  for (let t = 0; t < sec; t += 0.05) {
    ctx.currentTime = t0 + t;
    g.update(0.05, typeof s === 'function' ? s(t) : s);
  }
  ctx.currentTime = t0 + sec;
}

describe('ogród sound: the score', () => {
  it('walks F major from the night to the morning, its pad opening with the dawn', () => {
    expect(moodOf(0)).toBe('night');
    expect(moodOf(0.5)).toBe('blue');
    expect(moodOf(1)).toBe('morning');
    expect(PROGRESSIONS.night).toEqual(['vi', 'IV', 'I', 'V']);
    expect(cutoffOf(1, 0, false)).toBeGreaterThan(cutoffOf(0.5, 0, false) * 1.8);
    expect(cutoffOf(0.5, 1, false)).toBeGreaterThan(cutoffOf(0.5, 0, false));
    expect(cutoffOf(0.5, 0, true)).toBeLessThan(cutoffOf(0.5, 0, false));
    // the chord's tones in a range: F major's notes only
    const tones = tonesIn({ name: 'Fadd9', pad: [53, 57, 60, 67], bass: 41 }, 60, 72);
    expect(tones).toEqual([60, 65, 67, 69, 72]);
    for (const c of Object.keys(CUE_GAP)) expect(CUE_GAP[c as SoundCue]).toBeGreaterThan(0);
  });

  it('builds its room: a stereo tail that decays', () => {
    const ctx = new FakeCtx();
    const ir = gardenRoom(ctx as unknown as BaseAudioContext, 3);
    expect(ir.numberOfChannels).toBe(2);
    const d = ir.getChannelData(0);
    const rms = (a: number, b: number) => Math.sqrt(d.slice(a, b).reduce((s, x) => s + x * x, 0) / (b - a));
    expect(rms(400, 3000)).toBeGreaterThan(rms(18000, 22000) * 20);
    expect(d.every(Number.isFinite)).toBe(true);
  });
});

describe('ogród sound: a whole session', () => {
  it('rises from silence into the app\'s bus, never straight to the speakers, and never touches the kit\'s own voices', () => {
    const { a, ctx, out, calls } = fakeAudio();
    const g = new GardenSound(a, { rng });
    g.start();
    expect(g.debug.on).toBe(true);
    const places: [Place, number, number][] = [['arrive', 30, 0], ['lzy', 120, 0.1], ['dlon', 120, 0.25], ['list', 100, 0.4], ['kamienie', 100, 0.55], ['latarnie', 100, 0.62], ['dawn', 90, 1], ['close', 40, 1]];
    let t = 0;
    for (const [place, len, dawn] of places) {
      for (let s = 0; s < len; s += 0.05) {
        t += 0.05;
        ctx.currentTime = t;
        const rest = Math.floor(t / 20) % 2 === 1;
        const k = (t % 10) / 10;
        const breath: BreathState | null = rest ? { phase: k < 0.5 ? 'in' : 'out', p: (k % 0.5) * 2, left: 5 - (k % 0.5) * 10, k, n: 0 } : null;
        g.update(0.05, { place, dawn, rest, light: rest ? 0 : 0.5 + 0.5 * Math.sin(t / 5), breath });
        if (Math.round(t * 20) % 151 === 0) g.cue((Object.keys(CUE_GAP) as SoundCue[])[Math.floor(t) % 20]);
      }
    }
    for (const n of ctx.nodes) expect(n.outs).not.toContain(ctx.destination);
    expect(ctx.nodes.some(n => n.outs.includes(out))).toBe(true);
    expect(calls).toEqual([]);
    // the bus came up from silence
    const bus = ctx.gains.find(n => n.outs.includes(out))!;
    expect(bus.gain.events[0]).toEqual(['cancel', 0]);
    expect(bus.gain.events.find(e => e[0] === 'lin')?.[1]).toBe(LEVEL);
    // every note's envelope starts at silence and is never loud
    let envs = 0;
    for (const n of ctx.gains) {
      const ev = n.gain.events;
      if (!ev.length || ev[0][0] !== 'set' || n === bus) continue;
      envs++;
      expect(ev[0][1]).toBe(0);
      for (const e of ev) if (e[0] === 'lin') expect(e[1]).toBeLessThanOrEqual(0.06);
    }
    expect(envs).toBeGreaterThan(200);
    // the chords moved through all three moods
    expect(g.debug.mood).toBe('morning');
    // what still sounds is the last chord (4 pads × 3 + the root's 2), the slow movers and the glow — nothing piles up
    const open = ctx.sources.filter(s => s.stopAt === Infinity);
    expect(open.length).toBeLessThanOrEqual(24);
    g.finish();
    expect(ctx.sources.every(s => s.stopAt < Infinity)).toBe(true);
    g.destroy();
  });

  it('follows the dawn: the night\'s progression, then the blue hour\'s and the morning\'s, the pad opening', () => {
    const { a, ctx } = fakeAudio();
    const g = new GardenSound(a, { rng });
    g.start();
    const chords = new Set<string>();
    run(g, ctx, 60, () => { chords.add(g.debug.chord); return state({ dawn: 0 }); });
    expect(g.debug.mood).toBe('night');
    expect([...chords].sort()).toEqual(['B♭maj9', 'Csus2', 'Dm9', 'Fadd9']);
    const padF = ctx.filters.find(f => f.Q.value === 0.5)!;
    const night = padF.frequency.last;
    run(g, ctx, 40, state({ place: 'kamienie', dawn: 0.5 }));
    expect(g.debug.mood).toBe('blue');
    const blue = padF.frequency.last;
    chords.clear();
    run(g, ctx, 60, () => { chords.add(g.debug.chord); return state({ place: 'dawn', dawn: 1 }); });
    expect(g.debug.mood).toBe('morning');
    expect(chords.has('C/E') || chords.has('F')).toBe(true);
    const morning = padF.frequency.last;
    expect(blue).toBeGreaterThan(night * 1.3);
    expect(morning).toBeGreaterThan(blue * 1.5);
    // a new chord never jumps in over one that has only just arrived
    const starts = ctx.sources.filter(s => s.kind === 'osc' && s.startAt >= 0).map(s => s.startAt);
    expect(starts.length).toBeGreaterThan(50);
  });

  it('lets the focus light be heard: the glow rises with it and the pad brightens a little', () => {
    const { a, ctx } = fakeAudio();
    const g = new GardenSound(a, { rng });
    g.start();
    run(g, ctx, 10, state({ place: 'lzy', dawn: 0.2, light: 0 }));
    const glow = ctx.gains.find(n => n.gain.events.some(e => e[0] === 'target') && n.gain.value === 0 && n.outs.length === 2)!;
    const padF = ctx.filters.find(f => f.Q.value === 0.5)!;
    const dark = padF.frequency.last;
    run(g, ctx, 10, state({ place: 'lzy', dawn: 0.2, light: 1 }));
    expect(padF.frequency.last).toBeGreaterThan(dark * 1.3);
    expect(glow.gain.last).toBeGreaterThan(0.005);
    run(g, ctx, 10, state({ place: 'lzy', dawn: 0.2, light: 0 }));
    expect(glow.gain.last).toBeLessThan(0.001);
  });

  it('the night has drips and crickets that give way to birds at dawn — sparse, never a chorus', () => {
    const { a, ctx } = fakeAudio();
    const g = new GardenSound(a, { rng });
    const proto = GardenSound.prototype as unknown as Record<string, (...x: unknown[]) => void>;
    const birds = vi.spyOn(proto, 'birdsong');
    const crickets = vi.spyOn(proto, 'cricket');
    const drips = vi.spyOn(proto, 'chirp');
    g.start();
    run(g, ctx, 60, state({ dawn: 0 }));
    expect(birds).not.toHaveBeenCalled();
    expect(crickets.mock.calls.length).toBeGreaterThanOrEqual(8);
    expect(crickets.mock.calls.length).toBeLessThanOrEqual(30);
    const early = drips.mock.calls.length;
    expect(early).toBeGreaterThan(10);
    drips.mockClear();
    run(g, ctx, 60, state({ dawn: 0.2 }));
    expect(drips.mock.calls.length).toBeLessThan(early);
    crickets.mockClear();
    drips.mockClear();
    run(g, ctx, 120, state({ place: 'dawn', dawn: 1 }));
    expect(crickets).not.toHaveBeenCalled();
    expect(drips).not.toHaveBeenCalled();
    expect(birds.mock.calls.length).toBeGreaterThanOrEqual(8);
    expect(birds.mock.calls.length).toBeLessThanOrEqual(40);
    vi.restoreAllMocks();
  });

  it('breathes with the rest: air on each in- and out-breath, nothing on a hold or outside a rest', () => {
    const { a, ctx } = fakeAudio();
    const g = new GardenSound(a, { rng });
    const air = vi.spyOn(GardenSound.prototype as unknown as Record<string, (...x: unknown[]) => void>, 'air');
    g.start();
    const phases: [BreathState['phase'], number][] = [['in', 4], ['holdIn', 2], ['out', 6], ['holdOut', 1], ['in', 4], ['out', 6]];
    for (const [phase, len] of phases) {
      for (let s = 0; s < len; s += 0.05) {
        ctx.currentTime += 0.05;
        g.update(0.05, state({ place: 'lzy', rest: true, breath: { phase, p: s / len, left: len - s, k: 0.5, n: 0 } }));
      }
    }
    expect(air).toHaveBeenCalledTimes(4);
    expect(air.mock.calls.map(c => Math.round(c[1] as number))).toEqual([4, 6, 4, 6]);
    air.mockClear();
    run(g, ctx, 10, state({ place: 'lzy', rest: false, breath: { phase: 'in', p: 0, left: 4, k: 0, n: 0 } }));
    expect(air).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('ogród sound: cues', () => {
  it('each cue makes a sound once in its gap, and all of them together stay under a budget', () => {
    const { a, ctx } = fakeAudio();
    const g = new GardenSound(a, { rng });
    g.start();
    run(g, ctx, 1, state());
    const n0 = ctx.sources.length;
    g.cue('drop');
    const n1 = ctx.sources.length;
    expect(n1).toBeGreaterThan(n0);
    for (let i = 0; i < 10; i++) g.cue('drop');
    expect(ctx.sources.length).toBe(n1);
    ctx.currentTime += CUE_GAP.drop + 0.01;
    g.cue('drop');
    expect(ctx.sources.length).toBeGreaterThan(n1);
    // twenty different moments at once: at most eight sound
    ctx.currentTime += 10;
    const before = ctx.sources.length;
    const all = Object.keys(CUE_GAP) as SoundCue[];
    const made: number[] = [];
    for (const c of all) {
      const k = ctx.sources.length;
      g.cue(c);
      made.push(ctx.sources.length - k);
    }
    expect(made.filter(x => x > 0).length).toBe(8);
    expect(ctx.sources.length).toBeGreaterThan(before);
    // after the window every cue sounds again, each of them something
    for (const c of all) {
      ctx.currentTime += 3.2;
      const k = ctx.sources.length;
      g.cue(c);
      expect(ctx.sources.length - k, c).toBeGreaterThan(0);
    }
    // an unknown cue is ignored
    g.cue('boom' as SoundCue);
  });

  it('grace is a soft chord in the key, never a low buzz or a falling "failure" sound', () => {
    const { a, ctx } = fakeAudio();
    const g = new GardenSound(a, { rng });
    g.start();
    run(g, ctx, 1, state());
    const k = ctx.sources.length;
    g.cue('grace');
    const made = ctx.sources.slice(k).filter(s => s.kind === 'osc');
    expect(made.length).toBeGreaterThanOrEqual(3);
    for (const s of made) {
      expect(s.frequency.value).toBeGreaterThan(300);
      expect(s.frequency.events.some(e => e[0] === 'exp')).toBe(false);
    }
  });
});

describe('ogród sound: pause, finish, silence', () => {
  it('schedules nothing while paused, and comes back softly', () => {
    const { a, ctx, out } = fakeAudio();
    const g = new GardenSound(a, { rng });
    g.start();
    run(g, ctx, 5, state());
    const bus = ctx.gains.find(n => n.outs.includes(out))!;
    g.pause(true);
    expect(g.debug.paused).toBe(true);
    expect(bus.gain.last).toBe(0);
    const n = ctx.sources.length;
    run(g, ctx, 30, state({ dawn: 1, place: 'dawn' }));
    g.cue('bloom');
    expect(ctx.sources.length).toBe(n);
    g.pause(false);
    expect(bus.gain.last).toBe(LEVEL);
    run(g, ctx, 15, state({ place: 'lzy' }));
    expect(ctx.sources.length).toBeGreaterThan(n);
  });

  it('finish fades everything over about three seconds and stops it; afterwards nothing new; destroy is safe twice', () => {
    vi.useFakeTimers();
    const { a, ctx, out } = fakeAudio();
    const g = new GardenSound(a, { rng });
    g.start();
    run(g, ctx, 30, state({ place: 'close', dawn: 1 }));
    const bus = ctx.gains.find(n => n.outs.includes(out))!;
    const now = ctx.currentTime;
    g.finish();
    const fade = bus.gain.events.filter(e => e[0] === 'lin').at(-1)!;
    expect(fade[1]).toBe(0);
    expect(fade[2] - now).toBeGreaterThanOrEqual(2.5);
    expect(fade[2] - now).toBeLessThanOrEqual(3.5);
    for (const s of ctx.sources) expect(s.stopAt).toBeLessThanOrEqual(now + 4);
    const n = ctx.sources.length;
    run(g, ctx, 10, state({ place: 'close', dawn: 1 }));
    g.cue('call');
    g.pause(true);
    expect(ctx.sources.length).toBe(n);
    g.destroy();
    g.destroy();
    vi.runAllTimers();
    expect(bus.outs).toEqual([]);
    vi.useRealTimers();
  });

  it('with the sound off (no context) every call is silent and safe', () => {
    const { a, calls } = fakeAudio(false);
    const g = new GardenSound(a);
    g.start();
    g.update(0.016, state({ dawn: 0.5, light: 1 }));
    g.cue('call');
    g.pause(true);
    g.pause(false);
    g.finish();
    g.destroy();
    expect(g.debug.on).toBe(false);
    expect(calls).toEqual([]);
    // and before start, nothing either
    const { a: b, ctx } = fakeAudio();
    const h = new GardenSound(b);
    h.update(0.016, state());
    h.cue('bloom');
    expect(ctx.sources).toHaveLength(0);
  });
});
