/**
 * Warstwy światła's session, without the canvas (DESIGN §28): the way of one session over the plan of rules.ts — the
 * arrival, the seven layers from the body outward (in each: pushes that draw out what clings, rests that entrust the
 * layer to Jesus, the closing rest where the Light takes what the time did not allow), the whole in the light and the
 * blessing — what the focus drives, what the band is asked, what the narrator says, and the session's numbers.
 *
 * Light only from real focus (§18.3–18.4): a thing loosens and rises on its thread only in a sighted push past its
 * lead-in, with a reliable signal, while focused, at `focusRate` (the level averaged over a whole breath).  Without
 * focus everything waits — a thing half drawn hangs on its thread and nothing is lost; the rests are receptive (whole
 * breaths), and calm deepens the layer's glow.  The plan is time-boxed: what a layer's window did not allow is taken
 * by grace at the start of its closing rest, so every layer closes and clears; only the things drawn with focus count
 * (threads of light).
 *
 * Own words never leave the progress: result() carries only numbers and the catalog's sentences.
 */
import { breathAt, breathCycle, breathOk, type BreathPattern, type BreathState } from '../kit/breath';
import type { FocusFrame, FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import type { Rhythm } from '../kit/rhythm';
import { passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import { LAYERS, VERSES, layerVerse, sessionVerse, type LayerId, type Moment } from './content';
import { placeHooks, type HookSpot } from './egg';
import { t, unit, type Key } from './i18n';
import { BREATH_DEF, bestOf, migrate, ownLine, type WarstwyProgress } from './meta';
import { RULES, focusRate, graceFor, learnPace, needFor, paceNow, planFor, readTime, type Plan } from './rules';
import { Talk } from './talk';

export type StageId = 'arrive' | 'layers' | 'whole' | 'close';
export type BlockKind = 'rest' | 'push' | 'free';
/** What a block is about: the arrival, a draw (push), an entrusting rest, the whole, the close. */
export type BlockWhat = 'arrive' | 'draw' | 'entrust' | 'whole' | 'close';
export interface Block { kind: BlockKind; what: BlockWhat; t0: number; dur: number }

export type HookState = 'cling' | 'draw' | 'gone';
export interface Hook extends HookSpot {
  layer: number;
  i: number;
  state: HookState;
  /** the draw's progress 0..1: loosening in place up to RULES.loosen, then rising on the thread */
  p: number;
  /** taken by grace (its times in the sweep) */
  grace: boolean;
  graceFrom: number;
  graceTo: number;
  /** when it reached the light (s of play); the wound it left closes from then */
  goneAt: number;
}

/** wait (not reached), open (its things being drawn), grace (the Light taking what is left), healing (closing), clear */
export type LayerState = 'wait' | 'open' | 'grace' | 'healing' | 'clear';
export interface LayerRun {
  id: LayerId;
  hooks: Hook[];
  state: LayerState;
  /** when it opened and when it began to close (s of play) */
  openAt: number;
  healAt: number;
  /** calm has deepened its glow, 0..1 */
  glow: number;
  /** the focus-seconds each of its things asks (fitted when it opens) */
  need: number;
  /** its rests so far (the prayers and the passages turn with them) */
  rests: number;
}

export type Coach = 'draw' | 'rest' | 'tap';

export type SimEvent =
  | { type: 'stage'; stage: StageId }
  | { type: 'block'; kind: BlockKind; what: BlockWhat }
  | { type: 'layer'; k: number }
  | { type: 'loosen'; k: number; i: number }
  | { type: 'drawn'; k: number; i: number; grace: boolean }
  | { type: 'grace'; k: number; n: number }
  | { type: 'healed'; k: number }
  | { type: 'tap' }
  | { type: 'coach'; what: Coach };

export interface SimOpts {
  progress: WarstwyProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  rhythm?: Rhythm | null;
}

/** A running mean over a window (the level over one whole breath, §18.4): quarter-second bins. */
class WindowMean {
  private readonly bins: number[] = [];
  private acc = 0;
  private accT = 0;
  private sum = 0;
  constructor(readonly sec: number, readonly bin = 0.25) {}
  push(v: number, dt: number): void {
    if (!(dt > 0) || !Number.isFinite(v)) return;
    this.acc += v * dt;
    this.accT += dt;
    while (this.accT >= this.bin) {
      const part = this.bin / this.accT;
      const val = (this.acc * part) / this.bin;
      this.acc -= this.acc * part;
      this.accT -= this.bin;
      this.bins.push(val);
      this.sum += val;
      if (this.bins.length > Math.round(this.sec / this.bin)) this.sum -= this.bins.shift()!;
    }
  }
  get value(): number | null { return this.bins.length ? this.sum / this.bins.length : null; }
}

export class WarstwySim {
  readonly p: WarstwyProgress;
  readonly plan: Plan;
  readonly talk: Talk;
  readonly breathPattern: BreathPattern;
  readonly eeg: boolean;
  readonly layers: LayerRun[];
  started = false;
  stage: StageId = 'arrive';
  block: Block = { kind: 'rest', what: 'arrive', t0: 0, dur: 0 };
  blockT = 0;
  t = 0;
  /** the layer now (0..6; 7 after the last) */
  k = 0;
  /** the push now (0-based), and the sighted seconds of the pushes so far (the layers' clock) */
  pushN = 0;
  sightedT = 0;
  /** a layer closed in the last push (its rest gives thanks first), and which closed last */
  healedIn = false;
  lastHealed = -1;
  /** what the focus does this frame (focus-seconds a second), the light shown (smoothed level), calm */
  rate = 0;
  light = 0;
  calm = 0;
  reliable = false;
  /** threads of light: things drawn with focus; things the Light took by grace */
  score = 0;
  graceN = 0;
  /** the passage on the band */
  card: PassageId | null = null;
  /** a tap makes the words glow again until this time */
  reshowUntil = 0;
  /** the runner's coach mark is up until this time (the narrator waits) */
  hintUntil = 0;
  /** the session's own pace: focus-seconds and sighted seconds with a thing to draw */
  paceFoc = 0;
  paceSec = 0;
  /** calm in the rests (for the summary) */
  private calmSum = 0;
  private calmT = 0;
  private stallT = 0;
  private waited = false;
  private credited = false;
  private drawnTalk = 0;
  private readonly mean = new WindowMean(RULES.meanSec);
  private readonly events: SimEvent[] = [];
  private readonly bestBefore: number | null;
  readonly session: number;
  private readonly firstSessions: boolean;

  constructor(o: SimOpts) {
    this.p = migrate(o.progress);
    this.eeg = o.eeg;
    this.breathPattern = breathOk(this.p.breath) ? this.p.breath : BREATH_DEF;
    const cyc = breathCycle(this.breathPattern);
    this.plan = planFor({
      plannedSec: o.plannedSec, cyc, eeg: o.eeg, focus: o.rhythm?.focus ?? null, rest: o.rhythm?.rest ?? null, custom: !!o.rhythm?.custom, pace: this.p.pace,
    });
    const n = this.plan.hooks;
    this.layers = LAYERS.map((spec, k) => ({
      id: spec.id,
      hooks: placeHooks(k, n, o.rng).map((s, i) => ({ ...s, layer: k, i, state: 'cling' as HookState, p: 0, grace: false, graceFrom: 0, graceTo: 0, goneAt: -1 })),
      state: 'wait' as LayerState, openAt: -1, healAt: -1, glow: 0, need: this.plan.need, rests: 0,
    }));
    this.talk = new Talk(o.rng);
    this.bestBefore = bestOf(this.p);
    this.session = this.p.sessions + 1;
    this.firstSessions = this.p.sessions < 2;
  }

  // ── the clock ─────────────────────────────────────────────────

  get T(): number { return this.plan.T; }
  get lead(): number { return this.plan.lead; }
  get cyc(): number { return this.plan.cyc; }
  get pushBlock(): boolean { return this.block.kind === 'push'; }
  get restBlock(): boolean { return this.block.kind === 'rest'; }
  get sighted(): boolean { return this.pushBlock && this.blockT >= this.lead; }
  get left(): number { return Math.max(0, this.block.dur - this.blockT); }
  /** the breath now (rest blocks count it from their start; elsewhere from the session's) */
  get breath(): BreathState { return breathAt(this.breathPattern, this.restBlock ? this.blockT : this.t); }
  /** whole breaths of the current rest */
  get breaths(): number { return Math.max(1, Math.round(this.block.dur / this.cyc)); }
  /** the layer now, or null before the first and after the last */
  get layer(): LayerRun | null { return this.stage === 'layers' && this.k < 7 ? this.layers[this.k] : null; }

  /** The thing being drawn on layer `k` now (the first still clinging or rising, not taken by grace), or null. */
  active(k = this.k): Hook | null {
    const L = this.layers[k];
    if (!L || L.state !== 'open') return null;
    return L.hooks.find(h => h.state !== 'gone' && !h.grace) ?? null;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.p.lastLen = this.T;
    this.setBlock('rest', 'arrive', this.plan.arriveEnd);
    this.emit({ type: 'stage', stage: 'arrive' });
    this.talk.ask('arrive', 2, 8);
    if (this.firstSessions) this.coach('tap');
  }

  take(): SimEvent[] { return this.events.splice(0); }
  private emit(e: SimEvent): void { this.events.push(e); }

  private coach(what: Coach): void {
    const id = `c.${what}`;
    if (this.p.seen.includes(id)) return;
    this.p.seen.push(id);
    this.emit({ type: 'coach', what });
  }

  private setBlock(kind: BlockKind, what: BlockWhat, dur: number): void {
    this.block = { kind, what, t0: this.t, dur: Math.max(0, dur) };
    this.blockT = 0;
    this.stallT = 0;
    this.waited = false;
    this.emit({ type: 'block', kind, what });
  }

  private setStage(s: StageId): void {
    this.stage = s;
    this.card = null;
    this.talk.hush();
    this.emit({ type: 'stage', stage: s });
  }

  update(dt: number, f: FocusFrame, now: number): void {
    if (!this.started) return;
    const step = Math.max(0, Math.min(0.25, dt));
    this.t = now;
    this.blockT += step;
    this.reliable = f.reliable;
    if (f.reliable) this.mean.push(f.level, step);
    const hook = this.stage === 'layers' ? this.active() : null;
    this.rate = this.sighted && f.reliable && hook ? focusRate(this.mean.value ?? f.level, f.focused, f.hold) : 0;
    if (this.sighted && f.reliable && hook) {
      this.paceFoc += this.rate * step;
      this.paceSec += step;
    }
    const shown = this.pushBlock ? (f.reliable ? f.level : 0.15) : 0.35;
    this.light = approach(this.light, shown, step, RULES.showTau);
    this.calm = approach(this.calm, f.reliable ? f.calm : 0, step, 1.5);
    if (this.restBlock && f.reliable) {
      this.calmSum += f.calm * step;
      this.calmT += step;
    }
    switch (this.stage) {
      case 'arrive': this.updateArrive(); break;
      case 'layers': this.updateLayers(step); break;
      case 'whole': this.updateWhole(step); break;
      case 'close': break;
    }
    this.updateGrace();
    this.updateHeal();
    const blocked = this.t < this.hintUntil || this.blockT < 1.2;
    this.talk.update(step, this.t, blocked);
  }

  /** Layers closing: each takes healSec to close and clear. */
  private updateHeal(): void {
    for (const L of this.layers) if (L.state === 'healing' && this.t - L.healAt >= RULES.healSec) L.state = 'clear';
  }

  /** How far layer `k` has closed and cleared (0..1). */
  heal(k: number): number {
    const L = this.layers[k];
    if (L.state === 'clear') return 1;
    if (L.state !== 'healing') return 0;
    return clamp((this.t - L.healAt) / RULES.healSec);
  }

  // ── the arrival ───────────────────────────────────────────────

  private updateArrive(): void {
    const A = this.plan.arriveEnd;
    if (!this.card && this.blockT > Math.min(this.cyc, A * 0.4) && this.blockT < A - 3) this.card = sessionVerse('arrive', this.session);
    if (this.t >= A) this.enterLayers();
  }

  // ── the layers ────────────────────────────────────────────────

  /** The sighted clock's mark where layer `k`'s share ends. */
  mark(k: number): number { return (this.plan.sighted * (k + 1)) / 7; }

  /**
   * Where layer `k` really ends on the sighted clock: its mark, or a little past it while a thing is still on it — a
   * layer may borrow up to `borrow` of a share from the next (whose things are then fitted to what is left), so a
   * slow moment does not hand the work to grace at once.  The last layer ends with the last push.
   */
  windowEnd(k: number): number {
    if (k >= 6) return this.plan.sighted;
    return Math.min(this.mark(k) + RULES.borrow * this.plan.win, this.mark(k + 1) - RULES.sightMin);
  }

  private enterLayers(): void {
    this.setStage('layers');
    this.pushN = 0;
    this.openLayer(0);
    this.startPush();
  }

  /** Open layer `k`: its things fitted to the sighted time its share has left and the player's pace. */
  private openLayer(k: number): void {
    this.k = k;
    const L = this.layers[k];
    L.state = 'open';
    L.openAt = this.t;
    const pace = paceNow(this.plan.pace, this.paceFoc, this.paceSec);
    L.need = this.plan.test ? RULES.needTest : needFor(this.mark(k) - this.sightedT, pace, L.hooks.length);
    this.emit({ type: 'layer', k });
    this.talk.hush();
    this.talk.ask(`begin.${L.id}` as Moment, 2, 8);
  }

  private startPush(): void {
    const last = this.pushN >= this.plan.pushes - 1;
    // the last push ends with the layers' time (what drift there is, it takes up)
    const dur = last ? Math.max(this.lead + 1, this.plan.layersEnd - this.t) : this.plan.push;
    this.setBlock('push', 'draw', dur);
    this.card = null;
    this.healedIn = false;
    if (this.firstSessions) this.coach('draw');
  }

  private updateLayers(dt: number): void {
    const b = this.block;
    if (b.kind === 'push') {
      if (this.sighted) this.sightedT += dt;
      this.draw(dt);
      // a layer's share of the sighted time is spent (and what it may borrow from the next): the Light takes what is
      // left, the next layer opens
      while (this.k < 6 && this.layers[this.k].state === 'open' && this.sightedT >= this.windowEnd(this.k) - 1e-6) this.endWindow();
      if (this.blockT >= b.dur) {
        if (this.pushN >= this.plan.pushes - 1 || this.allOut) {
          if (this.layers[6].state === 'open') this.endWindow();
          this.enterWhole();
          return;
        }
        this.setBlock('rest', 'entrust', this.plan.rest);
        this.beginRest();
      }
      return;
    }
    // a rest: calm deepens the glow of the layer it entrusts
    const L = this.layers[Math.min(6, this.k)];
    L.glow = clamp(L.glow + ((this.reliable ? this.calm : 0) * dt) / RULES.glowSec);
    if (this.blockT >= b.dur) {
      this.pushN++;
      this.startPush();
    }
  }

  /** Every thing of every layer is out (with focus or by grace). */
  get allOut(): boolean { return this.layers.every(L => L.state === 'healing' || L.state === 'clear'); }

  /** A layer's share ends: what is left on it is taken by grace (a short sweep), and the next layer opens. */
  private endWindow(): void {
    const k = this.k;
    const L = this.layers[k];
    const left = L.hooks.filter(h => h.state !== 'gone' && !h.grace);
    if (left.length) {
      const dur = graceFor(left.length, this.plan.test);
      left.forEach((h, i) => {
        h.grace = true;
        h.graceFrom = this.t + (dur * 0.45 * i) / left.length;
        h.graceTo = h.graceFrom + dur * 0.55;
        if (h.state === 'cling') h.state = 'draw';
      });
      L.state = 'grace';
      this.emit({ type: 'grace', k, n: left.length });
      this.talk.hush();
      this.talk.ask('grace', 3, 6);
    }
    if (k < 6) this.openLayer(k + 1);
  }

  /** A sighted push draws the thing now at the player's rate. */
  private draw(dt: number): void {
    const L = this.layers[this.k];
    const h = this.active();
    if (h && this.rate > 0) {
      if (h.state === 'cling') {
        h.state = 'draw';
        this.emit({ type: 'loosen', k: this.k, i: h.i });
      }
      h.p = Math.min(1, h.p + (this.rate * dt) / Math.max(0.2, L.need));
      this.stallT = 0;
      if (h.p >= 1) this.release(h, false);
    } else if (h && this.sighted) {
      this.stallT += dt;
      if (this.stallT > 12 && !this.waited) {
        this.waited = true;
        this.talk.ask('wait', 2, 6);
      }
    }
  }

  /** A thing reached the light: counted (with focus) or taken (grace); the last one closes its layer. */
  private release(h: Hook, grace: boolean): void {
    h.state = 'gone';
    h.p = 1;
    h.goneAt = this.t;
    if (grace) this.graceN++;
    else {
      this.score++;
      this.drawnTalk++;
      if (this.drawnTalk % 2 === 1) this.talk.ask('drawn', 1, 5);
    }
    this.emit({ type: 'drawn', k: h.layer, i: h.i, grace });
    const L = this.layers[h.layer];
    if ((L.state === 'open' || L.state === 'grace') && L.hooks.every(x => x.state === 'gone')) this.closeLayer(h.layer, grace);
  }

  private closeLayer(k: number, grace: boolean): void {
    const L = this.layers[k];
    L.state = 'healing';
    L.healAt = this.t;
    this.healedIn = true;
    this.lastHealed = k;
    this.emit({ type: 'healed', k });
    if (!grace) this.talk.ask('healed', 2, 6);
    if (k === this.k && k < 6) {
      // cleared early: the next layer opens at once, with the time its share and this one's leave
      this.openLayer(k + 1);
    } else if (k === 6 && this.pushBlock) {
      // the last layer cleared: the push ends once it has closed (and no sooner than minPush)
      this.block.dur = Math.min(this.block.dur, Math.max(this.blockT + RULES.healSec, RULES.minPush));
    }
  }

  private beginRest(): void {
    const L = this.layers[Math.min(6, this.k)];
    L.rests++;
    // a passage in every rest of two or more breaths; with one breath, every other rest of the layer
    const two = this.plan.restBreaths >= 2;
    this.card = two || L.rests % 2 === 1 ? layerVerse(this.k, two ? L.rests : Math.ceil(L.rests / 2), this.session) : null;
    if (this.firstSessions) this.coach('rest');
    if (L.rests % 3 === 2) this.talk.ask('rest', 1, 6);
  }

  /** Things taken by grace rise in turn (in any block: a sweep may run on into a rest or the whole). */
  private updateGrace(): void {
    for (const L of this.layers) {
      if (L.state !== 'grace') continue;
      for (const h of L.hooks) {
        if (!h.grace || h.state === 'gone') continue;
        if (this.t >= h.graceTo) this.release(h, true);
        else if (this.t >= h.graceFrom) h.p = Math.max(h.p, (this.t - h.graceFrom) / Math.max(0.1, h.graceTo - h.graceFrom));
      }
    }
  }

  /** The grace is running now (on any layer). */
  get graceOn(): boolean { return this.layers.some(L => L.state === 'grace'); }

  // ── the whole and the close ───────────────────────────────────

  private enterWhole(): void {
    // any layer still open (the time ran out before its share was spent) gives what is left to the Light now
    for (let k = 0; k < 7; k++) {
      if (this.layers[k].state === 'open' || this.layers[k].state === 'wait') {
        this.k = k;
        if (this.layers[k].state === 'wait') this.layers[k].state = 'open';
        this.endWindow();
      }
    }
    this.k = 7;
    this.setStage('whole');
    this.card = VERSES.whole[0];
    const dur = Math.max(0, this.plan.wholeEnd - this.t);
    if (dur < 1) {
      this.enterClose();
      return;
    }
    this.setBlock('rest', 'whole', dur);
    this.talk.ask('whole', 3, 8);
  }

  private updateWhole(dt: number): void {
    for (const L of this.layers) L.glow = clamp(L.glow + (this.reliable ? this.calm : 0) * dt / (RULES.glowSec * 2));
    if (this.t >= this.plan.wholeEnd) this.enterClose();
  }

  private enterClose(): void {
    this.setStage('close');
    this.card = this.closingVerse;
    this.setBlock('free', 'close', Math.max(1, this.T - this.t));
    this.talk.ask('close', 3, 6);
  }

  /** The closing passage (result().verse too). */
  get closingVerse(): PassageId { return sessionVerse('close', this.session); }

  // ── input ─────────────────────────────────────────────────────

  /** A tap: the words glow again (never light). */
  stay(): boolean {
    if (!this.started) return false;
    this.reshowUntil = this.t + RULES.reshowSec;
    this.emit({ type: 'tap' });
    return true;
  }

  key(key: string, down: boolean): boolean {
    if (!down) return false;
    if (key === ' ' || key === 'Enter') return this.stay();
    return false;
  }

  // ── what the runner reads ─────────────────────────────────────

  canStop(): boolean { return this.t >= this.T; }

  /** The runner's gauge: the thread's light in a push (null without a signal), calm in a rest. */
  meter(): number | null {
    if (this.pushBlock) return this.reliable ? clamp(this.light) : null;
    if (this.restBlock) return this.reliable ? clamp(this.calm) : null;
    return null;
  }

  /** The block's end is near: the next block's kind is telegraphed. */
  get telegraphed(): boolean {
    const b = this.block;
    return Number.isFinite(b.dur) && b.dur - this.blockT <= RULES.telegraph && b.dur > RULES.telegraph + 1 && this.nextKind !== null;
  }

  get nextKind(): BlockKind | null {
    switch (this.block.what) {
      case 'arrive': return 'push';
      case 'draw': return 'rest';
      case 'entrust': return 'push';
      case 'whole': return 'free';
      default: return null;
    }
  }

  /** What the band asks now, in the panel's words. */
  get tip(): string {
    switch (this.block.what) {
      case 'arrive': return t('task.arrive');
      case 'draw': return t(this.allOut ? 'task.heal' : 'task.draw');
      case 'entrust': return t('task.rest');
      case 'whole': return t('task.whole');
      default: return t('task.close');
    }
  }

  /** The headline's second line. */
  get subLine(): string {
    if (this.stage === 'layers' && this.k < 7) return this.graceOn ? t('sub.grace') : t('sub.layer', { i: this.k + 1 });
    return t(this.stage === 'arrive' ? 'stage.arrive' : this.stage === 'whole' ? 'stage.whole' : 'stage.close');
  }

  /** The layer whose prayer a rest prays: the one open now (the last after the last). */
  get restLayer(): LayerRun { return this.layers[Math.min(6, this.k)]; }

  /**
   * The prayer now: the arrival's, the layer's (its first while it is drawn, then the two in turn in its rests — so a
   * layer cleared within one push still has its prayer said), the whole's, the close's.
   */
  get prayer(): string {
    if (this.stage === 'arrive') return t('pray.arrive');
    if (this.stage === 'whole') return t('pray.whole');
    if (this.stage === 'close') return t('pray.close');
    const L = this.restLayer;
    return t(`pray.${L.id}.${!this.restBlock || L.rests % 2 === 1 ? 1 : 2}` as Key);
  }

  /** What a push shows now: the layer's picture in words ('' elsewhere). */
  get goal(): string {
    return this.stage === 'layers' && this.pushBlock && !this.allOut ? t(`goal.${this.restLayer.id}` as Key) : '';
  }

  /** A rest after a push in which a layer closed opens with thanks (the grace's words while the Light takes). */
  get thanks(): string {
    if (this.stage !== 'layers' || !this.restBlock) return '';
    if (this.graceOn) return t('pray.grace');
    return this.healedIn ? t('pray.healed') : '';
  }

  /** The player's own line for the layer now ('' when none or off). */
  get own(): string {
    return this.stage === 'layers' ? ownLine(this.p, this.restLayer.id) : '';
  }

  coachWords(what: Coach, touch: boolean): string {
    if (what === 'tap') return t(touch ? 'coach.tap' : 'coach.click');
    return t(`coach.${what}` as Key);
  }

  /** Things on each layer, and in all. */
  get total(): number { return this.layers.reduce((s, L) => s + L.hooks.length, 0); }
  /** Layers that have closed (or are closing). */
  get cleared(): number { return this.layers.filter(L => L.state === 'healing' || L.state === 'clear').length; }

  // ── the session's end ─────────────────────────────────────────

  /** Settle the session once (the runner's finish(), or the session's end): the records, the pace. */
  finish(): void {
    if (this.credited || !this.started) return;
    this.credited = true;
    const p = this.p;
    p.sessions = this.session;
    p.best = Math.max(p.best, this.score);
    p.threads += this.score;
    p.grace += this.graceN;
    p.layers += this.cleared;
    if (this.cleared === 7 && this.graceN === 0 && this.score === this.total) p.whole += 1;
    p.pace = learnPace(p.pace, this.paceFoc, this.paceSec);
  }

  result(): ArcadeOutcome {
    const stats: [string, string][] = [];
    stats.push([t('stat.threads'), t('stat.threadsV', { n: this.score, of: this.total })]);
    stats.push([t('stat.layers'), t('stat.layersV', { n: this.cleared })]);
    if (this.graceN > 0) stats.push([t('stat.grace'), String(this.graceN)]);
    if (this.calmT >= 10) stats.push([t('stat.calm'), t('stat.calmV', { n: Math.round((100 * this.calmSum) / this.calmT) })]);
    const highlights: string[] = [];
    if (this.cleared === 7) highlights.push(t(this.graceN === 0 && this.score === this.total ? 'hl.all' : 'hl.whole'));
    if (this.graceN > 0) highlights.push(t('hl.grace'));
    const record = this.score > 0 && (this.bestBefore === null || this.score > this.bestBefore);
    if (record && this.bestBefore !== null) highlights.push(t('hl.record'));
    return { score: this.score, unit: unit(this.score), record, stats, highlights, verse: this.closingVerse };
  }

  /** How long a passage on the band stays to be read (s). */
  static readFor(id: PassageId): number { return readTime(passage(id).text); }

  /** For tests and the debug view. */
  get debug(): Record<string, unknown> {
    return {
      stage: this.stage, block: `${this.block.kind}:${this.block.what}`, t: Math.round(this.t), blockT: Math.round(this.blockT * 10) / 10,
      k: this.k, push: this.pushN, sighted: Math.round(this.sightedT), score: this.score, grace: this.graceN, total: this.total, cleared: this.cleared,
      need: this.layer ? Math.round(this.layer.need * 100) / 100 : null,
    };
  }
}
