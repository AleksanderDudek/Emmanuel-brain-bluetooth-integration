/**
 * Geoda (DESIGN.md §3): Block Blast in a geode under an old mine, with Bazyl the short-sighted mole
 * jeweller.  Drag one of three pieces onto the 8×8 board (it lifts above the finger, a ghost shows
 * where it snaps and the lines it would clear light up); full rows and columns clear at once; a
 * combo grows while every third placement at the latest clears something.  A tap on the board, or
 * Space, sets the current piece at the best spot.  When nothing fits the geode turns: a tally and a
 * fresh board, never a lost session.  The Wyprawa's chambers ask for jewels set in their rock (stars
 * for points); the Klasyka is one endless board.
 *
 * The band: in a Blask (push) the shine dial follows the focus — ×1 … ×5 on every clear, ×3 from
 * the threshold up — and druses grow on cleared cells for a piece to harvest; a blind push pays its
 * sack at the end.  In a Szlif (rest) calm polishes the round's gem for the cabinet.
 *
 * Mobile first (DESIGN §3.1, §12): on a phone the dragged piece floats clear of the thumb and snaps to the
 * nearest spot it fits; the tray's pieces are finger-sized targets under the thumb (`targets()`), pressed on
 * touch-down; the words speak of tapping and dragging, the keys are a desktop's shortcuts.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with board.ts,
 * the numbers in rules.ts, the data in content.ts, the meta in meta.ts, Bazyl's bubble in talk.ts),
 * the pictures (render.ts with paint.ts, art.ts and layout.ts, intro.ts for calibration, preview.ts
 * for the lobby), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import type { TracePhase } from '../kit/trace';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { GeodaSound } from './audio';
import { N } from './board';
import { t, type GeodaKey } from './i18n';
import { GeodaIntro } from './intro';
import { slotAt, tapTargets } from './layout';
import { bestOf, freshProgress, migrate, type GeodaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { GeodaView, type Hand } from './render';
import { RULES } from './rules';
import { GeodaSim, type BlockKind, type GeodaEvent } from './sim';

/** a press that moves this far is a drag, not a tap (a fingertip wobbles) */
const DRAG_PX = 10;
const phaseOf = (k: BlockKind): TracePhase => (k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free');

type HintKey = 'drag' | 'tap' | 'line' | 'goal' | 'jewel' | 'dial' | 'druse' | 'rest' | 'blind' | 'combo' | 'stuck';

export class GeodaGame implements ArcadeGame {
  readonly sim: GeodaSim;
  private readonly view: GeodaView;
  private readonly sound: GeodaSound;
  private readonly intro0 = new GeodaIntro();
  private readonly hand: Hand = { drag: null, idle: 0 };
  /** a finger down: on a tray slot (may become a drag) or on the board (a tap) */
  private press: { id: number; x: number; y: number; slot: number; moved: boolean } | null = null;
  private now = 0;
  // the coach marks
  private readonly hinted = new Set<HintKey>();
  private hintAt = -99;
  private readonly later: { key: HintKey; at: number }[] = [];
  private placedOnce = false;
  /** the dragged piece has a spot on the board now (for the tick when it first finds one) */
  private snapped = false;

  constructor(private readonly env: GameEnv<GeodaProgress>) {
    migrate(env.progress);
    this.sim = new GeodaSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning });
    this.view = new GeodaView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new GeodaSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __geoda?: unknown }).__geoda = this.sim;
  }

  /** The HUD's band and the phone's edges are read again at the start: the runner shows its panel only when play begins. */
  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr, this.env.insets()); }

  intro(dt: number, p: number): void {
    const v = this.view, s = v.size;
    v.context.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    this.intro0.draw(v.context, s.w, s.h, dt, p);
  }

  start(): void {
    const v = this.view.size;
    if (v.w > 1) this.view.resize(v.w, v.h, v.dpr, this.env.insets());
    this.sim.start();
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    this.hand.idle = t - this.sim.lastInput;
    if (this.hand.drag) {
      this.hand.drag.t += dt;
      this.hand.idle = 0;
    }
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.coach();
  }

  /** The runner draws every frame, the calibration too: until play begins the intro scene stays. */
  draw(): void {
    if (this.sim.started) this.view.draw(this.sim, this.hand);
  }

  // ── the hands ───────────────────────────────────────────────────
  pointer(e: PointerInput): void {
    const sim = this.sim;
    if (e.type === 'down') {
      if (this.press) return;
      const slot = slotAt(this.view.layout, e.x, e.y);
      this.press = { id: e.id, x: e.x, y: e.y, slot: sim.story ? -1 : slot, moved: false };
      if (slot >= 0 && sim.tray[slot] && !sim.story) {
        this.view.pressed = slot;
        sim.select(slot);
        this.sound.pick();
        if (this.env.haptics) buzz(6);
        this.drain();
      }
      this.snapped = false;
      return;
    }
    const pr = this.press;
    if (!pr || pr.id !== e.id) return;
    if (e.type === 'move') {
      if (!pr.moved && Math.hypot(e.x - pr.x, e.y - pr.y) >= DRAG_PX) {
        pr.moved = true;
        if (pr.slot >= 0 && sim.tray[pr.slot]) this.hand.drag = { slot: pr.slot, x: e.x, y: e.y, t: 0 };
      }
      const d = this.hand.drag;
      if (d) {
        d.x = e.x;
        d.y = e.y;
        // a light tick when the piece first finds a spot on the board (the ghost appears)
        const item = sim.tray[d.slot];
        const on = !!item && this.view.snap(sim, item.piece, e.x, e.y) !== null;
        if (on && !this.snapped && this.env.haptics) buzz(5);
        this.snapped = on;
      }
      return;
    }
    // up
    this.press = null;
    this.view.pressed = -1;
    const drag = this.hand.drag;
    this.hand.drag = null;
    if (drag) {
      const item = sim.tray[drag.slot];
      if (!item) return;
      const s = this.view.snap(sim, item.piece, e.x, e.y);
      if (s && sim.place(drag.slot, s.gx, s.gy)) this.drain();
      else this.view.sendBack(drag.slot, item, e.x, e.y);
      return;
    }
    if (pr.moved) return;
    if (pr.slot >= 0) return;   // a tap on a piece selects it (done on the press)
    if (sim.dismiss()) return;
    const cell = this.view.cellAt(e.x, e.y);
    if (cell && sim.tapAt(cell[0], cell[1])) this.drain();
  }

  /** Space or Enter: the current piece at its best spot; 1–3 pick a piece. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used && down) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.press = null;
      this.hand.drag = null;
      this.view.pressed = -1;
    }
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
      this.react(e);
    }
  }

  // ── the coach marks (env.hint): one mechanic at a time, when it first matters ──
  private react(e: GeodaEvent): void {
    const L = this.view.layout;
    switch (e.type) {
      case 'place':
        if (!this.placedOnce) {
          this.placedOnce = true;
          this.later.push({ key: 'line', at: this.now + 0.6 });
        }
        if (e.combo === 2) this.ask('combo');
        if (this.sim.mode === 'adventure') {
          const j = this.jewelCell();
          if (j >= 0) this.later.push({ key: 'goal', at: this.now + 1 }, { key: 'jewel', at: this.now + 1.2 });
        }
        break;
      case 'stuck':
        this.ask('stuck');
        break;
      case 'blockStart':
        if (e.block.kind === 'push') this.later.push({ key: e.block.blind ? 'blind' : 'dial', at: this.now + RULES.bannerSec + 0.3 });
        if (e.block.kind === 'rest') this.later.push({ key: 'rest', at: this.now + RULES.bannerSec + 0.3 });
        break;
      default:
        break;
    }
    void L;
  }

  private jewelCell(): number {
    const b = this.sim.board;
    for (let i = 0; i < N * N; i++) if (b.jewel[i]) return i;
    return -1;
  }

  private ask(key: HintKey): void {
    if (this.seen(key)) return;
    this.later.push({ key, at: this.now });
  }

  private seen(key: HintKey): boolean { return this.hinted.has(key) || this.env.progress.seen.includes(key); }

  private coach(): void {
    const sim = this.sim;
    if (!sim.started || sim.story) return;
    if (this.now - this.hintAt < 3.8) return;
    // the first moves: drag, then (if nothing happens) the tap helper
    if (!this.placedOnce && !this.seen('drag')) return void this.show('drag');
    if (!this.placedOnce && this.hand.idle >= RULES.idleHint && !this.seen('tap')) return void this.show('tap');
    if (this.placedOnce && !this.seen('tap') && this.seen('line') && this.sim.placements < 4) return void this.show('tap');
    // druses: once one is clearly growing
    if (!this.seen('druse') && sim.sighted) {
      for (let i = 0; i < N * N; i++) if (sim.board.druse[i] > 0.35) return void this.show('druse', i);
    }
    this.later.sort((a, b) => a.at - b.at);
    while (this.later.length && this.seen(this.later[0].key)) this.later.shift();
    const next = this.later[0];
    if (next && next.at <= this.now && !sim.telegraphing) {
      this.later.shift();
      this.show(next.key);
    }
  }

  private show(key: HintKey, cell = -1): void {
    const L = this.view.layout, sim = this.sim;
    const cellPt = (i: number) => ({ x: L.board.x + (i % N + 0.5) * L.cell, y: L.board.y + (Math.floor(i / N) + 0.5) * L.cell });
    let at: { x: number; y: number } | null = null;
    switch (key) {
      case 'drag': { const s = L.slots[sim.current]; at = { x: s.x + s.w / 2, y: s.y + s.h * 0.3 }; break; }
      case 'tap': at = { x: L.board.x + L.board.w / 2, y: L.board.y + L.board.h * 0.55 }; break;
      case 'line': at = { x: L.board.x + L.board.w / 2, y: L.board.y + L.board.h * 0.5 }; break;
      case 'goal': at = { x: L.goal.x + L.goal.w / 2, y: L.goal.y + L.goal.h }; break;
      case 'jewel': { const j = this.jewelCell(); if (j < 0) return; at = cellPt(j); break; }
      case 'dial': case 'blind': at = { x: L.dial.x, y: L.dial.y - L.dial.r * 0.6 }; break;
      case 'druse': at = cellPt(cell); break;
      case 'rest': at = { x: L.bowl.x + L.bowl.w / 2, y: L.bowl.y + L.bowl.h * 0.3 }; break;
      case 'combo': at = { x: L.board.x + L.board.w / 2, y: L.board.y + L.board.h * 0.35 }; break;
      case 'stuck': { const i = sim.tray.findIndex(x => x && !sim.board.fitsAnywhere(x.piece)); const s = L.slots[Math.max(0, i)]; at = { x: s.x + s.w / 2, y: s.y + s.h * 0.3 }; break; }
    }
    this.hinted.add(key);
    if (!this.env.progress.seen.includes(key)) this.env.progress.seen.push(key);
    this.hintAt = this.now;
    this.env.hint(t(`hint.${key}` as GeodaKey), at, 3600);
  }

  // ── what the runner reads ───────────────────────────────────────
  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  signal(): SignalPhase {
    const s = this.sim;
    if (!s.started || s.ended) return { want: 'free', blind: false };
    const b = s.block;
    const next = s.telegraphing && s.next ? phaseOf(s.next.kind) : null;
    return { want: phaseOf(b.kind), blind: s.blind, task: s.tip, left: s.left, next };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline { return { value: this.sim.score, sub: this.sim.headlineSub() }; }

  /** The tray's pieces (a story card instead while one is up), as the pointer tests them (kit/mobile's audit checks them). */
  targets(): TapTarget[] {
    if (!this.sim.started) return [];
    return tapTargets(this.view.layout, { tray: this.sim.tray, story: !!this.sim.story });
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome {
    const r = this.sim.result();
    return { ...r, unit: 'ct' };
  }

  destroy(): void {
    this.press = null;
    this.hand.drag = null;
  }
}

function haptic(e: GeodaEvent): void {
  switch (e.type) {
    case 'place': buzz(e.lines ? [18, 30, 18 + 8 * e.lines] : 8); break;
    case 'turn': buzz([30, 50, 30]); break;
    case 'level': buzz([20, 40, 20, 40, 60]); break;
    case 'gem': buzz(12); break;
    default: break;
  }
}

/** How to play for the hand the player has: a finger drags and taps; a desktop also has Space and 1–3. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('how.goal'),
    hands: touch
      ? [
        { gesture: 'drag', text: t('how.drag') },
        { gesture: 'tap', text: t('how.tap') },
      ]
      : [
        { gesture: 'drag', text: t('how.drag') },
        { gesture: 'tap', text: t('how.tap.keys') },
        { gesture: 'keys', text: t('how.keys') },
      ],
    tips: [t('how.tip1'), t('how.tip2')],
  };
}

const mod: ArcadeModule<GeodaProgress> = {
  freshProgress,
  create: env => new GeodaGame(env),
  best: p => bestOf(p),
  progressPanel: (p, save) => progressPanel(p, save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
  howto: () => howto(),
};

export default mod;
