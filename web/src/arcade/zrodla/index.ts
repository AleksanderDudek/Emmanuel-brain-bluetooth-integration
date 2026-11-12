/**
 * Źródła (DESIGN.md §6): Pipe Mania in a dry valley on the pilgrims' road of the Songs of Ascents,
 * with Kumka the tree frog, a plumber with a diploma.  A dispenser shows the next five channel
 * stones; a tap on a cell lays the next one there (a dry stone is swapped) — the finger shows the stone
 * in the cell as it lands and lays it as it lifts; after a countdown the spring opens and the water runs
 * through whatever it meets, and the player keeps laying the way ahead of it.  A valley is won when the water ran through its goal's number of cells (and into
 * the garden at a station's end); a cross run twice is a loop.  Space lays the next stone where it
 * helps, and once the way is long enough lets the water run fast (×2).  A spill never ends the
 * session: the water soaks in, the jars stay, the valley comes again.  On a phone (DESIGN §12) the
 * dispenser and the spring's dial sit in the thumb zone, and a tap on the next stone or the dial is
 * Kumka's help (what Space does).
 *
 * The band: in a push the sluice follows the focus — above the threshold the water's pressure drops
 * and it runs slower (room to plan), and a held focus fills the charge for a few seconds of still
 * water; in a rest calm grows gardens along the cells the water reached.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with grid.ts,
 * the numbers in rules.ts, the data in content.ts, the meta in meta.ts, Kumka's bubble in talk.ts),
 * the pictures (render.ts with paint.ts and layout.ts, intro.ts for calibration, preview.ts for the
 * lobby), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { TracePhase } from '../kit/trace';
import { hits } from '../kit/mobile';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { ZrodlaSound } from './audio';
import { isPool, PIPE } from './grid';
import { hand, t, unit, type Key } from './i18n';
import { ZrodlaIntro } from './intro';
import { cellAt, cellCentre } from './layout';
import { bestOf, freshProgress, migrate, type ZrodlaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { ZrodlaView } from './render';
import { RULES } from './rules';
import { ZrodlaSim, type BlockKind, type ZrodlaEvent } from './sim';

const phaseOf = (k: BlockKind): TracePhase => (k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free');

type HintKey = 'tap' | 'queue' | 'count' | 'goal' | 'flow' | 'space' | 'bomb' | 'fast' | 'gauge' | 'blind' | 'garden' | 'cross' | 'pool'
  | 'gardenEnd' | 'aqueduct' | 'oneway' | 'still';

/** A finger past this many px from where it came down is aiming elsewhere (or slid off a button). */
const SLOP = 10;

/** A finger down: on the valley (it aims at a cell, lays on the lift) or on the next stone or the dial (Kumka's help on the lift). */
type Press = { id: number; kind: 'cell'; x0: number; y0: number } | { id: number; kind: 'help'; what: 'next' | 'dial'; x0: number; y0: number; off: boolean };

export class ZrodlaGame implements ArcadeGame {
  readonly sim: ZrodlaSim;
  private readonly view: ZrodlaView;
  private readonly sound: ZrodlaSound;
  private readonly intro0 = new ZrodlaIntro();
  private now = 0;
  private readonly hinted = new Set<HintKey>();
  private hintAt = -99;
  private readonly later: { key: HintKey; at: number }[] = [];
  private lays = 0;
  private press: Press | null = null;

