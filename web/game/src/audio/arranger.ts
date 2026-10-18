/**
 * Plays a Psalm 150 piece one bar at a time, as cues for the engine: the drone and the choir pad
 * held across bars, harp, flute, bass, frame drum, tambourine, finger cymbals and shofar as notes.
 * No Web Audio here, so it is unit-testable.
 *
 * Adaptive layers: the scene and intensity decide which layers play —
 *   calm (< 0.25): drone, pad, a sparse harp that still hints at the motif
 *   medium:        + bass and light hand percussion, the harp's ostinato
 *   high (> 0.55): + the full groove and the lead melody
 *   boss (≥ 0.85): + heavier, denser drums and shofar blasts, in a darker scale on the same tonic
 * Chapel and Sabbath are calm variants of the chapter's piece (same key and motif, no drums);
 * victory is a short shofar-and-harp fanfare, then the calm variant. A layer changes only at a bar
 * line and ramps over the bar (entering over two), so nothing clicks or lurches.
 *
 * A new track (a new chapter, or the player's "next track") starts at the next bar line, or at
 * the next beat when the bar line is far: the old piece's drone and pad fade while the new one's
 * swell in, and its ringing notes die away under the new intro.
 */
import type { MusicMood, MusicScene } from '../types';
import type { Realm } from './chant';
import type { Cue, NoteCue, Part } from './composer';
import type { Inst } from './instruments';
import type { NoteSpec } from './pool';
import {
  degreeMidi, hasFifth, makeForm, makePiece, modeScale, type BarPlan, type Fill, type HarpStyle, type Line, type Piece, type Preset, type Section,
} from './psalm';
import type { Rng } from './rng';

/** A note of a rendered instrument; `dur` cuts it (with a short release) before its natural end. */
export interface InstCue { kind: 'inst'; at: number; inst: Inst; midi: number; level: number; dur?: number }
/** A held, looping note (the drone) under `id`: starts it, or moves its level (or pitch) smoothly. */
export interface HoldCue { kind: 'hold'; at: number; id: string; inst: Inst; midi: number; level: number; tau: number; colour: Realm }
/** Releases the held note `id` with time constant `tau`. */
export interface ReleaseCue { kind: 'release'; at: number; id: string; tau: number }
/** Fades out every sounding instrument note (leaving the soundtrack). */
export interface StopCue { kind: 'stop'; at: number; tau: number }
export type PsalmCue = InstCue | HoldCue | ReleaseCue | StopCue;

export type Layer = 'drone' | 'pad' | 'harp' | 'bass' | 'hand' | 'groove' | 'lead' | 'boss';
export const LAYERS: readonly Layer[] = ['drone', 'pad', 'harp', 'bass', 'hand', 'groove', 'lead', 'boss'];

/** The key of what is playing, for melodic effects: the tonic (around C5) and the scale. */
export interface Key { tonic: number; scale: readonly number[] }

const SCENES: ReadonlySet<string> = new Set<MusicScene>(['menu', 'battle', 'chapel', 'sabbath', 'boss', 'victory']);
const sceneOf = (mood: MusicMood): MusicScene => (SCENES.has(mood.scene) ? mood.scene : 'battle');

/** The calm scenes: no drums, a sparse harp. */
const CALM_SCENES: ReadonlySet<MusicScene> = new Set<MusicScene>(['chapel', 'sabbath', 'victory']);

/** Target level (0–1) of each layer for a scene and intensity, before the bar-by-bar ramp. */
export function layerTargets(scene: MusicScene, intensity: number, preset: Preset): Record<Layer, number> {
  const t: Record<Layer, number> = { drone: 1, pad: 1, harp: 1, bass: 0, hand: 0, groove: 0, lead: 0, boss: 0 };
  if (scene === 'sabbath') return { ...t, harp: 0.5 };
  if (scene === 'chapel' || scene === 'victory') return { ...t, lead: 0.6 };
  const i = scene === 'boss' ? Math.max(intensity, 0.85) : scene === 'menu' ? Math.min(intensity, 0.5) : intensity;
  t.bass = i >= 0.25 ? 1 : 0;
  t.hand = i >= 0.25 && i <= 0.55 ? 1 : 0;
  t.groove = i > 0.55 ? 1 : 0;
  t.lead = i > 0.55 ? 1 : 0;
  t.boss = i >= 0.85 ? 1 : 0;
  t.pad = i < 0.25 || (preset.pad >= 0.5 && (t.boss === 0 || preset.pad >= 0.8)) ? 1 : 0;
  if (preset.heartbeat && i >= 0.12 && t.groove === 0) t.hand = 1; // Szeol: the heart beats even when calm
  return t;
}

interface Ramp { from: number; to: number }
type Ramps = Record<Layer, Ramp>;
const on = (r: Ramp): boolean => r.from > 0.01 || r.to > 0.01;
/**
 * A layer's loudness at grid step `i`: its ramp from the level at this bar line to the next.
 * Coming in, it starts a third of the way up (so the downbeat is heard); going out, it fades to
 * nothing by the next bar line.
 */
