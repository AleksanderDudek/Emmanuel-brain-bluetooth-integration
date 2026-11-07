/**
 * Latarnik (DESIGN.md §3.2): a lighthouse keeper's nights on the Baltic, a one-tap timing game in
 * the family of Pop the Lock and Knife Hit.  Tap when the turning beam touches a boat to guide it
 * home; every night has a goal and three stars (guide N boats, find boats in the fog, bring a
 * flotilla in by its numbers, find pan Edek's rowboat), every fifth is a squall with telegraphed
 * gusts.  Focus is the beam's reach (far boats carry more, fog-bound ones are found sooner), calm
 * in the Cisza makes the sea glow and washes up amber; the crates buy the workshop's upgrades.
 * Zośka the gull comments.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with
 * nights.ts, rules.ts, meta.ts and talk.ts), the pictures (render.ts with hud.ts and layout.ts,
 * intro.ts for calibration, preview.ts for the lobby, all drawn with paint.ts), the sound
 * (audio.ts), the lobby's card (panel.ts) and the coach marks (env.hint) for the first session and
 * for every new thing later.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase } from '../kit/types';
import { LatarnikSound } from './audio';
import { t, unit, type Key } from './i18n';
import { freshProgress, migrate, type LatarnikProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { LatarnikView } from './render';
import { RULES } from './rules';
import { LatarnikSim, type SimEvent } from './sim';

type HintKey = 'tap' | 'perfect' | 'goal' | 'lanterns' | 'reach' | 'glow' | 'blind' | 'fog' | 'flotilla' | 'rescue' | 'squall' | 'whale' | 'upgrade';

export class LatarnikGame implements ArcadeGame {
  readonly sim: LatarnikSim;
  private readonly view: LatarnikView;
  private readonly sound: LatarnikSound;
  private keyHeld = false;
  private now = 0;
  // the coach marks: one at a time, each once ever (the progress remembers them)
  private hintAt = -99;
  private readonly later: { key: HintKey; at: number; a?: number; r?: number }[] = [];

  constructor(private readonly env: GameEnv<LatarnikProgress>) {
    migrate(env.progress);
    this.sim = new LatarnikSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg',
      tuning: env.tuning,
    });
    this.view = new LatarnikView(env.canvas, { reducedMotion: env.reducedMotion });
    this.sound = new LatarnikSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __latarnik?: unknown }).__latarnik = this.sim;
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr, this.env.hudTop()); }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.sim.start();
    this.sound.start();
    this.view.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
    this.coach();
  }

  draw(): void { this.view.draw(this.sim); }

  pointer(e: PointerInput): void {
    if (e.type === 'down') this.flash();
  }

  key(key: string, down: boolean): boolean {
    if (key !== ' ' && key !== 'Enter') return false;
    if (down && !this.keyHeld) this.flash();   // a held key flashes once, not on auto-repeat
    this.keyHeld = down;
    return true;
  }

  pause(paused: boolean): void {
    if (paused) this.keyHeld = false;
  }

  private flash(): void {
    this.sim.flash();
    this.drain();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
      this.react(e);
    }
  }

  // ── the coach marks ─────────────────────────────────────────────
  private seen(key: HintKey): boolean { return this.env.progress.seen.includes(key); }

  private ask(key: HintKey, delay = 0, at?: { a: number; r: number }): void {
    if (this.seen(key) || this.later.some(l => l.key === key)) return;
    this.later.push({ key, at: this.now + delay, ...(at ?? {}) });
  }

  private react(e: SimEvent): void {
    const s = this.sim;
    switch (e.type) {
      case 'flash':
        if (!e.full) this.ask('perfect', 0.8);
        if (s.session === 1) this.ask('goal', 2.6);
        break;
      case 'reef':
        if (!e.free) this.ask('lanterns', 0.3);
        break;
      case 'blockStart':
        if (e.block.kind === 'konwoj') this.ask(e.block.blind ? 'blind' : 'reach', RULES.bannerSec + 1.5);
        if (e.block.kind === 'cisza') this.ask('glow', RULES.bannerSec + 1);
        break;
      case 'spotted':
        if (e.boat.kind === 'mgla') this.ask('fog', 0, e.boat);
        if (e.boat.kind === 'lodka') this.ask('rescue', 0, e.boat);
        break;
      case 'nightStart':
        if (e.spec.kind === 'flotylla') this.ask('flotilla', 2.4);
        if (e.spec.kind === 'ratunek') this.ask('rescue', 2.4);
        if (e.spec.kind === 'mgla') this.ask('fog', 2.4);
        break;
      case 'gustWarn':
        this.ask('squall', 0);
        break;
      case 'nightWon': case 'rewind':
        this.env.hint('');   // the card takes the stage: a coach mark steps aside
        break;
      case 'whaleUp':
        this.ask('whale', 0, e.whale);
        break;
      case 'upgrade':
        this.ask('upgrade', 3.2);
        break;
      default:
        break;
    }
  }

  private coach(): void {
    const s = this.sim;
    if (!s.started || s.story || s.ended) return;
    // the lesson: the beam waits on the first boat
    if (s.lesson === 'hold' && !this.seen('tap')) {
      const b = s.boats.find(x => x.anchored && x.state === 'sea');
      if (b) return void this.show('tap', b);
    }
    if (this.now - this.hintAt < 3.8 || s.phase !== 'play') return;
    this.later.sort((a, b) => a.at - b.at);
    while (this.later.length && this.seen(this.later[0].key)) this.later.shift();
    const next = this.later[0];
    // a hint never over the runner's banner or a telegraph (a gust's warning speaks for itself)
    if (!next || next.at > this.now) return;
    if (next.key !== 'squall' && next.key !== 'whale' && (s.telegraphing || (s.block.kind !== 'warmup' && s.blockT < RULES.bannerSec))) return;
    this.later.shift();
    if (next.key === 'whale' && s.whale.state !== 'up') return;
    this.show(next.key, next.a !== undefined && next.r !== undefined ? { a: next.a, r: next.r } : undefined);
  }

  private show(key: HintKey, on?: { a: number; r: number }): void {
    const L = this.view.layout, s = this.sim;
    let at: { x: number; y: number } | null = null;
    switch (key) {
      case 'tap': case 'fog': case 'rescue': case 'whale':
        at = on ? this.view.point(on.a, on.r) : null;
        break;
      case 'perfect': at = { x: L.ladder.x - 50 * L.u, y: L.ladder.y - 10 * L.u }; break;
      case 'goal': case 'flotilla': at = { x: L.goal.x + L.goal.w * 0.5, y: L.goal.y + 4 }; break;
      case 'lanterns': at = { x: L.lanterns.x + 30 * L.u, y: L.lanterns.y - 16 * L.u }; break;
      case 'reach': case 'blind': at = this.view.point(-0.75, Math.min(1, s.reach)); break;
      case 'glow': case 'upgrade': at = { x: L.cx, y: L.cy + L.s * 0.6 }; break;
      case 'squall': at = this.view.point(0, 0.6); break;
    }
    this.hintAt = this.now;
    if (!this.env.progress.seen.includes(key)) this.env.progress.seen.push(key);
    this.env.hint(t(`hint.${key}` as Key), at, key === 'tap' ? RULES.lessonSec * 1000 : 3800);
  }

  // ── what the runner reads ───────────────────────────────────────
  /** The pad follows what the screen shows: the lamp, or the glow in a Cisza; still where nothing shows (sim.ts). */
  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  signal(): SignalPhase { return this.sim.signal(); }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline { return { value: this.sim.score, sub: this.sim.headlineSub() }; }

  /** Ended early: the sim settles like its dawn would; the view and the sound are about to go, so its events are dropped. */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { /* the runner stops the audio; nothing else holds resources */ }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'flash': buzz(e.full ? [20, 40, 20, 40, 30] : e.boats.length > 1 ? [12, 30, 12] : e.perfect ? 16 : 10); break;
    case 'reef': if (!e.free) buzz(40); break;
    case 'star': buzz([15, 50, 15]); break;
    case 'nightWon': buzz([20, 40, 20, 40, 20, 40, 60]); break;
    case 'gust': buzz([30, 30, 30]); break;
    case 'whale': buzz([10, 30, 10, 30, 40]); break;
    case 'amber': if (e.isNew) buzz([10, 30, 10]); break;
    default: break;
  }
}

const howto = (): HowTo => ({
  goal: t('how.goal'),
  hands: [
    { gesture: 'tap', text: t('how.tap') },
    { gesture: 'keys', text: t('how.keys') },
  ],
  tips: [t('how.tip1'), t('how.tip2')],
});

const mod: ArcadeModule<LatarnikProgress> = {
  freshProgress,
  create: env => new LatarnikGame(env),
  best: p => {
    migrate(p);
    return p.sessions > 0 ? p.bestSession : null;
  },
  unit,
  progressPanel: (p, save) => {
    migrate(p);
    return progressPanel(p, save);
  },
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p ? migrate(p) : p),
  howto,
};
export default mod;
