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
import { buzz, clamp } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { SignalTrace } from '../kit/trace';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { KotySound } from './audio';
import { bossName, placeName } from './content';
import { t, unit } from './i18n';
import { KotyIntro } from './intro';
import { tapTargets } from './layout';
import { bestOf, freshProgress, migrate, type BuyId, type KotyProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { KotyView } from './render';
import { RULES } from './rules';
import { KotySim, type Coach, type CoachAt, type Loc, type SimEvent } from './sim';

/** a finger that moves farther than this (px) drags; less is a tap */
const TAP_PX = 10;
const HOLD_FIRST = 0.42;
const HOLD_EVERY = 0.15;
const HOLD_PAW = 0.3;

const same = (a: Loc | null | undefined, b: Loc | null | undefined): boolean => !!a && !!b && a.kind === b.kind && a.i === b.i;

class KotyGame implements ArcadeGame {
  private readonly sim: KotySim;
  private readonly view: KotyView;
  private readonly sound: KotySound;
  private readonly introScene = new KotyIntro();
  private ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  /** the one finger (pointer) the game follows: a new one takes over from a finger that went astray */
  private finger: number | null = null;
  /** the finger on the toys or the cats: where it went down, on what */
  private press: { x: number; y: number; loc: Loc } | null = null;
  /** a buy button held down: it buys again and again */
  private hold: { id: BuyId | 'paw'; t: number; next: number } | null = null;
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
    this.view = new KotyView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new KotySound(env.audio);
    this.ctx = env.canvas.getContext('2d');
    // ?debug: the watch in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __koty?: unknown }).__koty = this.sim;
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
    this.introScene.draw(ctx, this.w, this.h, dt, p, this.env.progress);
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
    const ph = this.signal();
    this.trace.push(t, f, ph.want, ph.blind);
    if (this.hold) {
      this.hold.t += dt;
      if (this.hold.t >= this.hold.next) {
        // a held paw keeps helping, a little slower than a held upgrade keeps buying
        if (this.hold.id === 'paw') {
          this.hold.next += HOLD_PAW;
          if (!this.sim.paw()) this.hold.next += 0.4;
          else this.view.pawPressed();
        } else {
          this.hold.next += HOLD_EVERY;
          if (!this.sim.buy(this.hold.id)) this.hold.next += 0.4;
        }
      }
    }
    this.drain();
    this.view.update(dt, this.sim);
    this.trackDrag();
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
   * A press on a toy picks it up (drag it onto a mate to merge, onto a cat to hand it over — it floats above
   * the finger and lands on the nearest cell or cat; a tap merges it with its mate or hands it to the weakest
   * cat); on a cat without dragging, it pets the cat; on a button, it buys (held, again and again) or lends the
   * helping paw (a ready hunt first, like Space); on the eye, it releases a ready hunt; on the field, it marks
   * the pest nearest the finger as the squad's target and goes "psst!"; on a card, it closes it.  Every press
   * shows on touch-down.  One finger at a time: a new one takes over.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view;
    if (e.type === 'down') {
      if (this.finger !== null && this.finger !== e.id) this.letGo();
      this.finger = e.id;
      const h = view.hit(e.x, e.y, sim);
      switch (h.kind) {
        case 'story': sim.tap(); break;
        case 'yes': sim.answerVintage(true); break;
        case 'no': sim.answerVintage(false); break;
        case 'chest':
        case 'slot': {
          const loc: Loc = { kind: h.kind, i: h.i };
          this.press = { x: e.x, y: e.y, loc };
          view.press = loc;
          const toy = sim.toyAt(loc);
          if (toy && !sim.frozen) view.drag = { from: loc, toy, x: e.x, y: e.y, moved: false, lift: this.lift(), k: 0, snap: null };
          break;
        }
        case 'up':
          if (sim.buy(h.id) && this.env.haptics) buzz(8);
          view.pressed = h.id;
          this.hold = { id: h.id, t: 0, next: HOLD_FIRST };
          break;
        case 'paw':
          view.pawDown = true;
          this.helpingPaw();
          this.hold = { id: 'paw', t: 0, next: HOLD_FIRST };
          break;
        case 'eye':
          // the eye releases a ready hunt; before that a tap on it goes "psst!" at the nearest pest
          if (!sim.releaseHunt()) sim.clapNearest();
          break;
        case 'vintage':
          sim.askVintage();
          break;
        case 'field': {
          // the pest nearest the finger (measured on screen: the field is squashed on a phone) becomes the target
          const pe = view.pestAt(e.x, e.y, sim);
          if (pe) {
            sim.aim(pe.x, pe.y);
            sim.clap(pe.x, pe.y);
          } else sim.clap(h.x, h.y);
          break;
        }
        default:
          break;
      }
      this.drain();
      return;
    }
    if (e.id !== this.finger) return;
    const pr = this.press;
    if (e.type === 'move') {
      const d = view.drag;
      if (pr && d) {
        d.x = e.x;
        d.y = e.y;
        if (!d.moved && Math.hypot(e.x - pr.x, e.y - pr.y) > TAP_PX) {
          d.moved = true;
          view.press = null;
          if (this.env.haptics) buzz(8);
        }
        this.trackDrag();
      }
      return;
    }
    // up: a drag lands where it snapped, a tap pets a cat or places a toy
    this.trackDrag();
    const d = view.drag;
    this.letGo();
    if (!pr) return;
    if (d && d.moved) {
      if (d.snap) sim.drop(d.from, d.snap);
    } else if (pr.loc.kind === 'slot') {
      sim.pet(pr.loc.i);
    } else if (d) {
      sim.autoPlace(pr.loc);
    }
    this.drain();
  }

  /** Whatever the finger held is let go (nothing lands): the hold, the pressed looks, a toy in the air. */
  private letGo(): void {
    this.finger = null;
    this.hold = null;
    this.press = null;
    const v = this.view;
    v.pressed = null;
    v.pawDown = false;
    v.press = null;
    v.drag = null;
  }

  /** How far above the finger a dragged toy floats: clear of a fingertip on a phone, a little lift under a mouse. */
  private lift(): number {
    const c = this.view.L.cell;
    return this.env.touch ? clamp(c * 0.95, 44, 76) : Math.round(c * 0.3);
  }

  /** Where a dragged toy would land now; a light tick when that is a mate to merge with. */
  private trackDrag(): void {
    const d = this.view.drag;
    if (!d || !d.moved) return;
    const snap = this.view.snapAt(d.x, d.y - d.lift * d.k, this.sim, d.from);
    if (same(snap, d.snap)) return;
    d.snap = snap;
    const toy = snap ? this.sim.toyAt(snap) : null;
    if (toy && toy.g === d.toy.g && toy.g < RULES.grades && this.env.haptics) buzz(6);
  }

  /** The paw button is Space on the screen: a ready hunt first, else the helping paw. */
  private helpingPaw(): void {
    if (!this.sim.releaseHunt()) this.sim.paw();
    this.view.pawPressed();
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
    if (paused) this.letGo();
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
      // Brother Anselm finishes his line first (an urgent mark goes ahead and his bubble steps aside)
      if (sim.talk.line && !urgent(h.what)) return;
      this.hints.splice(i, 1);
      const at = this.view.pointFor(h.at, sim);
      const ms = h.what === 'eye' || h.what === 'nap' || h.what === 'merge' || h.what === 'merge2' ? 5200 : 4000;
      this.hintCool = ms / 1000 + 0.8;
      this.env.hint(coachText(h.what, this.env.touch), at, ms);
      this.view.coachShown(ms);
      // a mark about a control in the thumb zone sits over the field: the control itself glows
      if (!at) this.view.coachRing(h.at, ms);
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

  /** Every control the player can tap now (the layout's rectangles, as `hit` tests them), for the mobile audit. */
  targets(): TapTarget[] {
    const s = this.sim;
    if (!s.started) return [];
    return tapTargets(this.view.L, {
      slots: s.cushions.length, vintage: s.vintageOpen && !s.frozen, card: s.confirm ? 'confirm' : s.story ? 'story' : null, cardBox: this.view.cardBox,
    });
  }

  destroy(): void {
    this.letGo();
  }
}

/** A coach mark's words for the hand the player has: a finger never hears of keys, a keyboard may. */
export function coachText(what: Coach, touch: boolean): string {
  const key = what === 'merge2' ? 'merge' : what;
  if (!touch && (key === 'hunt' || key === 'paw')) return t(`coach.${key}.keys`);
  return t(`coach.${key}` as 'coach.merge');
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'merge': buzz(e.fresh ? [14, 30, 22] : 14); break;
    case 'equip': buzz(10); break;
    case 'hunt': buzz([30, 40, 60]); break;
    case 'bossChased': buzz([30, 40, 30, 40, 80]); break;
    case 'boss': buzz(40); break;
    case 'pet': buzz([8, 20, 8, 20, 8]); break;
    case 'huntReady': buzz(20); break;
    default: break;
  }
}

/** How to play, for the hand the player has: the paw's button on a phone, Space and the digits on a keyboard. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'drag', text: t('howto.drag') },
      { gesture: 'tap', text: t('howto.tap') },
      touch ? { gesture: 'tap', text: t('howto.paw') } : { gesture: 'keys', text: t('howto.keys') },
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
  howto: () => howto(),
};
export default mod;
