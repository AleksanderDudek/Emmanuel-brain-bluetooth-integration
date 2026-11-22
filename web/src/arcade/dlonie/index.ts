/**
 * Światło w dłoniach (Light in the Hands), the series "Serce i światło" (DESIGN.md §18), rooted in Psalm 141:2 ("let
 * my prayer be counted as incense before you, and the lifting up of my hands as the evening sacrifice").  The qigong
 * "ball between the palms" recast as a prayer held in the hands: the player rubs their palms, breathes with them, and
 * a spark between them grows into a ball of light only while focus is held; it takes the name of the one prayed for
 * and is lifted up to God like incense — or, for oneself or a name with a sore place, laid with a hand where it hurts.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers in rules.ts, the
 * data in content.ts, the words in i18n.ts, the progress in meta.ts, the narrator in talk.ts), the pictures (render.ts
 * with layout.ts, hands.ts, paint.ts and hud.ts; intro.ts for the calibration, preview.ts for the lobby), the sound
 * (audio.ts) and the lobby's card (panel.ts).
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { DlonieSound } from './audio';
import type { Coach } from './content';
import { flameText, t, unit } from './i18n';
import { DlonieIntro } from './intro';
import { bestOf, freshProgress, migrate, type DlonieProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { DlonieView } from './render';
import { RULES } from './rules';
import { DlonieSim, type SimEvent } from './sim';

class DlonieGame implements ArcadeGame {
  private readonly sim: DlonieSim;
  private readonly view: DlonieView;
  private readonly sound: DlonieSound;
  private readonly introScene = new DlonieIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private now = 0;
  private readonly hints: Coach[] = [];
  private hintCool = 1.5;
  private cursor = '';
  private readonly leave = (): void => { this.view.hover = null; this.setCursor('default'); };

  constructor(private readonly env: GameEnv<DlonieProgress>) {
    migrate(env.progress);
    this.sim = new DlonieSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, mouse: !env.touch });
    this.view = new DlonieView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new DlonieSound(env.audio);
    this.ctx = env.canvas.getContext?.('2d') ?? null;
    if (!env.touch) env.canvas.addEventListener?.('pointerleave', this.leave);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) {
      (globalThis as { __dlonie?: unknown }).__dlonie = this.sim;
      (globalThis as { __dlonieView?: unknown }).__dlonieView = this.view;
    }
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.insets());
  }

  intro(dt: number, p: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, this.env.reducedMotion);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
    this.sim.start();
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt);
    this.hintCool -= dt;
    this.flushHints();
    if (this.view.hover) this.setCursor(this.view.cursor(this.sim));
  }

  private setCursor(c: string): void {
    if (c === this.cursor) return;
    this.cursor = c;
    if (this.env.canvas.style) this.env.canvas.style.cursor = c;
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim);
  }

  /**
   * A tap on a button chooses whom (◀ ▶) or opens the list (≡); in the list a chip chooses; on the small figure it
   * moves the hand to the nearest place; on the opening card it begins; anywhere else the words glow again.
   */
  pointer(e: PointerInput): void {
    if (!this.env.touch) {
      this.view.hover = { x: e.x, y: e.y };
      this.setCursor(this.view.cursor(this.sim));
    }
    if (e.type !== 'down') return;
    const sim = this.sim;
    const h = this.view.hit(e.x, e.y, sim);
    switch (h.kind) {
      case 'story':
        sim.stay();
        break;
      case 'ctrl':
        this.view.down[h.id] = 1;
        if (h.id === 'menu') sim.openPicker();
        else if (h.id === 'prev') sim.prev();
        else sim.next();
        if (this.env.haptics) buzz(6);
        break;
      case 'pick':
        sim.pick(h.i);
        if (this.env.haptics) buzz(8);
        break;
      case 'close':
      case 'outside':
        sim.closePicker();
        break;
      case 'figure': {
        const place = this.view.placeAt(h.x, h.y);
        if (place) sim.setPlace(place);
        else sim.stay();
        break;
      }
      default:
        sim.stay();
        break;
    }
    this.drain();
  }

  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used && down) {
      if (key === 'ArrowLeft') this.view.down.prev = 1;
      if (key === 'ArrowRight') this.view.down.next = 1;
      if (key.toLowerCase() === 'm') this.view.down.menu = 1;
      this.drain();
    }
    return used;
  }

  pause(): void {}

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e, this.sim);
      if (e.type === 'coach') this.hints.push(e.what);
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark, pointing at what it explains — never over the opening card or the list, one at a time. */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.story || sim.picker) return;
    if (sim.phase === 'play' && (sim.telegraphed || sim.stepT < RULES.bannerSec)) return;
    if (sim.talk.line) return;
    const what = this.hints.shift()!;
    // a first-time explanation of a step that has passed is no longer worth a bubble
    const of: Partial<Record<Coach, readonly string[]>> = { rub: ['rub'], breathe: ['breathe'], ball: ['ball'], blind: ['ball'], offer: ['offer'], lay: ['offer', 'name'] };
    if (of[what] && !of[what]!.includes(sim.step)) return;
    const text = coachText(what, this.env.touch);
    const ms = Math.round(Math.max(RULES.readMin, RULES.readBase + RULES.readPerChar * text.length) * 1000);
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    this.env.hint(text, this.view.point(what, sim), ms);
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  signal(): SignalPhase {
    const s = this.sim.signal();
    return { want: s.want, blind: s.blind, task: s.task, left: s.left, next: s.next };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim;
    const best = bestOf(s.p);
    const left = best !== null ? best - s.score : 0;
    if (best !== null && left > 0 && left <= Math.max(60, best * 0.25)) return { value: s.score, sub: t('hud.subBest', { left: flameText(left) }) };
    return { value: s.score, sub: t('hud.sub', { n: Math.max(1, s.n), of: Math.max(s.planned, s.n) }) };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  targets(): TapTarget[] { return this.view.targets(this.sim); }

  destroy(): void {
    this.env.canvas.removeEventListener?.('pointerleave', this.leave);
    if (this.env.canvas.style) this.env.canvas.style.cursor = '';
  }
}

/** A coach mark's words for the hand the player has: a finger never hears of keys, a mouse clicks. */
export function coachText(what: Coach, touch: boolean): string {
  if (!touch && (what === 'who' || what === 'lay')) return t(`coach.${what}.mouse` as 'coach.who.mouse');
  return t(`coach.${what}` as 'coach.rub');
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'grown': buzz([10, 30, 14]); break;
    case 'offered': buzz([24, 40, 50]); break;
    default: break;
  }
}

/** How to play, for the hand the player has: taps on a phone; clicks and keys with a mouse. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t(touch ? 'howto.who' : 'howto.who.mouse') },
      { gesture: 'tap', text: t(touch ? 'howto.place' : 'howto.place.mouse') },
      ...(touch ? [] : [{ gesture: 'keys' as const, text: t('howto.keys') }]),
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<DlonieProgress> = {
  freshProgress,
  create: env => new DlonieGame(env),
  best: p => {
    migrate(p);
    return p.sessions > 0 ? bestOf(p) : null;
  },
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p ? migrate(p) : undefined),
  howto: () => howto(),
};
export default mod;