const level = (r: Ramp, i: number, steps: number): number =>
  r.to > r.from ? r.from + (r.to - r.from) * (0.3 + (0.7 * i) / steps) : r.from + ((r.to - r.from) * i) / steps;

const fold = (midi: number, lo: number, hi: number): number => {
  let m = midi;
  while (m > hi) m -= 12;
  while (m < lo) m += 12;
  return m;
};

/** Instrument ranges (MIDI), so developed motifs stay playable. */
const RANGE: Readonly<Partial<Record<Inst, readonly [number, number]>>> = {
  harp: [45, 91], flute: [55, 93], bass: [33, 55], shofar: [55, 76], stab: [55, 76], doum: [36, 47],
};

/** Everything a bar's parts need. */
interface Bar {
  start: number;
  step: number;
  steps: number;
  scale: readonly number[];
  root: number;
  ramps: Ramps;
  plan: BarPlan;
  section: Section;
  /** bar of the section, 0-based */
  index: number;
  calm: boolean;
  sabbath: boolean;
  realm: Realm;
}

const CHORD = [0, 4, 7, 9, 7, 4]; // root, fifth, octave, tenth (diatonic steps above the root)
const RUN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1];

/** The victory fanfare, s. */
export const STING_SECONDS = 4;

export class Arranger {
  piece: Piece;
  private form: Section[];
  private round = 0;
  private sectionIndex = 0;
  private barIndex = 0;
  private mood: MusicMood;
  private levels: Record<Layer, number> = { drone: 0, pad: 0, harp: 0, bass: 0, hand: 0, groove: 0, lead: 0, boss: 0 };
  /** the piece to switch to at the next bar line */
  private pending: Piece | null = null;
  private sting = false;
  private drone: { midi: number; level: number } | null = null;
  private pad: { lead: number; level: number } | null = null;
  /** the bar grid: start and length of the bar composed last */
  private barStart = 0;
  private barLength = 1;

  constructor(
    track: string,
    variation: number,
    mood: MusicMood,
    private readonly rng: Rng,
  ) {
    this.mood = mood;
    this.piece = makePiece(track, variation, mood.mode, mood.realm);
    this.form = makeForm(this.piece, 0);
  }

  get section(): Section {
    return this.form[this.sectionIndex];
  }

  /** The piece playing next: the pending one, else the current. */
  get upcoming(): Piece {
    return this.pending ?? this.piece;
  }

  /**
   * Records the mood; returns whether something must start soon (a new track, or the victory
   * fanfare). While another soundscape plays (`playing` false) it only follows along.
   */
  setMood(mood: MusicMood, variation: number, playing = true): 'track' | 'sting' | null {
    const was = sceneOf(this.mood);
    this.mood = mood;
    if (this.pending && this.pending.track !== this.piece.track && mood.track === this.piece.track) {
      this.pending = null; // back to the piece still playing before the switch came
    } else if (mood.track !== this.upcoming.track) {
      this.pending = makePiece(mood.track, variation, mood.mode, mood.realm);
      return 'track';
    }
    if (playing && sceneOf(mood) === 'victory' && was !== 'victory') {
      this.sting = true;
      return 'sting';
    }
    return null;
  }

  /** Moves to another variation of the current track (the player's "next track"). */
  change(variation: number): void {
    this.pending = makePiece(this.upcoming.track, variation, this.mood.mode, this.mood.realm);
  }

  /** The next bar line after `t` if it comes within `maxWait` s, else the next beat. */
  boundary(t: number, maxWait: number): number {
    const end = this.barStart + this.barLength;
    if (end - t <= maxWait) return Math.max(t, end);
    const { meter, step } = this.piece;
    for (let bar = this.barStart; ; bar += this.barLength) {
      for (const beat of meter.beats) if (bar + beat * step >= t) return bar + beat * step;
    }
  }

  /** Everything was silenced from outside (a stop): take the held notes up afresh, the layers ramping in again. */
  silence(): void {
    this.drone = null;
    this.pad = null;
    this.sting = false;
    for (const layer of LAYERS) this.levels[layer] = 0;
  }

  key(): Key {
    return { tonic: this.piece.tonic + 12, scale: this.levels.boss > 0 ? this.piece.dark : this.piece.scale };
  }

