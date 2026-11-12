/**
 * Background songs for the arcade games (DESIGN.md §13.2), synthesised on the game's ArcadeAudio:
 * no files, works offline, follows the player's sound settings and the master fade.
 *
 * A song is a loop of parts — an instrument playing notes on the degrees of a scale — in layers:
 * layer 0 always plays, layers 1–3 join as `level()` rises and the song's filter opens with it, so
 * the song itself is feedback (adaptive music), the way the pad's filter is in the other games.  In a
 * blind block a game passes `null`, which holds the song as it is and leaks nothing.
 *
 * The lyric lines carry the beat they start on, for a sing-along line on the canvas (`line()`).  The
 * body series ("Weź moc, obudź się") shares one refrain, `seriesChorus()`; each game writes its own
 * verses around it — original words and melodies, never the viral song the founder mentioned.
 */
import { lang as pageLang, type Lang } from '../../i18n';
import type { ArcadeAudio } from './audio';

export type Voice = 'lead' | 'bell' | 'pluck' | 'pad' | 'bass' | 'kick' | 'snare' | 'hat';

/** A note: `at` and `len` in beats from the start of the loop; `deg` a scale degree (see `degFreq`). */
export interface SongNote { at: number; len: number; deg: number; oct?: number; vel?: number }

/** An instrument's notes; `layer` 0 always plays, 1–3 join as the level rises past 0.25, 0.5, 0.75. */
export interface SongPart { voice: Voice; layer: 0 | 1 | 2 | 3; gain?: number; notes: SongNote[] }

/** A lyric line: the beat it starts on and its text in the page's language. */
export interface SongLine { at: number; text: string }

export interface Song {
  bpm: number;
  /** the loop's length in beats */
  beats: number;
  /** the frequency of degree 0 in octave 0 (Hz) */
  root: number;
  /** semitones of the scale's degrees above the root, e.g. MAJOR */
  scale: readonly number[];
  parts: SongPart[];
  lines: SongLine[];
}

export const MAJOR: readonly number[] = [0, 2, 4, 5, 7, 9, 11];
export const MINOR: readonly number[] = [0, 2, 3, 5, 7, 8, 10];
export const PENTA: readonly number[] = [0, 2, 4, 7, 9];

/** Frequency of a scale degree: degrees past the scale's length climb into the next octaves, negative ones go down. */
export function degFreq(song: Pick<Song, 'root' | 'scale'>, deg: number, oct = 0): number {
  const n = song.scale.length;
  const d = Math.round(deg);
  const o = Math.floor(d / n);
  const semis = song.scale[((d % n) + n) % n] + 12 * (o + oct);
  return song.root * 2 ** (semis / 12);
}

/**
 * Notes from a compact string of "deg:len" tokens: "0:1 2:1 4:2 -:1 5^:0.5 3_:1 4!:1".
 * `-` is a rest; a `^` or `_` after the degree moves the note an octave up or down; `!` accents it.
 * Bad tokens throw (a song is code; a typo should fail its test).
 */
export function melody(src: string, start = 0): SongNote[] {
  const out: SongNote[] = [];
  let at = start;
  for (const tok of src.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = tok.match(/^(-|-?\d+)([\^_]*)(!?):(\d+(?:\.\d+)?)$/);
    if (!m) throw new Error(`melody: bad token "${tok}"`);
    const len = Number(m[4]);
    if (m[1] !== '-') {
      const oct = [...m[2]].reduce((o, c) => o + (c === '^' ? 1 : -1), 0);
      out.push({ at, len, deg: Number(m[1]), ...(oct ? { oct } : {}), ...(m[3] ? { vel: 1 } : {}) });
    }
    at += len;
  }
  return out;
}

/** The same notes `times` times, every `every` beats. */
export function repeat(notes: readonly SongNote[], times: number, every: number): SongNote[] {
  const out: SongNote[] = [];
  for (let k = 0; k < times; k++) for (const n of notes) out.push({ ...n, at: n.at + k * every });
  return out;
}

/** A drum pattern, one character per step of `step` beats: "x" a hit, "X" an accent, anything else a rest. */
export function steps(pattern: string, step = 0.5, start = 0): SongNote[] {
  const out: SongNote[] = [];
  [...pattern].forEach((c, i) => {
    if (c === 'x' || c === 'X') out.push({ at: start + i * step, len: step, deg: 0, vel: c === 'X' ? 1 : 0.7 });
  });
  return out;
}

