/**
 * Złote serce's session, without the canvas (DESIGN.md §21): the way of one session over the plan of rules.ts — the
 * arrival, the gathering piece by piece (lift → wash → lay), the grace that gathers what is left, the gold poured
 * along the seams, the beat, the radiance and the blessing — what the focus drives, what the band is asked, what the
 * narrator says, and the session's numbers.
 *
 * Light only from real focus (§18.3–18.4): a piece rises, settles and the gold flows only in a sighted push past its
 * lead-in, with a reliable signal, while focused, at `focusRate` (the level averaged over a whole breath).  Without
 * focus the hands of light wait — nothing is forced, nothing is lost; washing, the beat and the radiance are
 * receptive (whole breaths).  The plan is time-boxed: when the gathering's time ends, the pieces still on the cloth
 * are gathered by grace, so the heart is always whole for the gold; the gold not poured stays a fine dark seam.
 *
 * Own words never leave the progress: result() carries only numbers and the catalog's sentences.
 */
import { breathAt, breathCycle, breathOk, type BreathPattern, type BreathState } from '../kit/breath';
import type { FocusFrame, FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import type { Rhythm } from '../kit/rhythm';
import { inTurn, passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import { QUALITIES, SET_LEN, VERSES, verseFor, type Moment, type Quality, type StageId } from './content';
import { buildHeart, seamFill, type HeartGeo } from './heart';
import { t, unit, type Key } from './i18n';
import { BREATH_DEF, addWeight, bestOf, cleanWeight, migrate, wordsOn, type KintsugiProgress } from './meta';
import { RULES, focusRate, graceFor, planFor, readTime, type Plan } from './rules';
import { Talk } from './talk';

export type BlockKind = 'rest' | 'push' | 'free';
/** What a block is about: the arrival, a lift-and-lay (move), a wash, a pause (a rest without washing), the grace, a pour, a rest in the gold (cool), the beat, the radiance, the close. */
export type BlockWhat = 'arrive' | 'move' | 'wash' | 'pause' | 'grace' | 'pour' | 'cool' | 'beat' | 'radiance' | 'close';
export interface Block { kind: BlockKind; what: BlockWhat; t0: number; dur: number }

export type PieceState = 'cloth' | 'lift' | 'held' | 'wash' | 'clean' | 'lay' | 'home';
export interface PieceRun {
  id: number;
  state: PieceState;
  /** the current motion's progress (a lift or a lay), 0..1 */
  p: number;
  /** how clean it is, 0..1 (washing) */
  washed: number;
  /** gathered by grace (its times in the sweep: when it rises and when it is home) */
  grace: boolean;
  /** it was in the hands when the grace came (it flies home from there, not from the cloth) */
  graceHeld: boolean;
  graceFrom: number;
  graceTo: number;
  /** the word written on it ('' for none) */
  word: string;
  /** when it settled home (s of play) */
  homeAt: number;
}

export type Coach = 'lift' | 'wash' | 'gold' | 'tap';

export type SimEvent =
  | { type: 'stage'; stage: StageId }
  | { type: 'block'; kind: BlockKind; what: BlockWhat }
  | { type: 'lift'; id: number }
  | { type: 'held'; id: number }
  | { type: 'cleaned'; id: number }
  | { type: 'placed'; id: number; grace: boolean }
  | { type: 'grace'; ids: number[] }
  | { type: 'seam'; id: number; n: number }
  | { type: 'gilded' }
  | { type: 'beat'; strong: boolean }
  | { type: 'quality'; q: Quality }
  | { type: 'rated'; n: number }
  | { type: 'tap' }
  | { type: 'coach'; what: Coach };

/** A passage on the band: since when, for how long. */
export interface Card { id: PassageId; t0: number; dur: number }

export interface SimOpts {
  progress: KintsugiProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  rhythm?: Rhythm | null;
  day: string;
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

/** The words on the pieces, in the gathering's order: a themed set shuffled, own words in their order, or none. */
export function wordsFor(p: KintsugiProgress, n: number, rng: () => number): string[] {
  const out = new Array<string>(n).fill('');
  if (!wordsOn(p)) return out;
  if (p.words === 'own') {
    p.own.slice(0, n).forEach((w, i) => { out[i] = w; });
    return out;
  }
  const idx = Array.from({ length: SET_LEN }, (_, i) => i + 1);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  for (let i = 0; i < Math.min(n, idx.length); i++) out[i] = t(`w.${p.words}.${idx[i]}` as Key);
  return out;
}

export class KintsugiSim {
  readonly p: KintsugiProgress;
  readonly plan: Plan;
  readonly geo: HeartGeo;
  readonly pieces: PieceRun[];
  readonly talk: Talk;
  readonly breathPattern: BreathPattern;
  readonly eeg: boolean;
  started = false;
  stage: StageId = 'arrive';
  block: Block = { kind: 'rest', what: 'arrive', t0: 0, dur: 0 };
  blockT = 0;
  t = 0;
  /** the pieces' ids still on the cloth, in the gathering's order */
  readonly queue: number[];
  /** the piece in the hands of light (rising, held, washing, clean, settling), or null */
  held: number | null = null;
  /** focus-seconds a lift or a lay asks, and the gold (all of it) */
  readonly taskNeed: number;
  readonly goldNeed: number;
  /** gold poured (focus-seconds) and the front along the seams (heart units) */
  poured = 0;
  front = 0;
  private full = 0;
  /** seams fully gilded */
  score = 0;
  goldDoneAt: number | null = null;
  /** the stage ends as the session goes (the beat and the radiance re-split when the gold ends early) */
  beatEnd: number;
  radianceEnd: number;
  /** what the focus does this frame (focus-seconds a second), the light shown (smoothed level), calm */
  rate = 0;
  light = 0;
  calm = 0;
  reliable = false;
  /** the beat: beats a minute, its phase (beats since its start), whether the band's pulse leads it */
  bpm: number = RULES.bpmCalm;
  beatPhase = 0;
  pulseLed = false;
  /** the mean pulse the beat followed (bpm), for the summary */
  bpmSeen: number = RULES.bpmCalm;
  private bpmN = 0;
  beatStart: number | null = null;
  /** the radiance's qualities opened so far */
  qualities: Quality[] = [];
  /** the passage on the band (rests only) */
  card: Card | null = null;
  /** "how do you feel now", 0 (very heavy) … 10 (light and well): the after, and the before this session carries */
  rating: number | null = null;
  /** a "1" typed in the close waits a moment for a "0" (10) */
  private keyOne = -1;
  readonly before: number | null;
  /** a tap makes the words glow again until this time */
  reshowUntil = 0;
  /** the runner's coach mark is up until this time (the narrator waits) */
  hintUntil = 0;
  /** the light the session gave in its pushes (mean level, for the aura) */
  private pushLight = 0;
  private pushT = 0;
  private stallT = 0;
  private waited = false;
  private overT = 0;
  private gatherDone = false;
  private washes = 0;
  private cools = 0;
  private lifts = 0;
  private credited = false;
  private readonly mean = new WindowMean(RULES.meanSec);
  private readonly events: SimEvent[] = [];
  private readonly rng: () => number;
  private readonly bestBefore: number | null;
  private readonly session: number;
  private readonly day: string;
  private readonly firstSessions: boolean;
  private readonly washBreaths: number;

  constructor(o: SimOpts) {
    this.p = migrate(o.progress);
    this.rng = o.rng;
    this.eeg = o.eeg;
    this.day = o.day;
    this.breathPattern = breathOk(this.p.breath) ? this.p.breath : BREATH_DEF;
    const cyc = breathCycle(this.breathPattern);
    this.plan = planFor({
      plannedSec: o.plannedSec, cyc, eeg: o.eeg, focus: o.rhythm?.focus ?? null, rest: o.rhythm?.rest ?? null, custom: !!o.rhythm?.custom,
    });
    this.washBreaths = this.plan.wash;
    this.taskNeed = this.plan.taskNeed;
    this.goldNeed = Math.max(0.5, this.plan.goldNeed);
    this.geo = buildHeart(this.plan.pieces, o.rng);
    const words = wordsFor(this.p, this.plan.pieces, o.rng);
    this.pieces = this.geo.pieces.map(pc => ({ id: pc.id, state: 'cloth', p: 0, washed: 0, grace: false, graceHeld: false, graceFrom: 0, graceTo: 0, word: '', homeAt: -1 }));
    this.geo.order.forEach((id, i) => { this.pieces[id].word = words[i] ?? ''; });
    this.queue = [...this.geo.order];
    this.talk = new Talk(o.rng);
    this.talk.fresh = this.plan.T > RULES.long.from ? RULES.talkFresh : 0;
    this.beatEnd = this.plan.beatEnd;
    this.radianceEnd = this.plan.radianceEnd;
    this.bestBefore = bestOf(this.p);
    this.session = this.p.sessions + 1;
    this.before = cleanWeight(this.p.before);
    this.firstSessions = this.p.sessions < 2;
  }

  // ── the clock ─────────────────────────────────────────────────

  get T(): number { return this.plan.T; }
  get lead(): number { return this.plan.lead; }
  get cyc(): number { return this.plan.cyc; }
  get pushBlock(): boolean { return this.block.kind === 'push'; }
  get restBlock(): boolean { return this.block.kind === 'rest'; }
  get sighted(): boolean { return this.pushBlock && this.blockT >= this.lead; }
  /** the block's seconds left (Infinity: until its task is done) */
  get left(): number { return Math.max(0, this.block.dur - this.blockT); }
  /** the breath now (rest blocks count it from their start; elsewhere from the session's) */
  get breath(): BreathState { return breathAt(this.breathPattern, this.restBlock ? this.blockT : this.t); }
  /** whole breaths of the current rest */
  get breaths(): number { return Math.max(1, Math.round(this.block.dur / this.cyc)); }

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

  private showVerse(id: PassageId, dur?: number): void {
    this.card = { id, t0: this.t, dur: dur ?? Math.max(6, readTime(passage(id).text)) };
    this.shownAt.set(id, this.t);
  }

  /** When each passage was last shown (the long sessions' rule: a rest's passage comes back after talkFresh s). */
  private readonly shownAt = new Map<PassageId, number>();

  /** A rest's passage may show now: always in sessions of 30 minutes and less; over that, not twice within talkFresh. */
  private verseOk(id: PassageId): boolean {
    if (this.T <= RULES.long.from) return true;
    const at = this.shownAt.get(id);
    return at === undefined || this.t - at >= RULES.talkFresh;
  }

  update(dt: number, f: FocusFrame, now: number): void {
    if (!this.started) return;
    const step = Math.max(0, Math.min(0.25, dt));
    this.t = now;
    if (this.keyOne >= 0 && now - this.keyOne > RULES.keyTen) this.commitOne();
    this.blockT += step;
    this.reliable = f.reliable;
    if (f.reliable) this.mean.push(f.level, step);
    this.rate = this.sighted && f.reliable ? focusRate(this.mean.value ?? f.level, f.focused, f.hold) : 0;
    const shown = this.pushBlock ? (f.reliable ? f.level : 0.15) : 0.35;
    this.light = approach(this.light, shown, step, RULES.showTau);
    this.calm = approach(this.calm, f.reliable ? f.calm : 0, step, 1.5);
    if (this.sighted && f.reliable) {
      this.pushLight += f.level * step;
      this.pushT += step;
    }
    switch (this.stage) {
      case 'arrive': this.updateArrive(); break;
      case 'gather': this.updateGather(step); break;
      case 'gold': this.updateGold(step); break;
      case 'beat': this.updateBeat(step); break;
      case 'radiance': this.updateRadiance(step); break;
      case 'close': this.updateClose(step); break;
    }
    if (this.card && this.t > this.card.t0 + this.card.dur) this.card = null;
    const blocked = this.t < this.hintUntil || this.blockT < 1.2;
    this.talk.update(step, this.t, blocked);
  }

  // ── the arrival ───────────────────────────────────────────────

  private updateArrive(): void {
    const A = this.plan.arriveEnd;
    if (!this.card && this.blockT > Math.min(this.cyc, A * 0.4) && this.blockT < A - 4) this.showVerse(verseFor('arrive', this.session), A - this.blockT);
    if (this.t >= A) this.enterGather();
  }

  // ── the gathering ─────────────────────────────────────────────

  private enterGather(): void {
    this.setStage('gather');
    this.startMove();
  }

  /** A lift-and-lay block: lay the clean piece in the hands (if any), then lift the next from the cloth. */
  private startMove(): void {
    this.setBlock('push', 'move', Infinity);
    const h = this.held !== null ? this.pieces[this.held] : null;
    if (h && h.state === 'clean') {
      h.state = 'lay';
      h.p = 0;
      if (this.rng() < 0.4) this.talk.ask('lay', 1, 6);
    } else if (!h) this.beginLift();
    if (this.firstSessions) this.coach('lift');
  }

  private beginLift(): void {
    const id = this.queue.shift();
    if (id === undefined) return;
    const pc = this.pieces[id];
    pc.state = 'lift';
    pc.p = 0;
    this.held = id;
    this.lifts++;
    this.talk.ask(this.lifts === 1 ? 'liftFirst' : 'lift', this.lifts === 1 ? 2 : 1, 7);
  }

  /** The piece the hands are working on now, and its task. */
  get task(): 'lift' | 'lay' | null {
    const h = this.held !== null ? this.pieces[this.held] : null;
    return h?.state === 'lift' ? 'lift' : h?.state === 'lay' ? 'lay' : null;
  }

  private updateGather(dt: number): void {
    const b = this.block;
    // the time-box: what is left is gathered by grace
    if (b.what !== 'grace' && this.t >= this.plan.gatherEnd && this.pieces.some(pc => pc.state !== 'home')) {
      this.startGrace();
      return;
    }
    if (b.what === 'grace') {
      this.updateGrace();
      return;
    }
    if (b.kind === 'push') {
      const h = this.held !== null ? this.pieces[this.held] : null;
      const need = Math.max(0.3, this.taskNeed);
      if (h && (h.state === 'lift' || h.state === 'lay') && this.rate > 0) {
        if (h.state === 'lift' && h.p === 0) this.emit({ type: 'lift', id: h.id });
        h.p = Math.min(1, h.p + (this.rate * dt) / need);
        this.stallT = 0;
        if (h.p >= 1) {
          if (h.state === 'lift') {
            h.state = 'held';
            h.p = 1;
            this.emit({ type: 'held', id: h.id });
          } else {
            h.state = 'home';
            h.homeAt = this.t;
            this.held = null;
            this.emit({ type: 'placed', id: h.id, grace: false });
            if (this.queue.length) this.beginLift();
          }
        }
      } else if (this.sighted) {
        this.stallT += dt;
        if (this.stallT > 12 && !this.waited) {
          this.waited = true;
          this.talk.ask('wait', 2, 6);
        }
      }
      const hh = this.held !== null ? this.pieces[this.held] : null;
      // lifted: the wash comes (after the block's least length)
      if (hh && hh.state === 'held' && this.blockT >= RULES.minPush) {
        this.startWash();
        return;
      }
      // every piece home: the gold
      if (!hh && !this.queue.length && this.pieces.every(pc => pc.state === 'home')) {
        if (this.blockT >= RULES.minPush || this.t >= this.plan.gatherEnd) this.endGather();
        return;
      }
      if (this.stallT >= RULES.stallSec) this.startRest('pause');
      return;
    }
    // a rest: the wash (receptive, whole breaths) or a pause
    if (b.what === 'wash' && this.held !== null) {
      const h = this.pieces[this.held];
      h.washed = clamp(this.blockT / Math.max(0.1, b.dur));
      this.washVerse();
    }
    if (this.blockT >= b.dur) {
      if (b.what === 'wash' && this.held !== null) {
        const h = this.pieces[this.held];
        h.washed = 1;
        h.state = 'clean';
        this.emit({ type: 'cleaned', id: h.id });
      }
      this.startMove();
    }
  }

  private startWash(): void {
    const h = this.pieces[this.held!];
    h.state = 'wash';
    h.washed = 0;
    this.washes++;
    this.startRest('wash');
    this.talk.ask('wash', 1, 5);
    if (this.firstSessions) this.coach('wash');
  }

  private startRest(what: BlockWhat): void {
    this.setBlock('rest', what, this.washBreaths * this.cyc);
  }

  /** A wash's passage: from its second breath when it has two or more; with one breath, every other wash. */
  private washVerse(): void {
    if (this.card) return;
    const B = this.breaths;
    const show = B >= 2 ? this.blockT >= this.cyc * 0.95 : this.washes % 2 === 1 && this.blockT >= 0.6;
    if (!show) return;
    const home = this.pieces.filter(pc => pc.state === 'home').length;
    const half = home >= Math.ceil(this.pieces.length / 2) && home - 1 < Math.ceil(this.pieces.length / 2);
    const id: PassageId = this.washes === 1 ? VERSES.lift[0] : half ? verseFor('join', this.session) : verseFor('wash', this.session, this.washes);
    if (this.verseOk(id)) this.showVerse(id, Math.max(2, this.block.dur - this.blockT));
  }

  /** The grace's sweep: every piece not yet home rises, is washed and laid in turn, gently. */
  private startGrace(): void {
    const left = this.pieces.filter(pc => pc.state !== 'home');
    const dur = graceFor(left.length, this.T);
    this.setBlock('free', 'grace', dur);
    this.card = null;
    // the piece in the hands first, then the cloth's in the gathering's order
    const ids = [...(this.held !== null ? [this.held] : []), ...this.queue.filter(id => this.pieces[id].state !== 'home')];
    const n = Math.max(1, ids.length);
    ids.forEach((id, i) => {
      const pc = this.pieces[id];
      pc.grace = true;
      pc.graceHeld = pc.state !== 'cloth' && !(pc.state === 'lift' && pc.p === 0);
      pc.graceFrom = this.t + (dur * 0.55 * i) / n;
      pc.graceTo = pc.graceFrom + dur * 0.45;
    });
    this.queue.length = 0;
    this.held = null;
    this.talk.hush();
    this.talk.ask('grace', 3, 6);
    this.emit({ type: 'grace', ids });
  }

  private updateGrace(): void {
    for (const pc of this.pieces) {
      if (!pc.grace || pc.state === 'home') continue;
      if (this.t >= pc.graceTo) {
        pc.state = 'home';
        pc.washed = 1;
        pc.p = 1;
        pc.homeAt = this.t;
        this.emit({ type: 'placed', id: pc.id, grace: true });
      } else if (this.t >= pc.graceFrom) {
        const k = (this.t - pc.graceFrom) / Math.max(0.1, pc.graceTo - pc.graceFrom);
        pc.state = k < 0.3 ? 'lift' : k < 0.62 ? 'wash' : 'lay';
        pc.washed = Math.max(pc.washed, clamp((k - 0.25) / 0.4));
        pc.p = pc.state === 'lift' ? k / 0.3 : pc.state === 'lay' ? (k - 0.62) / 0.38 : 1;
      }
    }
    if (this.blockT >= this.block.dur || this.pieces.every(pc => pc.state === 'home')) {
      for (const pc of this.pieces) if (pc.state !== 'home') { pc.state = 'home'; pc.washed = 1; pc.homeAt = this.t; this.emit({ type: 'placed', id: pc.id, grace: true }); }
      this.endGather();
    }
  }

  private endGather(): void {
    if (this.gatherDone) return;
    this.gatherDone = true;
    this.enterGold();
  }

  /** Pieces gathered with the player's focus, and by grace. */
  get gathered(): { care: number; grace: number } {
    let care = 0, grace = 0;
    for (const pc of this.pieces) if (pc.state === 'home') { if (pc.grace) grace++; else care++; }
    return { care, grace };
  }

  // ── the gold ──────────────────────────────────────────────────

  private goldPush = 0;

  private enterGold(): void {
    this.setStage('gold');
    const win = Math.max(1, this.plan.goldEnd - this.t);
    const restSec = this.plan.goldRest * this.cyc;
    const k = Math.max(1, Math.round((win + restSec) / (this.plan.goldPush + restSec)));
    this.goldPush = Math.max(this.lead + 1, (win - (k - 1) * restSec) / k);
    this.startPour();
    this.talk.ask('gold', 2, 8);
    if (this.firstSessions) this.coach('gold');
  }

  private startPour(): void {
    const left = this.plan.goldEnd - this.t;
    const restSec = this.plan.goldRest * this.cyc;
    // the last push takes what is left when another would not fit after a rest
    const dur = left - this.goldPush < restSec + this.lead + RULES.pushTail ? left : this.goldPush;
    this.setBlock('push', 'pour', Math.max(1, dur));
  }

  /** The gold's share poured (0..1). */
  get goldFrac(): number { return clamp(this.poured / this.goldNeed); }
  /** Every seam gilded. */
  get gilded(): boolean { return this.full >= this.geo.seams.length; }

  private updateGold(dt: number): void {
    const b = this.block;
    if (b.kind === 'push') {
      if (this.rate > 0 && !this.gilded) {
        this.poured = Math.min(this.goldNeed, this.poured + this.rate * dt);
        this.stallT = 0;
      } else if (this.sighted && !this.gilded) {
        this.stallT += dt;
        if (this.stallT > 12 && !this.waited) {
          this.waited = true;
          this.talk.ask('goldWait', 2, 6);
        }
      }
      this.front = this.geo.reach * this.goldFrac;
      this.countSeams();
    }
    if (this.t >= this.plan.goldEnd) {
      this.endGold();
      return;
    }
    if (this.blockT >= b.dur) {
      if (b.kind === 'push') {
        if (this.gilded) { this.endGold(); return; }
        const restSec = this.plan.goldRest * this.cyc;
        this.setBlock('rest', 'cool', Math.min(restSec, this.plan.goldEnd - this.t));
        this.cools++;
        const gv = verseFor('gold', this.session, this.cools - 1);
        if ((this.cools % 2 === 1 || this.plan.goldRest >= 2) && this.verseOk(gv)) this.showVerse(gv, Math.max(3, this.block.dur));
      } else if (this.plan.goldEnd - this.t >= this.lead + RULES.pushTail) this.startPour();
      else this.endGold();
    }
  }

  private countSeams(): void {
    let full = 0;
    for (const s of this.geo.seams) if (seamFill(s, this.front) >= 0.999) full++;
    while (this.full < full) {
      this.full++;
      this.score = this.full;
      this.emit({ type: 'seam', id: this.full - 1, n: this.full });
      if (this.full >= this.geo.seams.length) {
        this.goldDoneAt = this.t;
        this.emit({ type: 'gilded' });
        this.talk.ask('goldDone', 3, 6);
      }
    }
  }

  private endGold(): void {
    this.front = this.geo.reach * this.goldFrac;
    this.countSeams();
    // the beat and the radiance share what is left before the close, in their planned proportion
    const P = this.plan;
    const share = (P.beatEnd - P.goldEnd) / Math.max(1e-6, P.radianceEnd - P.goldEnd);
    this.radianceEnd = Math.max(this.t, P.radianceEnd);
    this.beatEnd = this.t + (this.radianceEnd - this.t) * share;
    this.setStage('beat');
    this.beatStart = this.t;
    this.beatPhase = 0;
    this.setBlock('rest', 'beat', this.beatEnd - this.t);
    this.talk.ask('beat', 2, 8);
  }

  // ── the beat and the radiance ─────────────────────────────────

  /** How golden the heart has turned (0..1): over the beat, as far as the gold the player poured. */
  get tint(): number {
    if (this.beatStart === null) return 0;
    const span = Math.max(1, (this.beatEnd - this.beatStart) * RULES.tintShare);
    const k = clamp((this.t - this.beatStart) / span);
    return k * (0.2 + 0.8 * this.goldFrac);
  }

  /** The session's light: the mean level in its sighted pushes (0..1; 0.5 with no signal). */
  get sessionLight(): number { return this.pushT > 1 ? clamp(this.pushLight / this.pushT) : 0.5; }

  /** Beats a minute: the band's pulse when known and plausible, else a calm 60. */
  setPulse(bpm: number | null): void {
    const ok = bpm !== null && Number.isFinite(bpm) && bpm >= RULES.bpmMin && bpm <= RULES.bpmMax;
    this.pulseLed = this.pulseLed || ok;
    if (ok && this.beatStart !== null) {
      this.bpmN++;
      this.bpmSeen += (bpm! - this.bpmSeen) / this.bpmN;
    }
    const target = ok ? bpm! : RULES.bpmCalm;
    this.bpm = approach(this.bpm, target, 1 / 30, 3);
  }

  private beat(dt: number): void {
    const before = this.beatPhase;
    this.beatPhase += (dt * this.bpm) / 60;
    if (Math.floor(this.beatPhase) > Math.floor(before)) this.emit({ type: 'beat', strong: true });
    const dub = RULES.dubAt;
    if (Math.floor(this.beatPhase - dub) > Math.floor(before - dub) && this.beatPhase >= dub) this.emit({ type: 'beat', strong: false });
  }

  private updateBeat(dt: number): void {
    this.beat(dt);
    if (!this.card && this.blockT >= this.cyc * 0.9 && this.left > 6) this.showVerse(verseFor('beat', this.session), Math.max(6, this.left - 1));
    if (this.t >= this.beatEnd) {
      this.setStage('radiance');
      this.setBlock('rest', 'radiance', this.radianceEnd - this.t);
      this.talk.ask('radiance', 2, 8);
    }
  }

  private updateRadiance(dt: number): void {
    this.beat(dt);
    const len = Math.max(1, this.radianceEnd - this.block.t0);
    const k = this.blockT / len;
    const i = this.qualities.length;
    if (i < QUALITIES.length && k >= RULES.qualityAt[i]) {
      const q = QUALITIES[i];
      this.qualities.push(q);
      this.emit({ type: 'quality', q });
      const until = i + 1 < QUALITIES.length ? RULES.qualityAt[i + 1] * len - this.blockT : len - this.blockT;
      this.showVerse(verseFor(q, this.session), Math.max(4, until - 0.5));
    }
    if (this.t >= this.radianceEnd) this.enterClose();
  }

  // ── the close ─────────────────────────────────────────────────

  private enterClose(): void {
    this.setStage('close');
    this.setBlock('free', 'close', Math.max(1, this.T - this.t));
    this.talk.ask('close', 3, 6);
  }

  /** The close's blessing is on the band now (its first part), then the closing verse. */
  get blessing(): boolean { return this.stage === 'close' && this.blockT < Math.max(3, this.block.dur * 0.45); }
  /** The closing passage (result().verse too). */
  get closingVerse(): PassageId { return inTurn(VERSES.close, this.session); }

  private updateClose(dt: number): void {
    this.beat(dt);
    if (!this.blessing && !this.card) this.showVerse(this.closingVerse, Infinity);
    if (this.t >= this.T) this.overT += dt;
  }

  /** The 0–10 row shows in the close. */
  get rateOpen(): boolean { return this.stage === 'close'; }

  /** The player's "how do you feel now" (0 very heavy … 10 light and well), once. */
  rate10(n: number): boolean {
    if (!this.rateOpen || this.rating !== null) return false;
    const v = cleanWeight(n);
    if (v === null) return false;
    this.rating = v;
    this.emit({ type: 'rated', n: v });
    return true;
  }

  /** A "1" typed alone: after a moment it stands. */
  private commitOne(): void {
    this.keyOne = -1;
    this.rate10(1);
  }

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
    if (/^[0-9]$/.test(key) && this.rateOpen && this.rating === null) {
      const n = Number(key);
      // "1" then "0" is 10 (light and well); "1" alone, after a moment, is 1
      if (this.keyOne >= 0) { this.keyOne = -1; return this.rate10(n === 0 ? 10 : 1); }
      if (n === 1) { this.keyOne = this.t; return true; }
      return this.rate10(n);
    }
    if (key === ' ' || key === 'Enter') return this.stay();
    return false;
  }

  // ── what the runner reads ─────────────────────────────────────

  canStop(): boolean {
    if (this.t < this.T) return false;
    if (this.keyOne >= 0) return false;
    return this.rating !== null || this.overT >= RULES.rateWait || this.stage !== 'close';
  }

  /** The runner's gauge: the hands' light in a push (null without a signal), calm in a rest. */
  meter(): number | null {
    if (this.pushBlock) return this.reliable ? clamp(this.light) : null;
    if (this.restBlock) return this.reliable ? clamp(this.calm) : null;
    return null;
  }

  padLevel(): number | null { return null; }

  /** The next block's kind during its telegraph, or null. */
  get telegraphed(): boolean {
    const b = this.block;
    if (Number.isFinite(b.dur)) return b.dur - this.blockT <= RULES.telegraph && b.dur > RULES.telegraph + 1;
    const h = this.held !== null ? this.pieces[this.held] : null;
    return b.what === 'move' && !!h && h.state === 'lift' && h.p >= 0.8;
  }

  get nextKind(): BlockKind | null {
    const b = this.block;
    if (b.what === 'move') return 'rest';
    if (b.what === 'wash' || b.what === 'pause') return 'push';
    if (b.what === 'arrive') return 'push';
    if (b.what === 'pour') return 'rest';
    if (b.what === 'cool') return this.plan.goldEnd - (this.t + this.left) >= this.lead + RULES.pushTail ? 'push' : 'rest';
    if (b.what === 'beat') return 'rest';
    if (b.what === 'radiance') return 'free';
    return null;
  }

  /** What the band asks now, in the panel's words. */
  get tip(): string {
    const b = this.block;
    switch (b.what) {
      case 'arrive': return t('task.arrive');
      case 'move': return t(this.task === 'lay' ? 'task.lay' : 'task.lift');
      case 'wash': return t('task.wash');
      case 'pause': return t('task.pause');
      case 'grace': return t('task.grace');
      case 'pour': return t(this.gilded ? 'task.abide' : 'task.pour');
      case 'cool': return t('task.rest');
      case 'beat': return t('task.beat');
      case 'radiance': return t('task.radiance');
      default: return t('task.close');
    }
  }

  /** The headline's second line. */
  get subLine(): string {
    if (this.stage === 'gather') {
      if (this.block.what === 'grace') return t('sub.grace');
      const home = this.pieces.filter(pc => pc.state === 'home').length;
      return t('sub.piece', { i: Math.min(this.pieces.length, home + 1), n: this.pieces.length });
    }
    return t(`stage.${this.stage}` as Key);
  }

  coachWords(what: Coach, touch: boolean): string {
    if (what === 'tap') return t(touch ? 'coach.tap' : 'coach.click');
    return t(`coach.${what}` as Key);
  }

  // ── the session's end ─────────────────────────────────────────

  /** Settle the session once (the runner's finish(), or the close's end): the records, the before → after. */
  finish(): void {
    if (this.credited || !this.started) return;
    if (this.keyOne >= 0) this.commitOne();
    this.credited = true;
    const p = this.p;
    const g = this.gathered;
    p.sessions = this.session;
    p.best = Math.max(p.best, this.score);
    p.seams += this.score;
    p.pieces += g.care;
    p.grace += g.grace;
    if (this.geo.seams.length > 0 && this.gilded) p.golden += 1;
    if (this.rating !== null) addWeight(p, this.day, this.before, this.rating);
    // the before belongs to this session: the next one asks again
    p.before = null;
  }

  result(): ArcadeOutcome {
    const g = this.gathered;
    const all = this.geo.seams.length;
    const stats: [string, string][] = [];
    stats.push([t('stat.pieces'), t('stat.piecesV', { care: g.care, of: this.pieces.length })]);
    stats.push([t('stat.gold'), t('stat.goldV', { n: this.score, of: all })]);
    if (this.beatStart !== null) stats.push([t('stat.beat'), t('pulse', { n: Math.round(this.pulseLed ? this.bpmSeen : RULES.bpmCalm) })]);
    if (this.before !== null && this.rating !== null) stats.push([t('stat.feel'), t('stat.feelV', { a: this.before, b: this.rating })]);
    const highlights: string[] = [];
    if (all > 0 && this.gilded) highlights.push(t('hl.whole'));
    else highlights.push(t('hl.part'));
    if (g.grace > 0) highlights.push(t('hl.grace'));
    if (this.beatStart !== null && this.pulseLed) highlights.push(t('hl.pulse'));
    const record = this.score > 0 && (this.bestBefore === null || this.score > this.bestBefore);
    if (record && this.bestBefore !== null) highlights.push(t('hl.record'));
    return { score: this.score, unit: unit(this.score), record, stats, highlights, verse: this.closingVerse };
  }

  /** For tests and the debug view. */
  get debug(): Record<string, unknown> {
    return {
      stage: this.stage, block: `${this.block.kind}:${this.block.what}`, t: Math.round(this.t), blockT: Math.round(this.blockT * 10) / 10,
      held: this.held, home: this.pieces.filter(p => p.state === 'home').length, of: this.pieces.length, score: this.score, seams: this.geo.seams.length,
      gold: Math.round(this.goldFrac * 100), tint: Math.round(this.tint * 100), bpm: Math.round(this.bpm),
    };
  }
}

export type { Moment };