  /** Composes the bar beginning at `start`; returns where the next one begins. */
  compose(start: number, push: (cue: Cue) => void): number {
    if (this.pending) this.switchPiece(start, push);
    if (this.sting) return this.fanfare(start, push);
    const { piece } = this;
    const section = this.section;
    const plan = section.bars[this.barIndex];
    const steps = piece.meter.steps;
    this.barStart = start;
    this.barLength = steps * piece.step;
    const scene = sceneOf(this.mood);
    const targets = layerTargets(scene, this.mood.intensity, piece.preset);
    this.shape(targets, section, this.barIndex, scene);
    const ramps = this.ramp(targets);
    const scale = ramps.boss.to > 0 ? piece.dark : piece.scale;
    const bar: Bar = {
      start, step: piece.step, steps, scale, root: hasFifth(scale, plan.root) ? plan.root : 0, ramps, plan, section, index: this.barIndex,
      calm: CALM_SCENES.has(scene) || (ramps.hand.to === 0 && ramps.groove.to === 0 && ramps.bass.to === 0), sabbath: scene === 'sabbath',
      realm: this.mood.realm,
    };
    this.holdDrone(bar, push);
    this.holdPad(bar, push);
    this.harp(bar, push);
    this.melody(bar, push);
    this.bass(bar, push);
    this.drums(bar, push);
    this.horns(bar, push);
    this.advance();
    return start + this.barLength;
  }

  /** The intro builds up; a breakdown drops the drums (not in a boss fight); the lead waits for its cue. */
  private shape(t: Record<Layer, number>, section: Section, index: number, scene: MusicScene): void {
    if (section.kind === 'intro') {
      if (index < 2) t.bass = t.hand = t.groove = 0;
      if (index < 4) t.groove = 0;
      t.lead = 0;
    } else if (section.kind === 'breakdown' && scene !== 'boss') {
      if (t.groove) t.hand = 1;
      t.groove = 0;
    }
  }

  /** Moves each layer toward its target, one step per bar line: in over two bars, out over one. */
  private ramp(targets: Record<Layer, number>): Ramps {
    const ramps = {} as Ramps;
    for (const layer of LAYERS) {
      const from = this.levels[layer];
      const target = targets[layer];
      const to = target > from ? Math.min(target, from + 0.55) : Math.max(target, from - 1);
      ramps[layer] = { from, to };
      this.levels[layer] = to;
    }
    return ramps;
  }

  private advance(): void {
    if (++this.barIndex < this.section.bars.length) return;
    this.barIndex = 0;
    if (++this.sectionIndex < this.form.length) return;
    this.sectionIndex = 0;
    this.form = makeForm(this.piece, ++this.round); // a new round: the same motif, arranged anew
  }

  /** Releases the old piece's held notes (a crossfade) and starts the new piece from its intro. */
  private switchPiece(start: number, push: (cue: Cue) => void): void {
    this.releaseHeld(start, 0.6, push);
    this.piece = this.pending!;
    this.pending = null;
    this.form = makeForm(this.piece, 0);
    this.round = this.sectionIndex = this.barIndex = 0;
    for (const layer of LAYERS) this.levels[layer] = 0;
    this.sting = false;
  }

  private releaseHeld(at: number, tau: number, push: (cue: Cue) => void): void {
    if (this.drone) push({ kind: 'release', at, id: 'drone', tau });
    if (this.pad) for (const part of ['low', 'lead'] as const) push({ kind: 'rest', at, part, release: tau * 1.4, breath: false });
    this.drone = null;
    this.pad = null;
  }

  // ─── the parts ─────────────────────────────────────────────────────

  private note(push: (cue: Cue) => void, at: number, inst: Inst, midi: number, lvl: number, dur?: number): void {
    if (lvl < 0.02) return;
    const range = RANGE[inst];
    const cue: InstCue = { kind: 'inst', at, inst, midi: range ? fold(midi, range[0], range[1]) : midi, level: Math.min(1, lvl) };
    if (dur !== undefined) cue.dur = dur;
    push(cue);
  }

  /** Time of grid step `i` (swing delays the off-beat sixteenths), never earlier than written. */
  private time(bar: Bar, i: number, jitter: number): number {
    const swing = i % 2 === 1 ? this.piece.preset.swing * bar.step : 0;
    return bar.start + i * bar.step + swing + this.rng.range(0, jitter);
  }

  /** The drone on the tonic, two octaves below the melody (one in Heaven): louder when calm, a little heavier in a boss fight. */
  private holdDrone(bar: Bar, push: (cue: Cue) => void): void {
    const r = bar.ramps.drone;
    const lvl = r.to * (bar.calm ? 0.55 : 0.45) * (bar.ramps.boss.to > 0 ? 1.15 : 1);
    const midi = droneMidi(this.piece, bar.realm);
    if (lvl < 0.01) {
      if (this.drone) push({ kind: 'release', at: bar.start, id: 'drone', tau: 0.5 });
      this.drone = null;
      return;
    }
    if (this.drone && this.drone.midi === midi && Math.abs(this.drone.level - lvl) < 0.03) return;
    const tau = this.drone ? this.barLength / 3 : 1.2;
    push({ kind: 'hold', at: bar.start, id: 'drone', inst: 'drone', midi, level: lvl, tau, colour: bar.realm });
    this.drone = { midi, level: lvl };
  }

