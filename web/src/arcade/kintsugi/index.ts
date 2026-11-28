/**
 * Złote serce (Golden Heart · Goldenes Herz · Det gyllene hjärtat): a kintsugi meditation of the series "Serce i
 * światło" (DESIGN.md §21), rooted in Psalm 147:3 — "He heals the brokenhearted and binds up their wounds".  The heart
 * lies broken on a dark cloth, its pieces stained with soot and ink-like stains of pain.  Piece by piece, hands of light
 * lift each one out of the dark while the player's focus holds; in rest, light like clear water washes it and the soot
 * and the word of pain dissolve into motes that turn to light; held focus carries it home.  What the session's time
 * does not allow, the Lord gathers Himself.  Then focus pours molten gold along the cracks — kintsugi: the cracks are
 * not hidden, they become the most beautiful part —, the heart begins to beat (at the player's pulse when the band
 * reads it), turns to gold as far as the gold poured, and shines: purity, joy, love.  A blessing and a closing word.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts on the plan in rules.ts; the
 * content in content.ts; the progress in meta.ts; the narrator in talk.ts; the geometry in heart.ts), the picture
 * (render.ts on layout.ts, paint.ts and hands.ts; preview.ts for the lobby and the cards), the lobby's card (panel.ts),
 * the music (music/index.ts: the ambient heart music and the YouTube tracks), the words (i18n.ts).
 */
import { BREATH_PRESETS, breathCycle, breathOk, type BreathPattern, type BreathState } from '../kit/breath';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { breathDial, secDial, type RhythmSpec } from '../kit/rhythm';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { breathWords, t, unit } from './i18n';
import { bestOf, freshProgress, migrate, type KintsugiProgress } from './meta';
import { SessionMusic, type MusicCue } from './music/index';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { KintsugiView } from './render';
import { RULES, readTime } from './rules';
import { KintsugiSim, type BlockKind, type Coach, type SimEvent } from './sim';

/** The breath of the last progress the module saw (the how-to and the rhythm's rest dial name it). */
let knownBreath: BreathPattern | null = null;
const seen = (p: KintsugiProgress): KintsugiProgress => {
  knownBreath = p.breath;
  return p;
};

class KintsugiGame implements ArcadeGame {
  private readonly sim: KintsugiSim;
  private readonly view: KintsugiView;
  private readonly music: SessionMusic;
  private readonly tracks: boolean;
  private now = 0;
  private readonly hints: Coach[] = [];
  private hintCool = 2;
  private cardWas = false;

  constructor(private readonly env: GameEnv<KintsugiProgress>) {
    seen(migrate(env.progress));
    this.sim = new KintsugiSim({
      progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, rhythm: env.rhythm ?? null, day: env.day,
    });
    const m = env.progress.music;
    this.music = new SessionMusic(env as unknown as GameEnv<object>, m);
    // the player card's place is kept free only when a track will play this session (the music's plan has one)
    const plan = (this.music as unknown as { plan?: unknown }).plan;
    this.tracks = m.mode === 'tracks' && m.youtube && plan !== null;
    this.view = new KintsugiView(env.canvas, this.sim.geo, { reducedMotion: env.reducedMotion, touch: env.touch, seed: Math.floor(env.rng() * 1e9), tracks: this.tracks });
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) Object.assign(globalThis, { __kintsugi: this.sim, __kintsugiView: this.view, __kintsugiMusic: this.music });
  }

  resize(w: number, h: number, dpr: number): void {
    this.view.resize(w, h, dpr, this.env.insets());
    this.music.place(this.tracks ? this.view.musicRect : null, this.tracks ? this.view.musicRect2 : null);
  }

  /** The calibration's scene: the night, the cloth, the heart broken on it. */
  intro(dt: number): void {
    this.view.update(dt, this.sim);
    this.view.draw(this.sim, true);
  }

  start(): void {
    this.sim.start();
    this.music.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    this.sim.setPulse(this.env.body?.().heartRate ?? null);
    this.sim.update(dt, f, t);
    this.drain();
    const card = this.tracks && this.music.now.show;
    // a coach mark still up when a track's card appears is hidden: nothing may lie over YouTube's player
    if (card && !this.cardWas && this.now < this.sim.hintUntil) {
      this.env.hint('');
      this.sim.hintUntil = this.now;
    }
    this.cardWas = card;
    this.view.setCard(card);
    this.view.update(dt, this.sim);
    const s = this.sim;
    this.music.update(t, dt, { stage: s.stage, light: s.light, rest: s.restBlock });
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void {
    this.view.draw(this.sim);
  }

  /** A tap: on the 0–10 row answers "how do you feel now"; anywhere else the words glow again — never light. */
  pointer(e: PointerInput): void {
    const sim = this.sim, v = this.view;
    if (!this.env.touch) this.env.canvas.style.cursor = v.hover(sim, e.x, e.y) ? 'pointer' : '';
    if (e.type !== 'down') return;
    const n = v.rateAt(sim, e.x, e.y);
    if (n >= 0) {
      sim.rate10(n);
      if (this.env.haptics) buzz(8);
    } else sim.stay();
    this.drain();
  }

  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      const cue = cueOf(e);
      if (cue) this.music.cue(cue);
      if (e.type === 'coach') this.hints.push(e.what);
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark: one at a time, never over a telegraph or the banner; it waits while the narrator speaks. */
  private flushHints(): void {
    const sim = this.sim;
    while (this.hints.length && !hintFits(this.hints[0], sim)) this.hints.shift();
    if (!this.hints.length || this.hintCool > 0) return;
    // nothing over YouTube's player: a first-time mark waits while a track's card is up (and is dropped if its moment passes)
    if (this.tracks && this.music.now.show) return;
    if (sim.telegraphed || sim.blockT < RULES.bannerSec) return;
    if (sim.talk.line) return;
    const what = this.hints.shift()!;
    const text = sim.coachWords(what, this.env.touch);
    const ms = Math.round(readTime(text) * 1000);
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    this.env.hint(text, null, ms);
  }

  padLevel(): number | null { return this.sim.padLevel(); }

  canStop(): boolean { return this.sim.canStop() && this.music.canStop(); }

  pause(on: boolean): void { this.music.pause(on); }

  /** What the block asks of the brain: lifting, laying and pouring are focus; washing, the beat and the radiance are rest. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    const phaseOf = (k: BlockKind | null) => (k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free');
    const left = s.started && Number.isFinite(b.dur) ? Math.max(0, b.dur - s.blockT) : undefined;
    if (!s.started || b.kind === 'free') return { want: 'free', blind: false, task: s.started ? s.tip : undefined, left };
    return { want: b.kind === 'push' ? 'focus' : 'rest', blind: false, task: s.tip, left, next: s.telegraphed ? phaseOf(s.nextKind) : null };
  }

  meter(): number | null { return this.sim.meter(); }

  /** The breath the game guides (it draws its own guide: `ownBreath`). */
  breath(): BreathState | null { return this.sim.restBlock ? this.sim.breath : null; }

  headline(): Headline {
    const s = this.sim;
    const best = bestOf(s.p);
    const left = best !== null ? best - s.score : 0;
    if (s.stage === 'gold' && best !== null && left > 0 && left <= 3) return { value: s.score, sub: t('sub.best', { n: left }) };
    return { value: s.score, sub: s.subLine };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
    this.music.finish();
  }

  result(): ArcadeOutcome {
    const out = this.sim.result();
    const p = this.env.progress;
    p.music.recent = this.music.recentAfter();
    // the music's own line (its words: "2 utwory i muzyka tła", "muzyka tła", "cisza")
    out.stats.push(this.music.stat());
    return out;
  }

  targets(): TapTarget[] { return this.view.targets(this.sim); }

  destroy(): void {
    this.music.destroy();
    this.env.canvas.style.cursor = '';
  }
}

