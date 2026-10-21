/**
 * Sound of the focus training, all synthesised with Web Audio (no files):
 * a soft pad of detuned voices drifting through four chords, whose filter
 * opens a little as the activity rises, and a bell for every star.
 */

const CHORDS = [
  [110, 164.81, 220, 277.18, 329.63],      // A maj9-ish
  [92.5, 138.59, 185, 220, 277.18],        // F#m
  [73.42, 146.83, 220, 277.18, 369.99],    // D maj7
  [82.41, 123.47, 207.65, 246.94, 329.63], // E
];
const BELLS = [880, 987.77, 1108.73, 1318.51, 1479.98, 1760];   // A major pentatonic
const CHORD_SEC = 16;

export class TrainingAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private voices: OscillatorNode[] = [];
  private chord = 0;
  private chordTimer: ReturnType<typeof setInterval> | null = null;
  private bell = 0;

  constructor(private volume: number, private pad: boolean, private chime: boolean) {}

  /** Call from the click that starts the session (browsers allow audio only after a gesture). */
  start(): void {
    if (this.ctx || (!this.pad && !this.chime)) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.gain.setTargetAtTime(this.volume, ctx.currentTime, 1.5);
    this.master.connect(ctx.destination);
    if (!this.pad) return;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 700;
    this.filter.Q.value = 0.6;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.09;
    this.filter.connect(this.padGain).connect(this.master);
    // slow breathing of the filter
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = 0.045;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(this.filter.frequency);
    lfo.start();
    this.voices.push(lfo);
    CHORDS[0].forEach((f, i) => {
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = i < 2 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = i < 2 ? 0.22 : 0.1;
        o.connect(g).connect(this.filter!);
        o.start();
        this.voices.push(o);
      }
    });
    this.chordTimer = setInterval(() => this.nextChord(), CHORD_SEC * 1000);
  }

  private nextChord(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.chord = (this.chord + 1) % CHORDS.length;
    const notes = CHORDS[this.chord];
    // voices[0] is the LFO; then two detuned oscillators per chord note
    this.voices.slice(1).forEach((o, k) => o.frequency.setTargetAtTime(notes[Math.floor(k / 2)], ctx.currentTime, 1.8));
  }

  /** Brighten the pad with the activity (−∞..+∞ %, mapped softly). */
  setActivity(activity: number | null): void {
    if (!this.ctx || !this.filter) return;
    const a = activity ?? 0;
    const target = 600 + 900 / (1 + Math.exp(-(a - 8) / 6));
    this.filter.frequency.setTargetAtTime(target, this.ctx.currentTime, 1.2);
  }

  star(): void {
    const ctx = this.ctx;
    if (!ctx || !this.chime || !this.master) return;
    const f = BELLS[this.bell++ % BELLS.length];
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.16, t + 0.008);
    out.gain.exponentialRampToValueAtTime(0.0008, t + 2.2);
    out.connect(this.master);
    for (const [mult, amp] of [[1, 1], [2.76, 0.28], [5.4, 0.08]] as const) {   // bell-like partials
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f * mult;
      g.gain.value = amp;
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 2.3);
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }

  suspend(): void { void this.ctx?.suspend(); }
  resume(): void { void this.ctx?.resume(); }

  stop(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.chordTimer) clearInterval(this.chordTimer);
    this.master?.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    setTimeout(() => { void ctx.close().catch(() => undefined); }, 1500);
    this.ctx = null;
    this.voices = [];
  }
}
