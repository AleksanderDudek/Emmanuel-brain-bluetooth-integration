/**
 * Playing rendered notes. The bank renders each instrument note into an AudioBuffer the first
 * time it is needed — or a little ahead, a couple per scheduler tick — and forgets the least
 * recently used ones beyond a memory budget. The pool plays them: one BufferSource and one gain
 * per note, disconnected when it ends, at most MAX_VOICES at once (beyond that the least
 * important, oldest voice is stolen with a quick fade), held notes looping until released.
 */
import type { Realm } from './chant';
import { INSTRUMENT_RATE, LOOPED, UNPITCHED, renderInstrument, type Inst } from './instruments';

/** Simultaneous music voices (buffer playbacks). */
export const MAX_VOICES = 24;
/** Rendered samples kept, bytes: a few pieces' worth. */
export const BANK_BUDGET = 24e6;
/** Notes rendered ahead of need per scheduler tick. */
export const WARM_PER_TICK = 2;
/** main-thread time a scheduler tick may spend rendering ahead, ms (a heavy note on a slow phone takes several) */
export const WARM_BUDGET_MS = 3;

export type NoteSpec = readonly [inst: Inst, midi: number, colour: Realm];

export class BufferBank {
  private readonly cache = new Map<string, AudioBuffer>();
  private readonly wanted: NoteSpec[] = [];
  private bytes = 0;
  /** notes rendered so far */
  renders = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly budget = BANK_BUDGET,
  ) {}

  /** The note's buffer, rendered now if it is not yet. */
  get(inst: Inst, midi: number, colour: Realm = 'earth'): AudioBuffer {
    const key = keyOf(inst, midi, colour);
    let buffer = this.cache.get(key);
    if (buffer) {
      this.cache.delete(key); // re-inserted below: the most recently used go last
    } else {
      const data = renderInstrument(inst, midi, colour);
      buffer = this.ctx.createBuffer(1, data.length, INSTRUMENT_RATE);
      buffer.getChannelData(0).set(data);
      this.renders++;
      this.bytes += 4 * data.length;
      for (const [k, old] of this.cache) {
        if (this.bytes <= this.budget) break;
        this.cache.delete(k); // notes still playing keep their buffer alive
        this.bytes -= 4 * old.length;
      }
    }
    this.cache.set(key, buffer);
    return buffer;
  }

  has(inst: Inst, midi: number, colour: Realm = 'earth'): boolean {
    return this.cache.has(keyOf(inst, midi, colour));
  }

  get size(): number {
    return this.cache.size;
  }

  /** Queues notes to render ahead of need (see `warm`). */
  prewarm(notes: readonly NoteSpec[]): void {
    this.wanted.length = 0;
    for (const note of notes) if (!this.has(...note)) this.wanted.push(note);
  }

  /** Renders up to `max` of the queued notes, stopping once `budgetMs` of main-thread time is spent. */
  warm(max = WARM_PER_TICK, budgetMs = Infinity): void {
    const start = performance.now();
    for (let done = 0; done < max && this.wanted.length && performance.now() - start < budgetMs; ) {
      const note = this.wanted.shift()!;
      if (this.has(...note)) continue;
      this.get(...note);
      done++;
    }
  }
}

const keyOf = (inst: Inst, midi: number, colour: Realm): string =>
  UNPITCHED.has(inst) ? inst : LOOPED.has(inst) ? `${inst}:${midi}:${colour}` : `${inst}:${midi}`;

export interface PlayOptions {
  level: number;
  /** importance when voices must be stolen: the lowest goes first */
  rank: number;
  rate?: number;
  /** cut it after this long (s), with `release` (time constant, s) */
  dur?: number;
  release?: number;
  /** fade in with this time constant instead of starting at full level */
  attack?: number;
  loop?: boolean;
  /** a held note's name */
  id?: string;
  midi?: number;
  /** its own stereo position (bells); otherwise the destination's */
  pan?: number;
}

