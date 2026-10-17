/**
 * The choir. Its oscillators run for the whole session and are only re-tuned, re-voweled and
 * re-enveloped: no nodes are created per note, which keeps phones cool.
 *
 * Source–filter model of the voice: per singer two slightly detuned sawtooths (the glottal
 * source) → a parallel bank of band-pass filters at the formants F1–F3 of the vowel, beside a
 * low-pass "body" → envelope. Singers in unison share one formant bank and envelope: filtering is
 * linear, so filtering their sum equals filtering each, at a fraction of the cost.
 */
import { midiToHz, type Vowel } from './chant';
import type { NoteCue } from './composer';
import type { Rng } from './rng';

/**
 * Male vowel formants, [Hz, bandwidth Hz, relative amplitude] for F1–F3 (after the classic
 * Peterson–Barney measurements and the Csound tenor table), bandwidths widened for a warmer choir.
 */
export const FORMANTS: Readonly<Record<Vowel, readonly (readonly [hz: number, bw: number, amp: number])[]>> = {
  a: [[650, 110, 1], [1080, 120, 0.5], [2650, 160, 0.4]],
  e: [[400, 90, 1], [1700, 130, 0.22], [2600, 160, 0.25]],
  i: [[290, 70, 1], [1870, 140, 0.18], [2800, 170, 0.14]],
  o: [[400, 90, 1], [800, 110, 0.32], [2600, 160, 0.2]],
  u: [[350, 80, 1], [600, 100, 0.12], [2700, 170, 0.1]],
};

/** Gain making up for what the narrow formant filters take from the source. */
const MAKEUP = 2;

/** Vowel filter: F1–F3 band-passes in parallel with a low "body" (a real voice's strong low harmonics). */
export class FormantBank {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly nodes: AudioNode[];
  private readonly bands: { filter: BiquadFilterNode; amp: GainNode }[];

  constructor(ctx: BaseAudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    const body = ctx.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = 320;
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.18;
    this.input.connect(body).connect(bodyGain).connect(this.output);
    this.bands = FORMANTS.a.map(([hz, bw, amp]) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = hz;
      filter.Q.value = hz / bw;
      const gain = ctx.createGain();
      gain.gain.value = amp;
      this.input.connect(filter).connect(gain).connect(this.output);
      return { filter, amp: gain };
    });
    this.nodes = [this.input, this.output, body, bodyGain, ...this.bands.flatMap(b => [b.filter, b.amp])];
  }

  /** Glides to a vowel; `colour` scales the formants (below 1 is darker, as from a longer vocal tract). */
  vowel(at: number, vowel: Vowel, colour = 1, tau = 0.04): void {
    FORMANTS[vowel].forEach(([hz, bw, amp], i) => {
      const { filter, amp: gain } = this.bands[i];
      filter.frequency.setTargetAtTime(hz * colour, at, tau);
      filter.Q.setTargetAtTime(hz / bw, at, tau);
      gain.gain.setTargetAtTime(amp, at, tau);
    });
  }
}

interface Singer {
  oscs: OscillatorNode[];
  gain: GainNode;
  vibrato: GainNode;
  /** vibrato depth and phase relative to the shared LFO: singers do not waver in lockstep */
  sway: number;
}

/** A section of the schola singing in unison (or holding a drone). */
export class Section {
  private readonly singers: Singer[];
  private readonly bank: FormantBank;
  private readonly env: GainNode;
  private open = false;
  private voices = -1;
  private sound = '';

  constructor(
    ctx: BaseAudioContext,
    out: AudioNode,
    size: number,
    lfo: AudioNode,
    private readonly rng: Rng,
    private readonly vibratoCents: number,
  ) {
    this.bank = new FormantBank(ctx);
    this.env = ctx.createGain();
    this.env.gain.value = 0;
    this.bank.output.connect(this.env).connect(out);
    this.singers = Array.from({ length: size }, (_, i) => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.bank.input);
      const vibrato = ctx.createGain();
      vibrato.gain.value = 0;
      lfo.connect(vibrato);
      const spread = (i - (size - 1) / 2) * 7; // cents: no two singers exactly in tune
      const oscs = [-3, 3].map(cents => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.detune.value = spread + cents;
        vibrato.connect(osc.detune);
        osc.connect(gain);
        osc.start();
        return osc;
      });
      return { oscs, gain, vibrato, sway: (i % 2 ? -1 : 1) * (1 - 0.15 * i) };
    });
  }

  /** Sings a note: a legato glide, a vowel morph, a consonant between syllables, vibrato blooming on long notes. */
  note(cue: NoteCue, colour: number): void {
    const { at } = cue;
    if (cue.voices !== this.voices) {
      this.voices = cue.voices;
      this.singers.forEach((s, i) => s.gain.gain.setTargetAtTime(i < cue.voices ? 1 / Math.sqrt(cue.voices) : 0, at, 0.3));
    }
    const sound = cue.vowel + colour;
    if (sound !== this.sound) {
      this.sound = sound;
      this.bank.vowel(at, cue.vowel, colour);
    }
    const hz = midiToHz(cue.midi);
    for (const s of this.singers) {
      const when = at + this.rng.range(0, 0.025); // never exactly together…
      const f = hz * 2 ** (this.rng.range(-4, 4) / 1200); // …nor exactly in tune
      for (const osc of s.oscs) osc.frequency.setTargetAtTime(f, when, this.open ? 0.035 : 0.005);
      s.vibrato.gain.setTargetAtTime(0, when, 0.05);
      if (cue.dur > 0.5) s.vibrato.gain.setTargetAtTime(this.vibratoCents * s.sway, when + 0.3, 0.25);
    }
    const env = this.env.gain;
    const peak = cue.level * MAKEUP;
    if (!this.open) {
      env.setTargetAtTime(peak, at, 0.07);
    } else if (cue.tie) {
      env.setTargetAtTime(peak, at, 0.2);
    } else {
      env.setTargetAtTime(0.55 * peak, at - 0.03, 0.012); // a consonant between syllables
      env.setTargetAtTime(peak, at + 0.01, 0.04);
    }
    this.open = true;
  }

  rest(at: number, release: number): void {
    this.env.gain.setTargetAtTime(0, at, release);
    this.open = false;
  }
}