  /** The choir's "ooh": the low singers hold the tonic, the upper ones the fifth of the chord root. */
  private holdPad(bar: Bar, push: (cue: Cue) => void): void {
    const r = bar.ramps.pad;
    const lvl = r.to * (bar.calm ? 0.3 : 0.2) * (bar.realm === 'heaven' ? 1.15 : 1);
    if (lvl < 0.02) {
      if (this.pad) for (const part of ['low', 'lead'] as const) push({ kind: 'rest', at: bar.start, part, release: 0.8, breath: false });
      this.pad = null;
      return;
    }
    const base = this.piece.tonic - 12;
    const lead = fold(degreeMidi(base, bar.scale, bar.root + 4), 52, 66);
    if (this.pad && this.pad.lead === lead && Math.abs(this.pad.level - lvl) < 0.04) return;
    const vowel = bar.calm ? 'u' : 'o';
    const tie = this.pad !== null;
    const sing = (part: Part, midi: number, l: number): NoteCue => ({ kind: 'note', at: bar.start, part, midi, dur: 2 * this.barLength, vowel, level: l, voices: 2, tie });
    push(sing('low', base, lvl));
    push(sing('lead', lead, 0.8 * lvl));
    this.pad = { lead, level: lvl };
  }

  /**
   * The kinnor. With the lead layer up it plays its line (the melody, or the answers when the
   * flute leads) over a thinned figure; otherwise it traces the motif's long notes over its
   * accompaniment figure — or, when calm, over a few notes per bar.
   */
  private harp(bar: Bar, push: (cue: Cue) => void): void {
    const r = bar.ramps.harp;
    if (!on(r)) return;
    if (on(bar.ramps.lead) && !bar.calm) {
      const line = this.piece.preset.lead === 'harp' ? bar.plan.lead : bar.plan.alt;
      if (line) this.line(bar, line, 'harp', 0.62, bar.ramps.lead, push);
      this.figure(bar, line ? 0.5 : 1, push);
      return;
    }
    const outline = bar.plan.lead ?? bar.plan.alt;
    const every = bar.sabbath ? 4 : bar.calm ? 2 : 1;
    if (outline && bar.index % every === 0) this.line(bar, outline, 'harp', 0.5, r, push, true);
    if (bar.calm) {
      this.sparse(bar, push);
      if (bar.plan.fill) this.glissando(bar, push);
    } else {
      this.figure(bar, outline ? 0.6 : 1, push);
    }
  }

  /**
   * A melody line: ornaments become quick neighbour notes (a mordent, a grace note from above).
   * `sparse`: only its long notes, each held to the next (the calm variants).
   */
  private line(bar: Bar, line: Line, inst: Inst, gain: number, r: Ramp, push: (cue: Cue) => void, sparse = false): void {
    const base = this.piece.tonic + 12 * line.oct - (bar.realm === 'hell' && inst === 'flute' ? 12 : 0);
    let notes = line.notes;
    if (sparse) {
      const kept = notes.filter(n => n.len >= 4 || n.at === 0);
      notes = kept.map((n, i) => ({ ...n, len: (kept[i + 1]?.at ?? bar.steps) - n.at, orn: 0 as const }));
    }
    const legato = inst === 'flute';
    for (const n of notes) {
      const t = this.time(bar, n.at, legato ? 0.01 : 0.006);
      const dur = n.len * bar.step;
      const vel = gain * level(r, n.at, bar.steps) * (n.at === 0 ? 1 : 0.9);
      const midi = degreeMidi(base, bar.scale, n.deg);
      const upper = degreeMidi(base, bar.scale, n.deg + 1);
      const quick = Math.min(0.07, dur / 4);
      if (n.orn === 1 && dur > 0.3) {
        this.note(push, t, inst, midi, vel, legato ? quick : undefined);
        this.note(push, t + quick, inst, upper, 0.75 * vel, legato ? quick : undefined);
        this.note(push, t + 2 * quick, inst, midi, 0.9 * vel, legato ? 0.98 * dur - 2 * quick : undefined);
      } else if (n.orn === 2 && dur > 0.2) {
        this.note(push, t, inst, upper, 0.7 * vel, legato ? quick : undefined);
        this.note(push, t + quick, inst, midi, vel, legato ? 0.98 * dur - quick : undefined);
      } else {
        this.note(push, t, inst, midi, vel, legato ? 0.98 * dur : undefined);
      }
    }
  }

