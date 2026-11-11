/**
 * Kocia straż (the abbey's cat watch): an idle merge shooter after Idle Cat Gunner, rooted in Song of
 * Songs 2:15 ("catch for us the foxes, the little foxes that spoil the vineyards").  The abbey's cats sit
 * on cushions along the old wall and fire their toys by themselves at the pests that come for the
 * vineyard, the granary, the orchard, the kitchen garden, the pond and the scriptorium; startled, the
 * pests bolt and Brother Anselm pays the cats in fish.  The hands run the economy: merge two toys of a
 * grade into a better one, hand toys to the cats, buy upgrades; every fifth stage a chief comes with a
 * trick and a patience of his own; a vintage starts the year over for golden fish and lasting perks.
 *
 * The band is the cats' alertness: in a push block their pace is ×1…×3 with focus (the gatehouse's
 * cat's-eye is the gauge, its notch the threshold, their eyes turn gold), and a held focus fills the
 * Great Hunt — every cat pounces at once.  In a rest block everyone naps: calm ripens the grapes into
 * fish and the nap leaves a toy in the chest.  Dusk (a blind push) tells at its end how alert they were.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers in
 * rules.ts, the data in content.ts, the meta in meta.ts, Brother Anselm's bubble in talk.ts), the
 * pictures (render.ts with layout.ts and paint.ts, intro.ts for calibration, preview.ts for the lobby),
 * the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { SignalTrace } from '../kit/trace';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase } from '../kit/types';
import { KotySound } from './audio';
import { bossName, placeName } from './content';
import { t, unit } from './i18n';
import { KotyIntro } from './intro';
import { bestOf, freshProgress, migrate, type BuyId, type KotyProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { KotyView } from './render';
import { KotySim, type Coach, type CoachAt, type Loc, type SimEvent } from './sim';

const TAP_PX = 10;
const HOLD_FIRST = 0.42;
const HOLD_EVERY = 0.15;

class KotyGame implements ArcadeGame {
  private readonly sim: KotySim;
  private readonly view: KotyView;
  private readonly sound: KotySound;
  private readonly introScene = new KotyIntro();
  private ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  /** the finger on the toys: where it went down, what it holds */
  private press: { id: number; x: number; y: number; loc: Loc } | null = null;
  /** a buy button held down: it buys again and again */
  private hold: { id: BuyId; t: number; next: number } | null = null;
  /** first-time explanations waiting for a clear screen (one at a time, a few seconds apart) */
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 1.5;
  /** the band's last 40 s, drawn as the cats' paw prints along the wall (one a second) */
  private readonly trace = new SignalTrace(40, 1);
  private now = 0;
  private cardUp = false;

  constructor(private readonly env: GameEnv<KotyProgress>) {
    migrate(env.progress);
    this.sim = new KotySim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg',
      tuning: env.tuning, now: Date.now(),
    });
    this.view = new KotyView(env.canvas, { reducedMotion: env.reducedMotion, simulated: env.simulated });
    this.sound = new KotySound(env.audio);
    this.ctx = env.canvas.getContext('2d');
    // ?debug: the watch in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __koty?: unknown }).__koty = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.hudTop());
  }

  intro(dt: number, p: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, this.env.progress);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.hudTop());
    this.sim.start();
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    this.sim.update(dt, f, t);
    const ph = this.signal();
    this.trace.push(t, f, ph.want, ph.blind);
    if (this.hold) {
      this.hold.t += dt;
      if (this.hold.t >= this.hold.next) {
        this.hold.next += HOLD_EVERY;
        if (!this.sim.buy(this.hold.id)) this.hold.next += 0.4;
      }
    }
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
    this.hintCool -= dt;
    // a card covers the field: the coach mark on screen goes with it
    const card = !!(this.sim.story || this.sim.confirm);
    if (card && !this.cardUp) this.env.hint('');
    this.cardUp = card;
    this.flushHints();
  }

  /** Before play the runner's intro() has painted the calibration scene this frame; after it, the watch. */
  draw(): void {
    if (this.sim.started) this.view.draw(this.sim, this.trace, this.now);
  }

  /**
   * A press on a toy picks it up (drag it onto a mate to merge, onto a cat to hand it over; a tap merges
   * it with its mate or hands it to the weakest cat); on a cat without dragging, it pets the cat; on a
   * button, it buys (held, again and again) or lends the helping paw; on the eye, it releases a ready
   * hunt; on the field, it marks the squad's target and goes "psst!"; on a card, it closes it.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view;
    if (e.type === 'down') {
      const h = view.hit(e.x, e.y, sim);
      switch (h.kind) {
        case 'story': sim.tap(); break;
        case 'yes': sim.answerVintage(true); break;
        case 'no': sim.answerVintage(false); break;
        case 'chest':
        case 'slot': {
          const loc: Loc = { kind: h.kind, i: h.i };
          this.press = { id: e.id, x: e.x, y: e.y, loc };
          const toy = sim.toyAt(loc);
          if (toy) view.drag = { from: loc, toy, x: e.x, y: e.y, moved: false };
          break;
        }
        case 'up':
          sim.buy(h.id);
          view.pressed = h.id;
          this.hold = { id: h.id, t: 0, next: HOLD_FIRST };
          break;
        case 'paw':
          sim.paw();
          view.pawPressed();
          break;
        case 'eye':
          // the eye releases a ready hunt; before that a tap on it goes "psst!" at the nearest pest
          if (!sim.releaseHunt()) sim.clapNearest();
          break;
        case 'vintage':
          sim.askVintage();
          break;
        case 'field':
          sim.aim(h.x, h.y);
          sim.clap(h.x, h.y);
          break;
        default:
          break;
      }
      this.drain();
      return;
    }
    const pr = this.press;
    if (e.type === 'move') {
      const d = view.drag;
      if (pr && pr.id === e.id && d) {
        d.x = e.x;
        d.y = e.y;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) > TAP_PX) d.moved = true;
      }
      return;
    }
    // up
    this.hold = null;
    view.pressed = null;
    if (!pr || pr.id !== e.id) return;
    const d = view.drag;
    this.press = null;
    view.drag = null;
    if (d && d.moved) {
      const to = view.locAt(e.x, e.y, sim);
      if (to) sim.drop(d.from, to);
    } else if (pr.loc.kind === 'slot') {
      sim.pet(pr.loc.i);
    } else if (d) {
      sim.autoPlace(pr.loc);
    }
    this.drain();
  }

  /** Space and Enter: close a card, release a ready hunt, or the helping paw; 1–4 buy along the bottom. */
  key(key: string, down: boolean): boolean {
    const buys: Record<string, BuyId> = { 1: 'aim', 2: 'paws', 3: 'bowl', 4: 'toy' };
    if (buys[key]) {
      if (down) this.sim.buy(buys[key]);
      this.drain();
      return true;
    }
    const used = this.sim.key(key, down);
    if (used && down && (key === ' ' || key === 'Spacebar')) this.view.pawPressed();
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.hold = null;
      this.press = null;
      this.view.drag = null;
      this.view.pressed = null;
    }
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (e.type === 'coach') this.hints.push({ what: e.what, at: e.at });
      if (e.type === 'dusk') this.trace.unveil(this.now);
      if (this.env.haptics) haptic(e);
    }
  }

  /**
   * The runner's coach mark, pointing at the thing it explains — never over a card or mid-drag.  The
   * time-bound ones (a chief, the hunt, the eye, the nap, dusk) go first; one that waits for its moment
   * (the eye in a push, the nap in a rest) lets the others pass, and one whose moment has gone is dropped.
   */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.story || sim.confirm || this.view.drag?.moved) return;
    const urgent = (w: Coach) => w === 'boss' || w === 'hunt' || w === 'eye' || w === 'nap' || w === 'dusk';
    this.hints.sort((a, b) => Number(urgent(b.what)) - Number(urgent(a.what)));
    for (let i = 0; i < this.hints.length; i++) {
      const h = this.hints[i];
      const v = this.hintNow(h.what);
      if (v === 'drop') { this.hints.splice(i--, 1); continue; }
      if (v === 'wait') continue;
      if (sim.talkBlocked && !urgent(h.what)) return;
      this.hints.splice(i, 1);
      const at = this.view.pointFor(h.at, sim);
      const ms = h.what === 'eye' || h.what === 'nap' || h.what === 'merge' || h.what === 'merge2' ? 5200 : 4000;
      this.hintCool = ms / 1000 + 0.8;
      const key = h.what === 'merge2' ? 'merge' : h.what;
      this.env.hint(t(`coach.${key}` as 'coach.merge'), at, ms);
      return;
    }
  }

  /** Whether a first-time explanation fits the moment: show it, let it wait, or drop it. */
  private hintNow(what: Coach): 'show' | 'wait' | 'drop' {
    const s = this.sim;
    switch (what) {
      case 'eye': return s.sighted ? 'show' : 'wait';
      case 'nap': return s.restBlock ? 'show' : 'wait';
      case 'dusk': return s.blind ? 'show' : 'drop';
      case 'hunt': return s.huntReady ? (s.napping ? 'wait' : 'show') : 'drop';
      case 'boss': return s.boss && s.boss.state !== 'away' && s.boss.state !== 'chased' ? 'show' : 'drop';
      case 'merge':
      case 'merge2': return s.p.merges === 0 && s.firstPair() ? 'show' : 'drop';
      case 'equip': return s.p.chest.some(x => x && s.weakestSlot(x) >= 0) ? 'show' : 'drop';
      case 'upgrade': return s.cheapest() !== null ? 'show' : 'wait';
      case 'full': return s.chestFull ? 'show' : 'drop';
      case 'vintage': return s.vintageOpen ? 'show' : 'drop';
      default: return 'show';
    }
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, its seconds left and what comes next, for the runner's panel and dock. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || !b || b.kind === 'warmup') {
      const next = s.started && s.phase === 'play' && b?.kind === 'warmup' && s.telegraphed && s.next ? (s.next.kind === 'push' ? 'focus' : 'rest') : null;
      return { want: 'free', blind: false, task: s.tip || undefined, left: b && s.phase === 'play' ? Math.max(0, b.dur - s.blockT) : undefined, next };
    }
    const nb = s.next;
    return {
      want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip, left: Math.max(0, b.dur - s.blockT),
      next: s.telegraphed ? (nb ? (nb.kind === 'push' ? 'focus' : 'rest') : 'free') : null,
    };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim, n = s.p.stage;
    const b = s.boss && s.boss.state !== 'away' ? s.boss : null;
    if (b) return { value: s.score, sub: t('hud.subBoss', { n, name: bossName(b.id) }) };
    const best = bestOf(s.p);
    const left = best !== null ? best - s.score : 0;
    if (best !== null && left > 0 && left <= Math.max(12, best * 0.25)) return { value: s.score, sub: t('hud.subBest', { n, left }) };
    return { value: s.score, sub: t('hud.sub', { n, place: placeName(s.info.place.id) }) };
  }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void {
    this.hold = null;
    this.press = null;
  }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'merge': buzz(e.fresh ? [12, 30, 20] : 12); break;
    case 'hunt': buzz([30, 40, 60]); break;
    case 'bossChased': buzz([30, 40, 30, 40, 80]); break;
    case 'boss': buzz(40); break;
    case 'pet': buzz([8, 20, 8, 20, 8]); break;
    case 'huntReady': buzz(20); break;
    default: break;
  }
}

function howto(): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'drag', text: t('howto.drag') },
      { gesture: 'tap', text: t('howto.tap') },
      { gesture: 'keys', text: t('howto.keys') },
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<KotyProgress> = {
  freshProgress,
  create: env => new KotyGame(env),
  best: p => {
    migrate(p);
    return p.sessions > 0 ? bestOf(p) : null;
  },
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p ? migrate(p) : undefined),
  howto,
};
export default mod;