interface Voice {
  src: AudioBufferSourceNode;
  env: GainNode;
  start: number;
  /** when it will be silent (Infinity while held) */
  end: number;
  rank: number;
  id: string | null;
  midi: number;
}

/** stop() may be called once only on older WebKit: a later, earlier stop is then simply skipped. */
function stopAt(src: AudioScheduledSourceNode, when: number): void {
  try {
    src.stop(when);
  } catch {
    // already stopping
  }
}

export class VoicePool {
  private voices: Voice[] = [];
  /** voices stolen so far */
  stolen = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    readonly cap = MAX_VOICES,
  ) {}

  /** Voices sounding at `at`, by their schedule. */
  live(at: number): number {
    this.prune(at);
    return this.voices.length;
  }

  play(buffer: AudioBuffer, dest: AudioNode, at: number, o: PlayOptions): void {
    this.prune(at);
    while (this.voices.length >= this.cap) this.steal(at);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const rate = o.rate ?? 1;
    if (rate !== 1) src.playbackRate.value = rate;
    if (o.loop) src.loop = true;
    const env = this.ctx.createGain();
    if (o.attack) {
      env.gain.setValueAtTime(0, at);
      env.gain.setTargetAtTime(o.level, at, o.attack);
    } else {
      env.gain.value = o.level;
    }
    let panner: StereoPannerNode | null = null;
    src.connect(env);
    if (o.pan === undefined) {
      env.connect(dest);
    } else {
      panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, o.pan));
      env.connect(panner).connect(dest);
    }
    const voice: Voice = { src, env, start: at, end: o.loop ? Infinity : at + buffer.duration / rate, rank: o.rank, id: o.id ?? null, midi: o.midi ?? 0 };
    src.onended = () => {
      src.disconnect();
      env.disconnect();
      panner?.disconnect();
      const i = this.voices.indexOf(voice);
      if (i >= 0) this.voices.splice(i, 1);
    };
    src.start(at);
    if (o.dur !== undefined && at + o.dur < voice.end) {
      const release = o.release ?? 0.06;
      env.gain.setTargetAtTime(0, at + o.dur, release);
      voice.end = at + o.dur + 6 * release;
      stopAt(src, voice.end);
    }
    this.voices.push(voice);
  }

  /**
   * A held, looping note under `id`: started with a fade-in of time constant `tau`, or, if it is
   * already sounding on the same buffer, moved to its new level; a different note crossfades.
   */
  hold(buffer: AudioBuffer, dest: AudioNode, at: number, id: string, level: number, tau: number, rank: number, midi = 0): void {
    const held = this.voices.find(v => v.id === id);
    if (held && held.src.buffer === buffer) {
      held.env.gain.setTargetAtTime(level, Math.max(at, held.start), tau);
      return;
    }
    if (held) this.fade(held, at, 0.4);
    this.play(buffer, dest, at, { level, rank, attack: tau, loop: true, id, midi });
  }

  release(id: string, at: number, tau: number): void {
    for (const v of this.voices) if (v.id === id) this.fade(v, at, tau);
  }

  /** Fades out every voice. */
  stopAll(at: number, tau: number): void {
    for (const v of this.voices) this.fade(v, at, tau);
  }

  private fade(v: Voice, at: number, tau: number): void {
    const t = Math.max(at, v.start);
    v.env.gain.setTargetAtTime(0, t, tau);
    const end = t + 6 * tau; // ≈ −52 dB
    if (end < v.end) {
      v.end = end;
      stopAt(v.src, end);
    }
    v.id = null;
  }

  /** Makes room: the least important voice, the oldest among equals, fades out at once. */
  private steal(at: number): void {
    let victim = this.voices[0];
    for (const v of this.voices) if (v.rank < victim.rank || (v.rank === victim.rank && v.start < victim.start)) victim = v;
    this.fade(victim, at, 0.015);
    this.voices.splice(this.voices.indexOf(victim), 1);
    this.stolen++;
  }

  private prune(at: number): void {
    if (this.voices.some(v => v.end <= at)) this.voices = this.voices.filter(v => v.end > at);
  }
}