  /** The accompaniment figure in the section's style, about the chord root an octave below the melody. */
  private figure(bar: Bar, gain: number, push: (cue: Cue) => void): void {
    const { steps, scale, root, section } = bar;
    const beats = this.piece.meter.beats;
    const boss = on(bar.ramps.boss);
    const style: HarpStyle = boss ? 'run' : section.harp;
    const density = boss ? 1 : section.density;
    const isBeat = (i: number): boolean => beats.includes(i);
    const hits: [step: number, deg: number, accent: number][] = [];
    switch (style) {
      case 'arp':
        for (let i = 0, k = 0; i < steps; i += 2, k++) hits.push([i, CHORD[k % CHORD.length], isBeat(i) ? 1 : 0.75]);
        break;
      case 'broken':
        beats.forEach((b, g) => {
          const end = beats[g + 1] ?? steps;
          const tones = end - b >= 6 ? [0, 4, 7] : [0, 7];
          tones.forEach((d, j) => {
            if (b + 2 * j < end) hits.push([b + 2 * j, j === 0 && g > 0 ? 4 : d + (g % 2 && j > 0 ? 2 : 0), j === 0 ? 1 : 0.7]);
          });
        });
        break;
      case 'pulse':
        for (let i = 0; i < steps; i += 2) {
          if (isBeat(i)) hits.push([i, 0, 1], [i, 4, 0.8]);
          else hits.push([i, 7, 0.6]);
        }
        if (density > 0.7) for (const b of beats) if (b > 0) hits.push([b - 1, 7, 0.45]);
        break;
      case 'run': {
        const by = density >= 0.6 ? 1 : 2;
        for (let i = 0, k = 0; i < steps; i += by, k++) hits.push([i, RUN[k % RUN.length], isBeat(i) ? 1 : 0.7]);
        break;
      }
    }
    const base = this.piece.tonic - 12;
    // damped a little, like a player's palm: a clear figure, and fewer voices ringing at once
    const dur = style === 'run' ? 2.5 * bar.step : Math.max(0.3, 5 * bar.step);
    for (const [i, d, accent] of hits) {
      if (!isBeat(i) && density < 0.5 && (density < 0.3 || this.rng.chance(0.5))) continue;
      this.note(push, this.time(bar, i, 0.006), 'harp', degreeMidi(base, scale, root + d), 0.5 * gain * accent * level(bar.ramps.harp, i, steps), dur);
    }
  }

  /** Calm: the root on the downbeat (not always, on the Sabbath) and a chord tone or two later on. */
  private sparse(bar: Bar, push: (cue: Cue) => void): void {
    const { steps, scale, root } = bar;
    const r = bar.ramps.harp;
    const base = this.piece.tonic - 12;
    if (this.rng.chance(bar.sabbath ? 0.45 : 0.9)) this.note(push, this.time(bar, 0, 0.01), 'harp', degreeMidi(base, scale, root), 0.5 * level(r, 0, steps));
    const extra = bar.sabbath ? Number(this.rng.chance(0.35)) : this.rng.int(1, 2);
    for (let e = 0; e < extra; e++) {
      const i = 2 * this.rng.int(1, steps / 2 - 1);
      const d = this.rng.pick([4, 7, 9, 11]) + (bar.realm === 'heaven' && this.rng.chance(0.3) ? 7 : 0);
      this.note(push, this.time(bar, i, 0.01), 'harp', degreeMidi(base, scale, root + d), 0.38 * level(r, i, steps));
    }
  }

  /** A soft rising harp run over the last beat: the calm variant's "fill". */
  private glissando(bar: Bar, push: (cue: Cue) => void): void {
    const from = this.piece.meter.beats.at(-1) ?? 0;
    const base = this.piece.tonic - 12;
    for (let i = from, d = 0; i < bar.steps; i++, d++) {
      this.note(push, this.time(bar, i, 0.004), 'harp', degreeMidi(base, bar.scale, bar.root + 7 + d), 0.28 * level(bar.ramps.harp, i, bar.steps));
    }
  }

  /** The flute: the lead melody (or its answers to the harp); in the calm scenes the motif's long notes, softly. */
  private melody(bar: Bar, push: (cue: Cue) => void): void {
    const r = bar.ramps.lead;
    if (!on(r)) return;
    const line = this.piece.preset.lead === 'flute' ? bar.plan.lead : bar.plan.alt;
    if (!line) return;
    if (bar.calm) {
      if (bar.index % 2 === 0) this.line(bar, line, 'flute', 0.55, r, push, true);
    } else {
      this.line(bar, line, 'flute', 0.75, r, push);
    }
  }

  /** The bass string on the groove's doums (or the strong beats): root, then fifth and octave. */
  private bass(bar: Bar, push: (cue: Cue) => void): void {
    const r = bar.ramps.bass;
    if (!on(r)) return;
    const { steps, scale, root, section } = bar;
    const beats = this.piece.meter.beats;
    let hits = on(bar.ramps.groove)
      ? [...section.groove].flatMap((c, i) => (c === 'D' || c === 'd' ? [i] : []))
      : [0, beats[Math.floor(beats.length / 2)]];
    if (on(bar.ramps.boss)) hits = [...new Set([...hits, ...beats])].sort((a, b) => a - b);
    if (!hits.includes(0)) hits.unshift(0);
    const base = this.piece.tonic - 24;
    const cycle = [0, 4, 7, 4];
    hits.forEach((i, k) => {
      const next = hits[k + 1] ?? steps;
      const soft = section.groove[i] === 'd' ? 0.65 : 1;
      this.note(push, this.time(bar, i, 0.004), 'bass', degreeMidi(base, scale, root + cycle[k % cycle.length]), 0.8 * soft * level(r, i, steps), Math.max(0.2, (next - i) * bar.step));
    });
  }

