/**
 * Pasterz (the shepherd): Crowd City on the Judean hills, after Luke 15:4-6.  After a spring storm
 * the village's sheep are scattered over the hills; the shepherd and five rival shepherd kids race
 * to gather the most.  Drag anywhere to walk (a floating joystick; arrows and WASD too); left alone,
 * Łatek the sheepdog leads the shepherd to the nearest loose sheep; a tap or Space whistles and
 * Łatek herds the sheep he reaches.  Loose sheep join whatever flock touches them, and where two
 * flocks meet the bigger wins the smaller one's sheep at the contact; a rival left alone sulks till
 * the round ends.  Rounds of two days and two nights on one hill, a live ranking, a crown for the
 * first, a lost lamb far away worth ten.  The band: in a Wołanie the call ring's radius is the
 * focus (a dotted circle marks the threshold, gold beyond it) and pulls loose sheep in, a held focus
 * sends the Głos across the hill; in a Nocna straż every flock beds down and calm lights stars, each
 * a straggler Łatek fetches.  The shepherd is the parable's man, not a picture of Christ.
 *
 * This module wires the parts to the arcade runner (kit/types.ts) and feeds its standard HUD
 * (signal, meter, headline, howto, coach marks): the rules (sim.ts on the hill of world.ts, the
 * numbers in rules.ts, the data in content.ts, the meta in meta.ts, Łatek's bubble in talk.ts),
 * the pictures (render.ts with ground.ts, hud.ts and layout.ts, intro.ts for calibration,
 * preview.ts for the lobby, all drawn with paint.ts), the sound (audio.ts) and the lobby's card
 * (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase } from '../kit/types';
import { PasterzSound } from './audio';
import { t, unit } from './i18n';
import { bestOf, freshProgress, type PasterzProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { PasterzView } from './render';
import { RULES } from './rules';
import { PasterzSim, type BlockKind, type SimEvent } from './sim';

const want = (k: BlockKind | undefined): 'focus' | 'rest' | 'free' => (k === 'call' ? 'focus' : k === 'watch' ? 'rest' : 'free');

class PasterzGame implements ArcadeGame {
  private readonly sim: PasterzSim;
  private readonly view: PasterzView;
  private readonly sound: PasterzSound;
  private touch: { id: number; x: number; y: number; at: number; moved: boolean } | null = null;
  private now = 0;

  constructor(private readonly env: GameEnv<PasterzProgress>) {
    this.sim = new PasterzSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new PasterzView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg' });
    this.sound = new PasterzSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __pasterz?: unknown }).__pasterz = this.sim;
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr, this.env.hudTop()); }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.sim.start();
    this.sound.start();
    this.view.start(this.sim);
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now += dt;
    if (!this.view.hitStop(dt)) {
      this.sim.update(dt, f, t);
      this.drain();
    }
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  /** (The runner also draws during calibration, after intro(): the intro scene stays until play begins.) */
  draw(): void { if (this.sim.started) this.view.draw(this.sim); }

  /** A drag anywhere is a floating joystick; a quick tap whistles for Łatek. */
  pointer(e: PointerInput): void {
    if (e.type === 'down') {
      this.touch = { id: e.id, x: e.x, y: e.y, at: this.now, moved: false };
      this.sim.drag(0, 0);
      return;
    }
    const tc = this.touch;
    if (!tc || tc.id !== e.id) return;
    const dx = e.x - tc.x, dy = e.y - tc.y;
    if (e.type === 'move') {
      if (Math.hypot(dx, dy) >= RULES.deadPx) tc.moved = true;
      this.sim.drag(dx, dy);
      this.view.stick = tc.moved ? { ox: tc.x, oy: tc.y, x: e.x, y: e.y } : null;
      return;
    }
    // up
    if (!tc.moved && this.now - tc.at <= RULES.tapSec + 0.25) {
      this.sim.whistle();
      this.drain();
    }
    this.sim.drag(null);
    this.view.stick = null;
    this.touch = null;
  }

  /** Arrows and WASD walk, Space and Enter whistle. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.sim.release();
      this.touch = null;
      this.view.stick = null;
    }
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (e.type === 'hint') this.hint(e);
      if (this.env.haptics) haptic(e);
    }
  }

  /** A coach mark pointing at the thing (kept inside the play room). */
  private hint(e: Extract<SimEvent, { type: 'hint' }>): void {
    const p = this.view.toScreen(e.x, e.y), L = this.view.L;
    const at = { x: Math.max(24, Math.min(L.w - 24, p.x)), y: Math.max(L.top + 40, Math.min(L.bottom - 30, p.y)) };
    this.env.hint(t(`hint.${e.key}` as 'hint.steer'), at, 4300);
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || !b) return { want: 'free', blind: false };
    const left = Math.max(0, b.dur - s.blockT);
    const next = s.telegraphing ? want(s.nextBlock?.kind) : null;
    if (b.kind === 'warmup') return { want: 'free', blind: false, left, next };
    return { want: want(b.kind), blind: s.blind, task: s.tip, left, next };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim;
    let sub: string;
    if (s.frozen || s.phase !== 'play') sub = t('sub.tally');
    else if (s.nightBlock) sub = t('sub.night', { n: s.stars });
    else sub = t('sub.place', { n: s.place, of: s.shepherds.length });
    return { value: s.score, sub };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { this.sim.release(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'herd': buzz(10); break;
    case 'steal': if (e.to === 0) buzz(4); break;
    case 'out': if (e.by === 0) buzz([20, 40, 30]); break;
    case 'tumble': buzz([30, 50, 30]); break;
    case 'voice': buzz([12, 30, 12, 30, 18]); break;
    case 'lambFound': buzz([20, 40, 20]); break;
    case 'crown': if (e.who === 0) buzz([10, 30, 10, 30, 24]); break;
    case 'roundEnd': buzz([10, 30, 10, 30, 24]); break;
    default: break;
  }
}

function howto(): HowTo {
  return {
    goal: t('how.goal'),
    hands: [
      { gesture: 'drag', text: t('how.drag') },
      { gesture: 'tap', text: t('how.tap') },
    ],
    tips: [t('how.tip1'), t('how.tip2')],
  };
}

const mod: ArcadeModule<PasterzProgress> = {
  freshProgress,
  create: env => new PasterzGame(env),
  best: p => (p.sessions > 0 ? bestOf(p) : null),
  unit,
  progressPanel: (p, save) => progressPanel(p, save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
  howto,
};
export default mod;