/** Chords as pad notes: one triad (degrees `d`, `d+2`, `d+4`) per entry, each `len` beats long. */
export function chords(roots: readonly number[], len: number, start = 0, oct = 0): SongNote[] {
  return roots.flatMap((d, i) => [0, 2, 4].map(k => ({ at: start + i * len, len, deg: d + k, ...(oct ? { oct } : {}) })));
}

/** Move notes later by `beats` (to place a refrain after the verses). */
export const shift = (notes: readonly SongNote[], beats: number): SongNote[] => notes.map(n => ({ ...n, at: n.at + beats }));

// ── the series' refrain ─────────────────────────────────────────────────────────────
const CHORUS_WORDS: Readonly<Record<Lang, readonly [string, string, string, string]>> = {
  pl: ['Weź moc, obudź się,', 'każda komórka wita dzień;', 'serce gra, oddech lśni —', 'życie we mnie mocno brzmi.'],
  en: ['Take power, wake up,', 'every cell is greeting the day;', 'heart is beating, breath is bright —', 'life is singing strong in me.'],
  de: ['Nimm Kraft, wach auf,', 'jede Zelle grüßt den Tag;', 'Herz schlägt, Atem strahlt —', 'Leben klingt in mir so stark.'],
  sv: ['Ta kraft, vakna nu,', 'varje cell hälsar dagen glad;', 'hjärtat slår, andan lyser —', 'livet sjunger starkt i mig.'],
};

/** The refrain's length: eight bars of 4/4. */
export const CHORUS_BEATS = 32;

/**
 * The refrain all four body games share ("Weź moc, obudź się", the series' name), placed at `start`:
 * its melody, chords, bass and beat, and its four lines in `lang`.  Written for a seven-note scale
 * (MAJOR, or MINOR for a darker variant); a song adds its own verses around it.
 */
export function seriesChorus(start = 0, lang: Lang = pageLang): { parts: SongPart[]; lines: SongLine[]; beats: number } {
  const tune = melody([
    '4:1 4:1 5:0.5 4:0.5 2:1', '0:3 -:1',            // Weź moc, obudź się,
    '2:0.5 2:0.5 4:0.5 4:0.5 5:1 5:1', '4:0.5 2:0.5 1:1 0:2',   // każda komórka wita dzień;
    '4:1 4:1 7!:2', '6:1 5:1 4:2',                   // serce gra, oddech lśni —
    '5:0.5 5:0.5 4:0.5 4:0.5 2:1 2:1', '1:1 1:1 0!:2',          // życie we mnie mocno brzmi.
  ].join(' '), start);
  const roots = [0, 3, 5, 0, 0, 4, 5, 4];
  const pad = chords(roots, 4, start, -1);
  const bass = roots.flatMap((d, i) => [
    { at: start + i * 4, len: 1.5, deg: d, oct: -2 },
    { at: start + i * 4 + 2, len: 1.5, deg: i === 7 ? 0 : d, oct: -2 },
  ]);
  const words = CHORUS_WORDS[lang];
  return {
    beats: CHORUS_BEATS,
    parts: [
      { voice: 'pad', layer: 0, gain: 0.8, notes: pad },
      { voice: 'bass', layer: 1, notes: bass },
      { voice: 'lead', layer: 1, notes: tune },
      { voice: 'bell', layer: 2, gain: 0.5, notes: tune.filter((_, i) => i % 3 === 0).map(n => ({ ...n, oct: (n.oct ?? 0) + 1 })) },
      { voice: 'kick', layer: 2, notes: repeat(steps('x...x...', 0.5, start), 8, 4) },
      { voice: 'snare', layer: 3, notes: repeat(steps('..x...x.', 0.5, start), 8, 4) },
      { voice: 'hat', layer: 3, notes: repeat(steps('xxxxxxxx', 0.5, start), 8, 4) },
    ],
    lines: words.map((text, i) => ({ at: start + i * 8, text })),
  };
}