  /** Frame drum, tambourine and finger cymbals: the groove or light hand strokes, heavier for a boss, a fill at the section's end. */
  private drums(bar: Bar, push: (cue: Cue) => void): void {
    const { steps, section, plan } = bar;
    const preset = this.piece.preset;
    const beats = this.piece.meter.beats;
    const groove = on(bar.ramps.groove);
    const hand = !groove && on(bar.ramps.hand);
    const boss = on(bar.ramps.boss);
    if (groove || hand) {
      const r = groove ? bar.ramps.groove : bar.ramps.hand;
      let pattern = preset.heartbeat ? (groove ? preset.alt : preset.groove) : section.groove;
      if (boss) pattern = this.heavier(pattern, beats);
      const until = plan.fill ? (beats.at(-1) ?? steps) : steps;
      for (let i = 0; i < until; i++) {
        const stroke = STROKES[pattern[i]];
        if (!stroke) continue;
        const [inst, v] = stroke;
        if (hand && inst === 'doum' && i !== 0 && !preset.heartbeat) continue; // light: rim strokes over one soft doum
        const accent = i === 0 ? 1.1 : beats.includes(i) ? 1 : 0.9;
        this.note(push, this.time(bar, i, 0.004), inst, this.piece.tonic - 24, v * accent * (hand ? 0.6 : 1) * level(r, i, steps));
      }
      if (plan.fill) this.fill(bar, plan.fill, until, r, push);
      this.jingles(bar, groove, boss, until, r, push);
    }
    // finger cymbals: opening a section; now and then in the groove; every bar in a boss fight
    const zil = preset.zil * (bar.realm === 'heaven' ? 1.2 : bar.realm === 'hell' ? 0.5 : 1);
    const zr = groove ? bar.ramps.groove : bar.ramps.harp;
    if (bar.index === 0 && (groove || hand || this.rng.chance(0.6))) this.note(push, this.time(bar, 0, 0.003), 'zil', 0, 0.6 * zil * level(zr, 0, steps));
    else if (boss || (groove && bar.index % 4 === 2 && this.rng.chance(zil))) this.note(push, this.time(bar, 0, 0.003), 'zil', 0, 0.45 * zil * level(zr, 0, steps));
  }

  /** The boss groove: a doum on every beat, ghost strokes in between. */
  private heavier(pattern: string, beats: readonly number[]): string {
    return [...pattern].map((c, i) => {
      if (beats.includes(i)) return 'D';
      if (c !== '.') return c;
      return i % 2 ? (this.rng.chance(0.55) ? 'k' : '.') : 't';
    }).join('');
  }

  private fill(bar: Bar, fill: Fill, from: number, r: Ramp, push: (cue: Cue) => void): void {
    const { steps } = bar;
    const span = Math.max(1, steps - from);
    const hit = (i: number, inst: Inst, v: number, early = 0): void => {
      this.note(push, Math.max(bar.start, this.time(bar, i, 0.003) - early), inst, this.piece.tonic - 24, v * level(r, i, steps));
    };
    switch (fill) {
      case 'roll':
        for (let i = from; i < steps; i++) hit(i, i % 2 ? 'ka' : 'tek', 0.4 + (0.5 * (i - from)) / span);
        break;
      case 'doums':
        for (let i = from; i < steps; i += 2) hit(i, 'doum', 0.7 + (0.25 * (i - from)) / span);
        break;
      case 'flam':
        for (let i = from; i < steps; i += 2) {
          hit(i, 'ka', 0.35, 0.03);
          hit(i, 'tek', 0.8);
        }
        hit(steps - 2, 'shake', 0.6);
        break;
      case 'break': // the bar falls silent; one doum leads into the next
        hit(steps - 1, 'doum', 0.8);
        break;
      case 'shake':
        hit(from, 'shake', 0.7);
        hit(from, 'doum', 0.7);
        break;
      case 'call':
        for (const [o, inst, v] of [[0, 'tek', 0.8], [1, 'ka', 0.5], [2, 'tek', 0.8], [4, 'doum', 0.9]] as const) if (from + o < steps) hit(from + o, inst, v);
        break;
    }
  }

  /** Tambourine on the eighths (on the beats when light); in a boss fight a roll before some beats. */
  private jingles(bar: Bar, groove: boolean, boss: boolean, until: number, r: Ramp, push: (cue: Cue) => void): void {
    const amount = this.piece.preset.jingle * (bar.realm === 'hell' ? 0.6 : 1);
    if (amount < 0.05) return;
    const beats = this.piece.meter.beats;
    for (let i = 0; i < until; i += 2) {
      const beat = beats.includes(i);
      if (!beat && (!groove || (bar.section.density < 0.5 && i % 4 !== 0))) continue;
      this.note(push, this.time(bar, i, 0.005), 'jingle', 0, (beat ? 0.55 : 0.32) * amount * (groove ? 1 : 0.7) * level(r, i, bar.steps));
    }
    if (boss) {
      for (const b of beats) if (b > 0 && b - 2 < until && this.rng.chance(0.5)) this.note(push, this.time(bar, b - 2, 0.004), 'shake', 0, 0.45 * amount * level(r, b, bar.steps));
    }
  }

