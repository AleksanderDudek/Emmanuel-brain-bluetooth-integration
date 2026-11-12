/**
 * Ja jestem… — "In the powerful name of Jesus I am…" (DESIGN §13.8), rooted in Philippians 2:9-10.  The
 * player receives a declaration — loved, healthy, strong, free… or their own dream with their own word —
 * as a picture turned into a stained-glass sketch before the game begins; their focus pours colour into it
 * cell by cell (a full cell lights, a whole fragment becomes one pane), their calm makes the glass glow,
 * and at the end the leading dissolves, the window shines with its aura, and the declaration is written
 * out with the verse it stands on.  The record is always a declaration: one a session, the next not yet
 * received unless the player chooses.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers in
 * rules.ts, the picture's geometry in vision.ts and scenes.ts, the meta in meta.ts, Hanna's bubble in
 * talk.ts), the preparation (prep.ts: the analysis and the cut), the pictures (pictures.ts with art.ts),
 * the view (render.ts with layout.ts and paint.ts, intro.ts for calibration, preview.ts for the lobby), the
 * sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import { lang } from '../../i18n';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { JestemSound } from './audio';
import { declWord, formSample, type Form } from './content';
import { t, unit } from './i18n';
import { JestemIntro } from './intro';
import { tapTargets } from './layout';
import { declKey, freshProgress, migrate, nextNew, nextVision, type JestemProgress, type VisionKey } from './meta';
import { progressPanel } from './panel';
import { cut, prepare, seedOf, type PrepJob, type Prepared } from './prep';
import { drawPreview } from './preview';
import { JestemView } from './render';
import { RULES } from './rules';
import { JestemSim, type Coach, type CoachAt, type SimEvent } from './sim';
import { cellUnder } from './vision';

/** a finger that moves farther than this (px) drags; less is a tap */
const TAP_PX = 10;

class JestemGame implements ArcadeGame {
  private readonly sim: JestemSim;
  private readonly view: JestemView;
  private readonly sound: JestemSound;
  private readonly introScene = new JestemIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private visionKey: VisionKey;
  private job: PrepJob;
  private prepared: Prepared | null = null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private finger: number | null = null;
  private press: { x: number; y: number; moved: boolean } | null = null;
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 1.5;
  private cardUp = false;
  private waitSec = 0;

  constructor(private readonly env: GameEnv<JestemProgress>) {
    const p = migrate(env.progress);
    this.sim = new JestemSim({
      progress: p, rng: env.rng, day: env.day, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, askForm: lang === 'pl',
    });
    this.visionKey = nextVision(p);
    this.job = prepare(this.visionKey);
    this.view = new JestemView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.view.formWord = (f: Form) => declWord(formSample(this.sim.vision?.decl ?? null), f);
    this.sound = new JestemSound(env.audio);
    this.ctx = env.canvas.getContext('2d');
    // the declaration is written in the app's serif: make sure it is loaded before the finale
    try { void document.fonts?.load('600 24px "Fraunces Variable"'); } catch { /* fonts API missing: the fallback serif draws */ }
    this.tryAttach();
    // ?debug: the session in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __jestem?: unknown }).__jestem = this.sim;
  }