/** Check a song for mistakes a listener would hear (notes past the loop, unordered lines, bad numbers). */
export function songProblems(song: Song): string[] {
  const out: string[] = [];
  if (!(song.bpm >= 40 && song.bpm <= 200)) out.push(`bpm ${song.bpm} outside 40..200`);
  if (!(song.beats > 0)) out.push('no beats');
  if (!(song.root > 20 && song.root < 2000)) out.push(`root ${song.root} Hz`);
  if (!song.scale.length) out.push('empty scale');
  for (const p of song.parts) {
    for (const n of p.notes) {
      if (!Number.isFinite(n.at) || !Number.isFinite(n.len) || !Number.isFinite(n.deg)) out.push(`${p.voice}: a note with a bad number`);
      else if (n.at < 0 || n.at >= song.beats) out.push(`${p.voice}: a note at ${n.at} outside the loop of ${song.beats}`);
      else if (n.len <= 0) out.push(`${p.voice}: a note of length ${n.len}`);
    }
  }
  for (let i = 1; i < song.lines.length; i++) if (song.lines[i].at < song.lines[i - 1].at) out.push(`line ${i} starts before line ${i - 1}`);
  if (song.lines.some(l => l.at < 0 || l.at >= song.beats)) out.push('a line outside the loop');
  return out;
}

/**
 * The lyric line at a position (beats since the start; loops): its text, the next line's, and how far
 * through it the song is (0..1).  Before the loop's first line the previous loop's last line is still on.
 */
export function lineAt(song: Pick<Song, 'beats' | 'lines'>, beat: number): { text: string; next: string | null; p: number } | null {
  const lines = song.lines;
  if (!lines.length || !(song.beats > 0)) return null;
  const pos = ((beat % song.beats) + song.beats) % song.beats;
  let i = -1;
  for (let k = 0; k < lines.length; k++) if (lines[k].at <= pos) i = k;
  const wrapped = i < 0;
  if (wrapped) i = lines.length - 1;
  const cur = lines[i], nxt = lines[(i + 1) % lines.length];
  const from = wrapped ? cur.at - song.beats : cur.at;
  const end = i + 1 < lines.length ? nxt.at : lines[0].at + song.beats;
  const p = Math.max(0, Math.min(1, (pos - from) / Math.max(0.001, end - from)));
  return { text: cur.text, next: lines.length > 1 ? nxt.text : null, p };
}

// ── the player ─────────────────────────────────────────────────────────────────────
const LOOKAHEAD = 0.3;   // s scheduled ahead of the clock
const TICK_MS = 60;

interface Scheduled { at: number; part: SongPart; note: SongNote }

/**
 * Plays a song on the game's ArcadeAudio, looping, from `start()` to `stop()`.  Notes are scheduled
 * a little ahead on the audio clock, so the beat holds while the page draws.  Without audio (sound
 * off, no AudioContext) every call is a quiet no-op and `beat` follows the wall clock, so visuals that
 * pulse with the beat still pulse.
 */
export class SongPlayer {
  private bus: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private layers: GainNode[] = [];
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private t0 = 0;
  private wall0 = 0;
  private scheduledTo = 0;
  private events: Scheduled[] = [];
  private lvl = 0.35;
  private playing = false;

  constructor(private readonly audio: ArcadeAudio, private readonly song: Song, private readonly mix = 0.55) {
    // every note of the loop in time order, once
    this.events = song.parts.flatMap(part => part.notes.map(note => ({ at: note.at, part, note }))).sort((a, b) => a.at - b.at);
  }

  get secPerBeat(): number { return 60 / this.song.bpm; }