  /** The shofar: a long call as a boss fight begins, then blasts every other bar; now and then a call to open a climax. */
  private horns(bar: Bar, push: (cue: Cue) => void): void {
    const r = bar.ramps.boss;
    const tonic = this.piece.tonic - (bar.realm === 'hell' ? 12 : 0);
    if (on(r)) {
      if (r.from === 0) {
        this.note(push, bar.start, 'shofar', tonic, 0.85, Math.min(1.6, 0.9 * this.barLength));
      } else if (bar.index % 2 === 0) {
        this.note(push, this.time(bar, 0, 0.003), 'stab', bar.index % 4 === 0 ? tonic : tonic + 7, 0.75);
        const beats = this.piece.meter.beats;
        if (this.rng.chance(0.4)) this.note(push, this.time(bar, beats[Math.floor(beats.length / 2)], 0.003), 'stab', tonic, 0.6);
      }
      return;
    }
    const { preset } = this.piece;
    const opens = bar.section.kind === 'climax' || (bar.section.kind === 'A' && preset.shofar >= 0.5);
    if (bar.index === 0 && !bar.calm && opens && this.rng.chance(preset.shofar)) {
      this.note(push, bar.start, 'shofar', tonic + 7, 0.6, Math.min(1.5, 0.75 * this.barLength));
    }
  }

  // ─── stings ────────────────────────────────────────────────────────

  /** Victory: shofar calls (short, short, long a fifth higher) over a rising harp run and a rolled chord; then the calm variant. */
  private fanfare(start: number, push: (cue: Cue) => void): number {
    this.sting = false;
    const { tonic, scale } = this.piece;
    const base = tonic - 12;
    const chord = start + 2.1;
    this.note(push, start, 'stab', tonic, 0.8);
    this.note(push, start + 0.32, 'stab', tonic, 0.75);
    this.note(push, start + 0.7, 'shofar', tonic + 7, 0.85, 2.2);
    this.note(push, start, 'doum', tonic - 24, 0.8);
    this.note(push, start + 0.7, 'doum', tonic - 24, 0.6);
    for (let d = 0; d <= 9; d++) this.note(push, start + 0.7 + 0.075 * d, 'harp', degreeMidi(base, scale, d), 0.32 + 0.03 * d);
    [0, 4, 7, 9, 11, 14].forEach((d, j) => this.note(push, chord + 0.035 * j, 'harp', degreeMidi(base, scale, d), 0.55));
    this.note(push, chord - 0.2, 'shake', 0, 0.5);
    this.note(push, chord, 'doum', tonic - 24, 0.95);
    this.note(push, chord, 'zil', 0, 0.7);
    if (this.piece.preset.lead === 'flute') this.note(push, chord, 'flute', tonic + 12, 0.6, 1.6);
    // the drone swells; the choir holds an open chord, with the third where the mode's is major
    const drone = droneMidi(this.piece, this.mood.realm);
    push({ kind: 'hold', at: start, id: 'drone', inst: 'drone', midi: drone, level: 0.6, tau: 0.4, colour: this.mood.realm });
    this.drone = { midi: drone, level: 0.6 };
    const upper = fold(degreeMidi(base, scale, scale[2] === 4 ? 2 : 4), 52, 66);
    const tie = this.pad !== null;
    push({ kind: 'note', at: chord, part: 'low', midi: base, dur: 3, vowel: 'a', level: 0.32, voices: 2, tie });
    push({ kind: 'note', at: chord, part: 'lead', midi: upper, dur: 3, vowel: 'a', level: 0.28, voices: 2, tie });
    this.pad = { lead: upper, level: 0.32 };
    // drums, bass and the lead come back only through the calm variant's ramps
    for (const layer of ['bass', 'hand', 'groove', 'lead', 'boss'] as const) this.levels[layer] = 0;
    this.barStart = start;
    this.barLength = STING_SECONDS;
    return start + STING_SECONDS;
  }