  /** The analysis is done: cut it for this session's cells and hand it to the rules and the view. */
  private tryAttach(): void {
    if (this.prepared) return;
    if (this.job.failed) {
      // an own picture that cannot be read (deleted, the storage refused): the next declaration instead
      this.visionKey = declKey(nextNew(this.sim.p));
      this.job = prepare(this.visionKey);
    }
    if (!this.job.done || !this.job.result) return;
    const a = this.job.result;
    const prep = cut(a, this.sim.cellsWanted, seedOf(a.key, this.sim.p.sessions + 1));
    this.prepared = prep;
    const word = a.decl ? declWord(a.decl, this.sim.p.form) : a.word;
    this.sim.setVision({ key: a.key, geo: prep.geo, decl: a.decl, word });
    this.view.setVision(prep, word);
    this.drain();
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.insets());
  }

  intro(dt: number, p: number): void {
    if (!this.prepared) {
      this.job.pump(10);
      this.tryAttach();
    }
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, this.prepared, this.job.progress);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
    if (!this.prepared) {
      // the founder's rule: prepared before play — finish what can be finished now (an own photo may still load)
      this.job.finish();
      this.tryAttach();
    }
    this.sim.start();
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.prepared) {
      this.waitSec += dt;
      this.job.pump(6);
      // an own photo that has not come in a few seconds: the next declaration, so the session is never empty
      if (this.waitSec > 6 && !this.job.done) this.job.failed = this.job.failed ?? 'timeout';
      this.tryAttach();
    }
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
    this.hintCool -= dt;
    const card = !!this.sim.story;
    if (card && !this.cardUp) this.env.hint('');
    this.cardUp = card;
    this.flushHints();
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim);
  }

  /**
   * A tap on the window sends the colour to the cell under the finger (a tap on the light finds the nearest
   * unlit one); a drag lays a path of cells the colour follows; in a rest a tap on the glass makes it glow and
   * a tap on the sketch marks where the next push begins.  On the opening card a tap closes it, or answers the
   * form.  Every touch shows at once.  One finger at a time.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view;
    if (e.type === 'down') {
      this.finger = e.id;
      view.ripple(e.x, e.y);
      if (sim.story) {
        const b = view.formAt(e.x, e.y);
        if (sim.story.ask && b >= 0) {
          view.pressed = b;
          sim.chooseForm(b === 0 ? 'm' : 'f');
          if (this.env.haptics) buzz(12);
        } else sim.tapAt(null, null);
        this.drain();
        return;
      }
      this.press = { x: e.x, y: e.y, moved: false };
      view.drag = [];
      return;
    }
    if (e.id !== this.finger) return;
    const pr = this.press;
    if (e.type === 'move') {
      if (!pr) return;
      if (!pr.moved && Math.hypot(e.x - pr.x, e.y - pr.y) > TAP_PX) {
        pr.moved = true;
        // the path starts under the first touch
        this.addToPath(pr.x, pr.y);
      }
      if (pr.moved) this.addToPath(e.x, e.y);
      return;
    }
    // up
    this.finger = null;
    this.press = null;
    if (!pr) return;
    if (pr.moved && view.drag.length) {
      sim.setPath(view.drag);
      if (this.env.haptics) buzz(10);
    } else {
      const q = view.toPicture(pr.x, pr.y);
      if (q && sim.tapAt(q.x, q.y) && this.env.haptics) buzz(8);
    }
    view.drag = [];
    this.drain();
  }

  private addToPath(x: number, y: number): void {
    const v = this.sim.vision;
    const q = this.view.onWindow(x, y) ? this.view.toPicture(x, y) : null;
    if (!v || !q) return;
    const c = cellUnder(v.geo, q.x, q.y);
    const d = this.view.drag;
    if (c >= 0 && !this.sim.lit[c] && !d.includes(c) && d.length < RULES.pathMax) {
      d.push(c);
      if (this.env.haptics) buzz(4);
    }
  }

  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.finger = null;
      this.press = null;
      this.view.drag = [];
    }
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e);
      this.sound.on(e);
      if (e.type === 'coach') this.hints.push({ what: e.what, at: e.at });
      if (this.env.haptics) haptic(e);
    }
  }

  /** Whether a first-time explanation fits the moment: show it, let it wait for its moment, or drop it (the moment has gone). */
  private hintNow(what: Coach): 'show' | 'wait' | 'drop' {
    const s = this.sim;
    if (!s.playing) return 'drop';
    switch (what) {
      // the oculus shows the colour only in a sighted push (in a rest it holds the calm)
      case 'oculus': return s.sighted ? 'show' : 'wait';
      case 'night': return s.blind ? 'show' : 'drop';
      case 'rest': return s.restBlock ? 'show' : 'drop';
      case 'light': return s.complete ? 'show' : 'drop';
      default: return 'show';
    }
  }

  /** The runner's coach mark, pointing at the thing it explains — one at a time, never over the card. */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.story || this.press?.moved) return;
    let h: { what: Coach; at: CoachAt } | null = null;
    for (let i = 0; i < this.hints.length; i++) {
      const v = this.hintNow(this.hints[i].what);
      if (v === 'drop') { this.hints.splice(i--, 1); continue; }
      if (v === 'wait') continue;
      // Hanna finishes her line first, unless the mark is about what is happening now
      if (sim.talk.line && this.hints[i].what !== 'oculus' && this.hints[i].what !== 'night') return;
      h = this.hints.splice(i, 1)[0];
      break;
    }
    if (!h) return;
    const L = this.view.L, v = sim.vision;
    let at: { x: number; y: number } | null = null;
    if (h.at?.kind === 'oculus') at = { x: L.oculus.x, y: L.oculus.y + L.oculus.r };
    else if (h.at?.kind === 'cell' && v) {
      const c = v.geo.cells[h.at.id];
      // a bubble is wide: keep its point away from the screen's sides
      if (c) at = { x: Math.min(L.w * 0.72, Math.max(L.w * 0.28, L.win.x + c.cx * L.k)), y: L.win.y + c.cy * L.k };
    }
    const ms = h.what === 'oculus' || h.what === 'tap' ? 5200 : 4200;
    this.hintCool = ms / 1000 + 1;
    this.env.hint(coachText(h.what, this.env.touch), at, ms);
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, its seconds left and what comes next, for the runner's panel and dock. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || b.kind === 'warmup') {
      const next = s.started && s.phase === 'play' && b.kind === 'warmup' && s.telegraphed && s.next ? (s.next.kind === 'push' ? 'focus' : 'rest') : null;
      return { want: 'free', blind: false, task: s.phase === 'play' ? s.tip || undefined : undefined, left: s.phase === 'play' ? Math.max(0, b.dur - s.blockT) : undefined, next };
    }
    const nb = s.next;
    return {
      want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip, left: Math.max(0, b.dur - s.blockT),
      next: s.telegraphed ? (nb ? (nb.kind === 'push' ? 'focus' : 'rest') : 'free') : null,
    };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim;
    const sub = s.complete ? t('hud.whole') : s.blind ? t('hud.night') : s.cells ? t('hud.of', { n: s.cells }) : undefined;
    return { value: s.score, sub };
  }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  /** Every control the player can tap now: the opening card's answers (the window is the free play area). */
  targets(): TapTarget[] {
    const s = this.sim;
    if (!s.started) return [];
    const box = this.view.cardBox ?? undefined;
    return tapTargets(this.view.L, { card: s.story ? (s.story.ask ? 'ask' : 'story') : null, cardBox: box });
  }

  destroy(): void {
    this.finger = null;
    this.press = null;
  }
}

/** A coach mark's words for the hand the player has: a finger never hears of keys, a keyboard may. */
export function coachText(what: Coach, touch: boolean): string {
  if (what === 'tap' && !touch) return t('coach.tap.keys');
  return t(`coach.${what}` as 'coach.tap');
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'lit': if (e.by === 'player') buzz(10); break;
    case 'fragment': buzz([16, 40, 24]); break;
    case 'complete': buzz([20, 50, 20, 50, 40]); break;
    case 'dawn': buzz([12, 30, 12]); break;
    case 'finale': buzz([30, 80, 30]); break;
    default: break;
  }
}

/** How to play, for the hand the player has: tap and drag on a phone; the drop on Space on a keyboard. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t('howto.tap') },
      { gesture: 'drag', text: t('howto.drag') },
      ...(touch ? [] : [{ gesture: 'keys' as const, text: t('howto.keys') }]),
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<JestemProgress> = {
  freshProgress,
  create: env => new JestemGame(env),
  best: p => {
    migrate(p);
    return p.sessions > 0 ? p.best : null;
  },
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined),
  howto: () => howto(),
};
export default mod;