  /** Start at once (call it from the game's `start()`); a second call restarts from the top. */
  start(): void {
    this.stopNodes(0);
    this.playing = true;
    this.wall0 = performance.now() / 1000;
    const ctx = this.audio.ctx, out = this.audio.out;
    if (!ctx || !out) return;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.gain.setTargetAtTime(this.mix, ctx.currentTime, 0.6);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.6;
    this.bus.connect(this.filter).connect(out);
    this.layers = [0, 1, 2, 3].map(() => {
      const g = ctx.createGain();
      g.connect(this.bus!);
      return g;
    });
    this.noise = ctx.createBuffer(1, ctx.sampleRate >> 1, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    this.t0 = ctx.currentTime + 0.12;
    this.scheduledTo = 0;
    this.applyLevel(true);
    this.pump();
    this.timer = setInterval(() => this.pump(), TICK_MS);
  }

  /** Fade out and stop (call it from `destroy()`, and at the end of play). */
  stop(fade = 0.8): void {
    this.playing = false;
    this.stopNodes(fade);
  }

  /** 0..1: how full and bright the song is — layers join at 0.25, 0.5, 0.75 and the filter opens; null holds. */
  level(v: number | null): void {
    if (v === null || !Number.isFinite(v)) return;
    const next = Math.max(0, Math.min(1, v));
    if (Math.abs(next - this.lvl) < 0.01) return;
    this.lvl = next;
    this.applyLevel(false);
  }

  get currentLevel(): number { return this.lvl; }

  /** The song's position in beats since `start()` (keeps counting through the loops). */
  get beat(): number {
    if (!this.playing) return 0;
    const ctx = this.audio.ctx;
    const t = ctx && this.bus ? ctx.currentTime - this.t0 : performance.now() / 1000 - this.wall0;
    return Math.max(0, t / this.secPerBeat);
  }

  /** The sing-along line now, the next one, and how far through the current one (0..1); null without lines. */
  line(): { text: string; next: string | null; p: number } | null {
    return this.playing ? lineAt(this.song, this.beat) : null;
  }

  private applyLevel(now: boolean): void {
    const ctx = this.audio.ctx;
    if (!ctx || !this.filter) return;
    const v = this.lvl, tc = now ? 0.01 : 0.9;
    this.layers.forEach((g, k) => {
      const on = k === 0 ? 1 : Math.max(0, Math.min(1, (v - k * 0.25) / 0.15 + 1));
      g.gain.setTargetAtTime(on, ctx.currentTime, tc);
    });
    this.filter.frequency.setTargetAtTime(700 + 11000 * v * v, ctx.currentTime, tc);
  }

  private stopNodes(fade: number): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const ctx = this.audio.ctx, bus = this.bus;
    this.bus = null;
    this.filter = null;
    this.layers = [];
    if (!ctx || !bus) return;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fade / 4));
    setTimeout(() => { try { bus.disconnect(); } catch { /* gone */ } }, Math.max(50, fade * 1500));
  }

  /** Schedule every note that starts before the clock + LOOKAHEAD, looping over the song. */
  private pump(): void {
    const ctx = this.audio.ctx;
    if (!ctx || !this.bus || ctx.state === 'closed') return;
    const spb = this.secPerBeat;
    const horizon = (ctx.currentTime + LOOKAHEAD - this.t0) / spb;   // in beats since start
    const len = this.song.beats;
    let guard = 0;
    while (this.scheduledTo < horizon && guard++ < 4) {
      const loop = Math.floor(this.scheduledTo / len);
      const from = this.scheduledTo - loop * len;
      const to = Math.min(len, horizon - loop * len);
      for (const e of this.events) {
        if (e.at < from || e.at >= to) continue;
        const when = this.t0 + (loop * len + e.at) * spb;
        if (when < ctx.currentTime - 0.02) continue;   // fell behind (a frozen tab): skip, never pile up
        this.play(e.part, e.note, Math.max(when, ctx.currentTime), e.note.len * spb);
      }
      this.scheduledTo = loop * len + to;
    }
  }

  private play(part: SongPart, note: SongNote, t: number, dur: number): void {
    const ctx = this.audio.ctx;
    const dest = this.layers[part.layer];
    if (!ctx || !dest) return;
    const vel = (note.vel ?? 0.8) * (part.gain ?? 1);
    const f = degFreq(this.song, note.deg, note.oct ?? 0);
    switch (part.voice) {
      case 'lead': return this.lead(ctx, dest, f, t, dur, vel);
      case 'bell': return this.bell(ctx, dest, f, t, vel);
      case 'pluck': return this.pluck(ctx, dest, f, t, dur, vel);
      case 'pad': return this.pad(ctx, dest, f, t, dur, vel);
      case 'bass': return this.bass(ctx, dest, f, t, dur, vel);
      case 'kick': return this.kick(ctx, dest, t, vel);
      case 'snare': return this.snare(ctx, dest, t, vel);
      case 'hat': return this.hat(ctx, dest, t, vel);
    }
  }

  private env(ctx: AudioContext, t: number, peak: number, attack: number, hold: number, release: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + Math.max(0, hold));
    g.gain.exponentialRampToValueAtTime(0.0005, t + attack + Math.max(0, hold) + release);
    return g;
  }

  private osc(ctx: AudioContext, type: OscillatorType, f: number, t: number, end: number, out: AudioNode, detune = 0): OscillatorNode {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = detune;
    o.connect(out);
    o.start(t);
    o.stop(end);
    return o;
  }

  private lead(ctx: AudioContext, dest: AudioNode, f: number, t: number, dur: number, vel: number): void {
    const hold = Math.max(0.02, dur * 0.82 - 0.04);
    const g = this.env(ctx, t, 0.16 * vel, 0.03, hold, 0.22);
    g.connect(dest);
    const o = this.osc(ctx, 'triangle', f, t, t + hold + 0.3, g);
    // a soft vibrato that comes in on long notes
    if (dur > 0.6) {
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = 5.2;
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(5, t + Math.min(0.5, dur * 0.6));
      lfo.connect(depth).connect(o.detune);
      lfo.start(t);
      lfo.stop(t + hold + 0.3);
    }
    const g2 = this.env(ctx, t, 0.05 * vel, 0.03, hold, 0.2);
    g2.connect(dest);
    this.osc(ctx, 'sine', f * 2, t, t + hold + 0.3, g2);
  }

  private bell(ctx: AudioContext, dest: AudioNode, f: number, t: number, vel: number): void {
    const out = this.env(ctx, t, 0.09 * vel, 0.005, 0, 1.6);
    out.connect(dest);
    for (const [mult, amp] of [[1, 1], [2.76, 0.28], [5.4, 0.08]] as const) {
      const g = ctx.createGain();
      g.gain.value = amp;
      g.connect(out);
      this.osc(ctx, 'sine', f * mult, t, t + 1.7, g);
    }
  }

  private pluck(ctx: AudioContext, dest: AudioNode, f: number, t: number, dur: number, vel: number): void {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, f * 8), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.2), t + 0.35);
    const g = this.env(ctx, t, 0.12 * vel, 0.004, 0, Math.min(0.9, 0.25 + dur * 0.3));
    lp.connect(g).connect(dest);
    this.osc(ctx, 'sawtooth', f, t, t + 1.2, lp);
  }

  private pad(ctx: AudioContext, dest: AudioNode, f: number, t: number, dur: number, vel: number): void {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    lp.Q.value = 0.4;
    const hold = Math.max(0.05, dur - 0.35);
    const g = this.env(ctx, t, 0.035 * vel, 0.3, hold, 0.7);
    lp.connect(g).connect(dest);
    for (const d of [-8, 8]) this.osc(ctx, 'sawtooth', f, t, t + 0.3 + hold + 0.8, lp, d);
  }

  private bass(ctx: AudioContext, dest: AudioNode, f: number, t: number, dur: number, vel: number): void {
    const hold = Math.max(0.03, dur * 0.7);
    const g = this.env(ctx, t, 0.2 * vel, 0.01, hold, 0.16);
    g.connect(dest);
    this.osc(ctx, 'sine', f, t, t + hold + 0.25, g);
    const g2 = this.env(ctx, t, 0.05 * vel, 0.01, hold * 0.5, 0.1);
    g2.connect(dest);
    this.osc(ctx, 'triangle', f * 2, t, t + hold + 0.2, g2);
  }

  private kick(ctx: AudioContext, dest: AudioNode, t: number, vel: number): void {
    const g = this.env(ctx, t, 0.32 * vel, 0.002, 0.02, 0.26);
    g.connect(dest);
    const o = this.osc(ctx, 'sine', 120, t, t + 0.35, g);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  }

  private snare(ctx: AudioContext, dest: AudioNode, t: number, vel: number): void {
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;
    const g = this.env(ctx, t, 0.13 * vel, 0.002, 0.01, 0.16);
    src.connect(bp).connect(g).connect(dest);
    src.start(t);
    src.stop(t + 0.25);
    const g2 = this.env(ctx, t, 0.06 * vel, 0.002, 0, 0.08);
    g2.connect(dest);
    this.osc(ctx, 'triangle', 185, t, t + 0.12, g2);
  }

  private hat(ctx: AudioContext, dest: AudioNode, t: number, vel: number): void {
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7200;
    const g = this.env(ctx, t, 0.045 * vel, 0.001, 0, 0.045);
    src.connect(hp).connect(g).connect(dest);
    src.start(t, 0.1);
    src.stop(t + 0.08);
  }
}