/** The music's small sound for a moment of the way. */
function cueOf(e: SimEvent): MusicCue | null {
  switch (e.type) {
    case 'lift': return 'lift';
    case 'cleaned': return 'clean';
    case 'placed': return 'place';
    case 'seam': return 'seam';
    case 'beat': return e.strong ? 'beat' : null;
    case 'quality': return 'bloom';
    default: return null;
  }
}

/** Whether a coach mark still fits the moment (it waited for a banner or the narrator). */
function hintFits(what: Coach, sim: KintsugiSim): boolean {
  switch (what) {
    case 'lift': return sim.block.what === 'move';
    case 'wash': return sim.block.what === 'wash';
    case 'gold': return sim.block.what === 'pour';
    default: return sim.stage === 'arrive' || sim.stage === 'gather';
  }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'placed': buzz(e.grace ? 6 : [10, 40, 14]); break;
    case 'seam': buzz(6); break;
    case 'gilded': buzz([12, 40, 12, 40, 20]); break;
    default: break;
  }
}

/**
 * The rest's rhythm in the lobby (kit/rhythm.ts): a lift-and-lay block's seconds (20 by design, 15–45; its lead-in
 * included — longer blocks fit fewer pieces) and a wash's whole breaths of the player's pattern (2 by design, 1–4; in a
 * session under 10 minutes the design washes in one breath).  The gold pours in pushes of the same length (≥ 25 s).
 */
export function kintsugiRhythm(p?: KintsugiProgress): RhythmSpec {
  const b = p ? migrate(p).breath : knownBreath ?? BREATH_PRESETS.even;
  const cyc = breathCycle(breathOk(b) ? b : BREATH_PRESETS.even);
  const F = RULES.focus, R = RULES.rest;
  return {
    focus: secDial(F.def, t('rhythm.focus'), { min: F.min, max: F.max, step: F.step }),
    rest: breathDial(R.def, t('rhythm.rest'), cyc, { min: R.min, max: R.max }),
    note: t('rhythm.note'),
    // no "about N rests" count: the receptive stages (the arrival, the beat, the radiance) are rests the dials do not set
    restSec: n => n * cyc,
  };
}

/** How to play, for the hand the player has: a tap on a phone; a click, Space and 0–9 on a desktop; the rest's breath. */
export function howto(touch = coarsePointer(), breath: BreathPattern | null = knownBreath): HowTo {
  const b = breath && breathOk(breath) ? breath : BREATH_PRESETS.even;
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t(touch ? 'howto.tap' : 'howto.click') },
      ...(touch ? [] : [{ gesture: 'keys' as const, text: t('howto.keys') }]),
    ],
    tips: [t('howto.tip1', { breath: breathWords(b) }), t('howto.tip2')],
  };
}

const mod: ArcadeModule<KintsugiProgress> = {
  freshProgress,
  create: env => new KintsugiGame(env),
  best: p => {
    seen(migrate(p));
    return bestOf(p);
  },
  unit,
  progressPanel: (p, save) => progressPanel(seen(migrate(p)), () => { seen(p); save(); }),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined),
  howto: () => howto(),
  rhythm: p => kintsugiRhythm(p),
  // the breath guide is the game's own (render.ts, kit/breathguide.ts): the runner shows no pacer over it
  ownBreath: true,
};
export default mod;