  constructor(private readonly env: GameEnv<ZrodlaProgress>) {
    migrate(env.progress);
    this.sim = new ZrodlaSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning });
    this.view = new ZrodlaView(env.canvas, { reducedMotion: env.reducedMotion });
    this.view.touch = env.touch;
    this.sound = new ZrodlaSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __zrodla?: unknown }).__zrodla = this.sim;
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr, this.env.insets()); }

  intro(dt: number, p: number): void {
    const v = this.view, s = v.size;
    v.context.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    this.intro0.draw(v.context, s.w, s.h, dt, p);
  }

  start(): void {
    this.view.setInsets(this.env.insets());
    this.sim.start();
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.coach();
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim, this.now - this.sim.lastInput);
  }

  // ── the hands ───────────────────────────────────────────────────
  /** The cells a stone can go on that the window shows, the next stone and the dial (or the story card). */
  targets(): TapTarget[] { return this.view.targets(this.sim); }

  /**
   * A press.  A story card: closed at the touch.  A cell: the next stone shows there at once (over the
   * finger too, on a touch screen), the aim follows a sliding finger from cell to cell, the lift lays it;
   * lifted off the valley, nothing.  The next stone or the dial (and the rest of the dispenser): pressed at
   * the touch, Kumka's help (what Space does) on the lift; a thumb that slides off takes nothing.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view, L = view.layout;
    if (e.type === 'down') {
      if (this.press) return;   // one finger plays
      if (sim.story) {
        sim.dismiss();
        this.drain();
        return;
      }
      const cell = cellAt(L, e.x, e.y);
      if (cell >= 0) {
        this.press = { id: e.id, kind: 'cell', x0: e.x, y0: e.y };
        view.aim = cell;
        view.aimAt = { x: e.x, y: e.y };
        view.holding = true;
        if (this.env.haptics) buzz(4);
        return;
      }
      // the dispenser's stones (the next one and the four after it) and the dial: Kumka's help
      const sl = L.slots, x0 = Math.min(...sl.map(b => b.x)) - 6, y0 = Math.min(...sl.map(b => b.y)) - 6;
      const x1 = Math.max(...sl.map(b => b.x + b.w)) + 6, y1 = Math.max(...sl.map(b => b.y + b.h)) + 6;
      const onStones = e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1;
      const what = hits(L.dial, e.x, e.y) ? 'dial' : hits(L.next, e.x, e.y) || onStones ? 'next' : null;
      if (what) {
        this.press = { id: e.id, kind: 'help', what, x0: e.x, y0: e.y, off: false };
        view.pressed = what;
        if (this.env.haptics) buzz(6);
      }
      return;
    }
    const pr = this.press;
    if (!pr || pr.id !== e.id) return;
    if (pr.kind === 'help') {
      if (!pr.off && Math.hypot(e.x - pr.x0, e.y - pr.y0) > SLOP * 2) {
        pr.off = true;
        view.pressed = null;
      }
      if (e.type === 'up') {
        this.press = null;
        view.pressed = null;
        if (!pr.off) {
          sim.space();
          this.drain();
        }
      }
      return;
    }
    // aiming: the aim follows the finger over the valley (and off it, nothing)
    view.aimAt = { x: e.x, y: e.y };
    const cell = cellAt(L, e.x, e.y);
    if (e.type === 'move') {
      if (cell >= 0 && cell !== view.aim && this.env.haptics) buzz(3);
      view.aim = cell;
      return;
    }
    this.press = null;
    view.holding = false;
    view.aimAt = null;
    view.aim = -1;
    if (cell >= 0) sim.layAt(cell);
    this.drain();
  }

  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used && down) this.drain();
    return used;
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
  private react(e: ZrodlaEvent): void {
    const sim = this.sim;
    switch (e.type) {
      case 'lay':
        this.lays++;
        if (this.lays === 1) this.ask('queue', 0.4);
        if (this.lays === 2 && sim.phase === 'count') this.ask('count', 0.3);
        if (this.lays === 3) this.ask('goal', 0.3);
        if (e.replaced) this.hinted.add('bomb');
        if (this.lays === 6) this.ask('bomb', 0.5);
        break;
      case 'flow':
        this.ask('flow', 0.2);
        break;
      case 'goal':
        this.ask('fast', 0.3);
        break;
      case 'valley': {
        const v = sim.valley;
        if (v.garden >= 0) this.ask('gardenEnd', 0.8);
        if (v.cells.some(c => c.aqueduct)) this.ask('aqueduct', 1.6);
        if (v.cells.some(c => c.oneway >= 0)) this.ask('oneway', 2.4);
        break;
      }
      case 'blockStart':
        if (e.block.kind === 'push') this.ask(e.block.blind ? 'blind' : 'gauge', RULES.bannerSec + 0.3);
        if (e.block.kind === 'rest') this.ask('garden', RULES.bannerSec + 0.3);
        break;
      default:
        break;
    }
  }

  private ask(key: HintKey, delay = 0): void {
    if (this.seen(key)) return;
    this.later.push({ key, at: this.now + delay });
  }

  private seen(key: HintKey): boolean { return this.hinted.has(key) || this.env.progress.seen.includes(key); }

  private coach(): void {
    const sim = this.sim;
    if (!sim.started || sim.story || sim.ended) return;
    if (this.now - this.hintAt < 3.8) return;
    if (sim.phase !== 'over') {
      if (this.lays === 0 && !this.seen('tap')) return void this.show('tap');
      if (!this.seen('space') && this.now - sim.lastInput >= RULES.idleHint) return void this.show('space');
      if (!this.seen('space') && this.lays >= 4) return void this.show('space');
      const q = sim.queue[0];
      if (q === 'x' && !this.seen('cross')) return void this.show('cross');
      if (isPool(q) && !this.seen('pool')) return void this.show('pool');
      if (sim.charge >= 0.7 && !sim.blind && !this.seen('still')) return void this.show('still');
    }
    this.later.sort((a, b) => a.at - b.at);
    while (this.later.length && this.seen(this.later[0].key)) this.later.shift();
    const next = this.later[0];
    if (next && next.at <= this.now && !sim.telegraphing) {
      this.later.shift();
      this.show(next.key);
    }
  }

  private show(key: HintKey): void {
    const L = this.view.layout, sim = this.sim, v = sim.valley;
    const cell = (i: number) => cellCentre(L, i);
    const gauge = { x: L.gauge.x, y: L.gauge.y - L.gauge.r * 0.9 };
    let at: { x: number; y: number } | null = null;
    switch (key) {
      case 'tap': case 'space': {
        const i = sim.wayEnd.cell >= 0 ? sim.wayEnd.cell : v.spring;
        at = cell(i);
        break;
      }
      case 'queue': case 'cross': case 'pool': { const s = L.slots[0]; at = { x: s.x + s.w / 2, y: s.y + s.h * 0.2 }; break; }
      case 'count': at = cell(v.spring); break;
      case 'goal': at = { x: L.goal.align === 'right' ? L.goal.x - 30 : L.goal.x, y: L.goal.y - 8 }; break;
      case 'flow': { const w = sim.water; at = cell(w ? w.cell : v.spring); break; }
      case 'bomb': {
        const i = v.cells.findIndex(c => c.type === PIPE && !c.fixed && c.wet === 0);
        at = i >= 0 ? cell(i) : null;
        break;
      }
      case 'fast': case 'gauge': case 'blind': case 'still': at = gauge; break;
      case 'garden': { const w = sim.wetOrder(); at = cell(w[Math.min(w.length - 1, 1)]); break; }
      case 'gardenEnd': at = cell(v.garden); break;
      case 'aqueduct': { const i = v.cells.findIndex(c => c.aqueduct); at = i >= 0 ? cell(i) : null; break; }
      case 'oneway': { const i = v.cells.findIndex(c => c.oneway >= 0); at = i >= 0 ? cell(i) : null; break; }
    }
    this.hinted.add(key);
    if (!this.env.progress.seen.includes(key)) this.env.progress.seen.push(key);
    this.hintAt = this.now;
    this.sim.hushUntil = this.now + 3.6;
    if (this.env.touch && (key === 'space' || key === 'fast')) at = { x: L.next.x + L.next.w / 2, y: L.next.y };
    if (at) at = { x: Math.max(L.left + 24, Math.min(L.right - 24, at.x)), y: Math.max(L.top + 8, at.y) };
    this.env.hint(hand(`hint.${key}` as Key, this.env.touch), at, 3600);
  }

  // ── what the runner reads ───────────────────────────────────────
  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  signal(): SignalPhase {
    const s = this.sim;
    if (!s.started || s.ended) return { want: 'free', blind: false };
    const next = s.telegraphing && s.next ? phaseOf(s.next.kind) : null;
    return { want: phaseOf(s.block.kind), blind: s.blind, task: s.tip, left: s.left, next };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline { return { value: Math.round(this.sim.score), sub: this.sim.headlineSub() }; }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome {
    const r = this.sim.result();
    return { ...r, unit: unit(r.score) };
  }

  pause(paused: boolean): void {
    if (!paused) return;
    this.press = null;
    this.view.aim = -1;
    this.view.aimAt = null;
    this.view.holding = false;
    this.view.pressed = null;
  }

  destroy(): void { /* the runner stops the audio; nothing else holds resources */ }
}

function haptic(e: ZrodlaEvent): void {
  switch (e.type) {
    case 'lay': buzz(e.replaced ? [8, 20, 8] : 6); break;
    case 'spill': buzz([30, 40, 30]); break;
    case 'garden': buzz([15, 40, 15, 40, 25]); break;
    case 'fill': if (e.loop) buzz([12, 30, 12]); break;
    case 'still': if (e.on) buzz([20, 30, 20]); break;
    default: break;
  }
}

/** How to play: the tap and Kumka's help in words for a finger; the keys on a row of their own (dropped on a touch screen). */
export const howto = (): HowTo => ({
  goal: t('how.goal'),
  hands: [
    { gesture: 'tap', text: t('how.tap') },
    { gesture: 'tap', text: t('how.help') },
    { gesture: 'keys', text: t('how.space') },
  ],
  tips: [t('how.tip1'), t('how.tip2')],
});

const mod: ArcadeModule<ZrodlaProgress> = {
  freshProgress,
  create: env => new ZrodlaGame(env),
  best: p => bestOf(p),
  unit,
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
  howto,
};

export default mod;
