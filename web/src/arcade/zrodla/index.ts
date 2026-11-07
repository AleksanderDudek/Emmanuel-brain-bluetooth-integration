/**
 * Źródła (DESIGN.md §6): Pipe Mania in a dry valley on the pilgrims' road of the Songs of Ascents,
 * with Kumka the tree frog, a plumber with a diploma.  A dispenser shows the next five channel
 * stones; a tap on a cell lays the next one there (a dry stone is swapped); after a countdown the
 * spring opens and the water runs through whatever it meets, and the player keeps laying the way
 * ahead of it.  A valley is won when the water ran through its goal's number of cells (and into
 * the garden at a station's end); a cross run twice is a loop.  Space lays the next stone where it
 * helps, and once the way is long enough lets the water run fast (×2).  A spill never ends the
 * session: the water soaks in, the jars stay, the valley comes again.
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
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase } from '../kit/types';
import { ZrodlaSound } from './audio';
import { isPool, PIPE } from './grid';
import { t, unit, type Key } from './i18n';
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

  constructor(private readonly env: GameEnv<ZrodlaProgress>) {
    migrate(env.progress);
    this.sim = new ZrodlaSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning });
    this.view = new ZrodlaView(env.canvas, { reducedMotion: env.reducedMotion });
    this.sound = new ZrodlaSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __zrodla?: unknown }).__zrodla = this.sim;
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr, this.env.hudTop()); }

  intro(dt: number, p: number): void {
    const v = this.view, s = v.size;
    v.context.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    this.intro0.draw(v.context, s.w, s.h, dt, p);
  }

  start(): void {
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
  pointer(e: PointerInput): void {
    if (e.type !== 'down') return;
    const sim = this.sim, L = this.view.layout;
    if (sim.story) {
      sim.dismiss();
      this.drain();
      return;
    }
    const cell = cellAt(L, e.x, e.y);
    if (cell >= 0) sim.layAt(cell);
    else {
      // the dispenser or the gauge: what Space does
      const g = L.gauge, q = L.queue;
      const onGauge = Math.hypot(e.x - g.x, e.y - g.y) < g.r * 1.3;
      const onQueue = e.x >= q.x && e.x <= q.x + q.w && e.y >= q.y && e.y <= q.y + q.h;
      if (onGauge || onQueue) sim.space();
    }
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
      case 'goal': at = L.portrait ? { x: L.slots[1].x + 40, y: L.slots[0].y - 14 } : { x: L.gauge.x, y: L.gauge.y + L.gauge.r * 1.5 }; break;
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
    if (at) at = { x: Math.max(110, Math.min(L.w - 110, at.x)), y: at.y };
    this.env.hint(t(`hint.${key}` as Key), at, 3600);
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

const howto = (): HowTo => ({
  goal: t('how.goal'),
  hands: [
    { gesture: 'tap', text: t('how.tap') },
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