  /**
   * "Veni Creator" for the soundtrack: in mode 8, as the hymn is, about half a minute of a calm
   * harp and the choir's ooh over the drone, the flute singing a phrase in the hymn's manner.
   * Then the current piece begins again from its intro.
   */
  invocation(start: number, push: (cue: Cue) => void): number {
    const scale = modeScale(8);
    const tonic = 67; // G4, the final of mode 8
    const step = 60 / 66 / 4;
    const steps = 16;
    const roots = [0, 0, 3, 0, 3, 6, 0, 0];
    push({ kind: 'hold', at: start, id: 'drone', inst: 'drone', midi: tonic - 12, level: 0.5, tau: 1.5, colour: 'heaven' });
    push({ kind: 'inst', at: start, inst: 'zil', midi: 0, level: 0.45 });
    roots.forEach((root, b) => {
      const t0 = start + b * steps * step;
      const lead = fold(degreeMidi(tonic - 12, scale, root + 4), 52, 66);
      push({ kind: 'note', at: t0, part: 'low', midi: tonic - 12, dur: 2 * steps * step, vowel: 'u', level: 0.28, voices: 2, tie: b > 0 });
      push({ kind: 'note', at: t0, part: 'lead', midi: lead, dur: 2 * steps * step, vowel: 'u', level: 0.22, voices: 2, tie: b > 0 });
      [0, 4, 7, 9].forEach((d, j) => this.note(push, t0 + 4 * j * step + this.rng.range(0, 0.01), 'harp', degreeMidi(tonic - 12, scale, root + d), j === 0 ? 0.5 : 0.36));
      const phrase = VENI[b];
      if (phrase) {
        let at = 0;
        for (const [deg, len] of phrase) {
          this.note(push, t0 + at * step, 'flute', degreeMidi(tonic, scale, deg), 0.5, 0.97 * len * step);
          at += len;
        }
      }
    });
    const end = start + roots.length * steps * step;
    [0, 4, 7, 9, 11].forEach((d, j) => this.note(push, end - 4 * step + 0.04 * j, 'harp', degreeMidi(tonic - 12, scale, d), 0.4));
    this.drone = { midi: tonic - 12, level: 0.5 };
    this.pad = { lead: fold(degreeMidi(tonic - 12, scale, 4), 52, 66), level: 0.28 };
    this.form = makeForm(this.piece, 0);
    this.round = this.sectionIndex = this.barIndex = 0;
    for (const layer of LAYERS) this.levels[layer] = layer === 'drone' || layer === 'pad' || layer === 'harp' ? 1 : 0;
    this.barStart = start;
    this.barLength = end - start;
    return end;
  }
}

/** Frame-drum strokes: the groove characters, with their loudness. */
const STROKES: Readonly<Record<string, readonly [Inst, number] | undefined>> = {
  D: ['doum', 0.75], d: ['doum', 0.45], T: ['tek', 0.75], t: ['tek', 0.45], k: ['ka', 0.4],
};

/** A phrase in the manner of the hymn (mode 8: from the final G up to the reciting tone C and back), [degree, steps] per bar. */
const VENI: readonly (readonly (readonly [number, number])[] | null)[] = [
  null,
  [[0, 4], [1, 4], [3, 4], [3, 4]],
  [[4, 4], [3, 2], [2, 2], [3, 8]],
  [[3, 4], [2, 4], [1, 4], [0, 4]],
  [[1, 4], [-1, 4], [0, 8]],
  [[3, 4], [4, 4], [5, 4], [4, 4]],
  [[3, 6], [2, 2], [1, 4], [-1, 4]],
  [[0, 16]],
];

/**
 * Every note a piece may need, roughly in the order it first needs them: for rendering ahead.
 * `dark`: also the boss variant's scale (when a boss fight is near).
 */
export function palette(piece: Piece, realm: Realm, dark = false): NoteSpec[] {
  const { tonic } = piece;
  const low = realm === 'hell' ? 12 : 0;
  const out: NoteSpec[] = [];
  const add = (inst: Inst, midi: number): void => {
    const range = RANGE[inst];
    const m = range ? fold(midi, range[0], range[1]) : midi;
    if (!out.some(([i, n]) => i === inst && n === m)) out.push([inst, m, realm]);
  };
  add('drone', droneMidi(piece, realm));
  add('doum', tonic - 24);
  for (const inst of ['tek', 'ka', 'jingle', 'zil'] as const) add(inst, 0);
  for (const scale of dark ? [piece.scale, piece.dark] : [piece.scale]) {
    for (let d = 0; d <= 11; d++) add('harp', degreeMidi(tonic - 12, scale, d));
    for (const root of [0, ...piece.colours, piece.half]) for (const d of [0, 4, 7]) add('bass', degreeMidi(tonic - 24, scale, root + d));
    for (let d = -4; d <= 9; d++) add('flute', degreeMidi(tonic - low, scale, d));
    for (let d = 5; d <= 16; d++) add('harp', degreeMidi(tonic, scale, d)); // the harp's melody register
  }
  add('shake', 0);
  for (const inst of ['stab', 'shofar'] as const) for (const m of [tonic, tonic + 7]) add(inst, m - low);
  return out;
}

/** The drone's note: the tonic two octaves below the melody; in Heaven one octave, brighter. */
export const droneMidi = (piece: Piece, realm: Realm): number => piece.tonic - (realm === 'heaven' ? 12 : 24);
