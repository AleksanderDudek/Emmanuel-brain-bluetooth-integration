/**
 * Światło ciała's session, without the DOM (DESIGN.md §13.10, round 11).  Five meditations to choose; in each, the
 * light comes to one element after another — an organ, a muscle, a part of the brain, a segment of a limb, a
 * homeostatic loop — and only real focus fills it:
 *
 *   a push      fills the element in the light: at (fillBase + fillLevel × level + fillHold × hold/holdFull) /
 *               elementSec a second while the push is past its lead-in, the signal reliable and the player focused
 *               (the first-ever warm-up at half that rate); nothing fills without focus, nothing is ever lost
 *   full        the element glows, its fact card opens, and the push ends there — the rest always begins on a
 *               finished element (a push ends no sooner than minPush: an early fill flows on into the next element)
 *   a rest      of whole breaths (kit/breath, 4 in · 6 out): the whole lit body breathes, the fact is read, calm pours
 *               a little light; near its end the light moves on to the next element and the next push begins there
 *   blind       every 4th push from the 3rd session: the fill gathers unseen and is shown when the push ends
 *   valve       a push that cannot fill ends after maxPush anyway (a kind line; the element keeps its light)
 *
 * The hands walk (◀ ▶), choose another meditation (≡), and stay (a tap on the picture: the words again) — they never
 * fill anything.  Each meditation keeps its own place for the next session.  The headline is the light gathered (lux).
 * Blocks are judged once at their end over their last ≤ 15 s (RoundJudge.from(env.tuning)), BlockContrast for the
 * summary, a quiet finale at the end of the session.
 */
import { fmtNum } from '../../i18n';
import { BREATH_DEFAULT, breathAt, breathCycle, breathRest, breathRestOf, type BreathState } from '../kit/breath';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp, ease } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  LISTS, TIPS, VARIANTS, count, elFact, elGuide, elName, elementAt, isBrainView, kickOf, linesOf, variantName,
  type Element, type Kick, type VariantId, type View,
} from './content';
import { luxText, t, unit } from './i18n';
import { bestOf, lenKey, markSeen, type SwiatloProgress } from './meta';
import { RULES, readSec } from './rules';
import { Talk } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean; t0: number; end?: number; verdict?: boolean | null }

/**
 * Where the light is: `move` (it travels to the element), `turn` (the figure turns / the brain shows its inner face),
 * `dive` (the camera goes into the head), `at` (the element fills), `full` (it has just filled: a moment of glow),
 * `lit` (filled, the push over: its fact is read in the rest), `whole` (the meditation's last element: all of it lit).
 */
export type Stage = 'move' | 'turn' | 'dive' | 'at' | 'full' | 'lit' | 'whole';

export type StoryKind = 'open' | 'news' | 'whole';
export interface Story { kind: StoryKind; page: number; pages: number; t: number; variant: VariantId }

export type Coach = 'fill' | 'rest' | 'nav' | 'blind' | 'stay';
export type CoachAt = 'element' | 'card' | 'controls' | 'picker';

export type Via = 'start' | 'auto' | 'prev' | 'next' | 'pick';

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number }
  | { type: 'telegraph'; next: BlockKind | null }
  | { type: 'element'; id: string; via: Via; view: View; turned: boolean }
  | { type: 'tick'; id: string; k: number }
  | { type: 'lit'; id: string; lux: number; first: boolean; times: number }
  | { type: 'whole'; variant: VariantId; lux: number }
  | { type: 'gold'; on: boolean }
  | { type: 'filling'; on: boolean }
  | { type: 'breath'; phase: BreathState['phase'] }
  | { type: 'lux'; n: number; at: 'fill' | 'rest' | 'block' }
  | { type: 'blindEnd'; share: number; lux: number }
  | { type: 'coach'; what: Coach; at: CoachAt }
  | { type: 'story'; kind: StoryKind; page: number }
  | { type: 'picker'; open: boolean }
  | { type: 'stay' }
  | { type: 'pulse'; bpm: number }
  | { type: 'finale' }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];

/** The last stretch without a block: 12 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/** The first-ever warm-up: 30 s in sessions of 5 min and more, 20 s in shorter ones, 6 s (at most a third) in a test. */
export function warmFor(plannedSec: number): number {
  if (plannedSec <= 60) return Math.min(RULES.warm.test, Math.max(2, (plannedSec - finaleFor(plannedSec)) / 3));
  return plannedSec >= 300 ? RULES.warm.long : RULES.warm.short;
}

/** A rest of whole breaths of the default pattern: about restTarget s (one breath in a short test). */
export function restFor(plannedSec: number): number {
  return plannedSec <= 60 ? breathRestOf(BREATH_DEFAULT, RULES.shortRestBreaths).sec : breathRest(BREATH_DEFAULT, RULES.restTarget, RULES.restMin).sec;
}

/** The fill multiplier for a focus frame: faster with the level and with a sustained hold. */
export function fillMult(f: Pick<FocusFrame, 'level' | 'hold'>): number {
  return RULES.fillBase + RULES.fillLevel * clamp(f.level) + RULES.fillHold * Math.min(1, Math.max(0, f.hold) / RULES.holdFull);
}

/** Seconds as the summary says them: "42 s", "1:42". */
export function secText(s: number): string {
  const v = Math.max(0, Math.round(s));
  return v < 60 ? t('secs', { n: v }) : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

/** The closing verse of each meditation (its card at the end of a whole walk, and the summary). */
export const VERSE: Readonly<Record<VariantId, PassageId>> = {
  narzady: 'psa139.13-14', miesnie: 'eph4.16', mozg: 'isa26.3', konczyny: 'isa40.31', rownowaga: 'pro3.7-8',
};
export const ROOT: PassageId = 'mat6.22';

export interface SimInit {
  progress: SwiatloProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /** the player has a mouse, not a finger: the narrator says "click" where she speaks of the hands */
  mouse?: boolean;
}

export class SwiatloSim {
  readonly p: SwiatloProgress;
  readonly rng: () => number;
  readonly plannedSec: number;
  readonly eeg: boolean;
  readonly session: number;
  readonly firstEver: boolean;
  readonly talk: Talk;
  readonly contrast = new BlockContrast(4);
  private readonly judge: RoundJudge;
  private readonly lead: number;
  private readonly finaleSec: number;
  private readonly restSec: number;
  private readonly pushesBase: number;
  private readonly bestBefore: number | null;

  started = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  // the blocks (made as the session goes)
  readonly blocks: Block[] = [];
  blockT = 0;
  telegraphed = false;
  tip = '';
  private pushesBegun = 0;
  private relSec = 0;
  private valveSaid = false;
  // the way
  variant: VariantId;
  idx = 0;
  stage: Stage = 'move';
  stageT = 0;
  /** the view the light comes from (for a turn: front ↔ back, lat ↔ med; a dive: the body into the head) */
  fromView: View = 'front';
  via: Via = 'start';
  /** the element's fill (0..1, as shown) and what a blind push gathers unseen */
  fill = 0;
  hidden = 0;
  /** a blind push's fill being shown (from → to over revealSec; t < 0: none) */
  reveal = { from: 0, to: 0, t: -1 };
  /** fill that flowed past an element (a blind push's carry) into the next */
  private carry = 0;
  /** each element's fill this session (an element walked back to shows as it was left) */
  private readonly fills = new Map<string, number>();
  /** elements lit this session (in order) */
  readonly litNow: string[] = [];
  private tickK = 0;
  /** the push's element is done (the push may end) */
  private pushDone = false;
  /** the Równowaga loop's everyday push for the element in the light */
  kick: Kick | null = null;
  /** the round of the meditation in this session (a whole walk starts a new one) */
  round = 0;
  // the light and the signal
  light: number = RULES.baseLight;
  calmShown = 0;
  reliable = false;
  filling = false;
  mult = 1;
  private gold = false;
  private goldRun = 0;
  private goodSaid = false;
  private stillRun = 0;
  private stillSaid = false;
  private unrelT = 0;
  private noSigSaid = false;
  // the breath, the cards, the hands
  restT = 0;
  private lastPhase: BreathState['phase'] | null = null;
  story: Story | null = null;
  picker = false;
  private pickerT = 0;
  /** the fact card on screen (seconds shown; −1: none) and for which element */
  factT = -1;
  factId = '';
  factDepth = 1;
  /** a tap on the picture: the element's words glow again (s left) */
  reshow = 0;
  // the pulse (Mendi)
  pulse: number | null = null;
  private pushHr = { sum: 0, sec: 0 };
  private restHr = { sum: 0, sec: 0 };
  private hrAll = { sum: 0, sec: 0 };
  private slowedBy = 0;
  // lux and the tallies
  lux = 0;
  private luxAcc = 0;
  private luxTick = 0;
  fillSec = 0;
  calmSec = 0;
  wholeNow: VariantId[] = [];
  private passedRests = 0;
  private blindShare = -1;
  private settled = false;
  /** a coach mark of the runner is on screen until this time (s of play): the narrator waits */
  hintUntil = 0;
  private readonly events: SimEvent[] = [];

  constructor(init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = Math.max(10, init.plannedSec);
    this.eeg = init.eeg;
    this.session = this.p.sessions + 1;
    this.firstEver = this.p.sessions === 0;
    this.pushesBase = this.p.pushes;
    this.bestBefore = bestOf(this.p);
    this.judge = RoundJudge.from(init.tuning);
    this.lead = this.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
    this.finaleSec = finaleFor(this.plannedSec);
    this.restSec = restFor(this.plannedSec);
    this.talk = new Talk(m => linesOf(m, init.mouse === true), init.rng);
    this.variant = this.p.variant;
    const place = this.p.pos[this.variant];
    this.idx = Math.min(count(this.variant) - 1, Math.max(0, place.idx));
    this.fill = clamp(place.fill);
  }

  // ── what the view and the runner read ───────────────────────────
  get block(): Block { return this.blocks[this.blocks.length - 1] ?? { kind: 'warmup', dur: 0, blind: false, t0: 0 }; }
  get pushBlock(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get warmBlock(): boolean { return this.phase === 'play' && this.block.kind === 'warmup'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a sighted push past its lead-in: the light answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get leadIn(): number { return this.lead; }
  get score(): number { return Math.floor(this.lux); }
  get goldOn(): boolean { return this.gold; }
  get element(): Element { return elementAt(this.variant, this.idx); }
  /** the element's guidance line (what to notice or imagine there) */
  get guide(): string { return elGuide(this.element); }
  get count(): number { return count(this.variant); }
  get view(): View { return this.element.view; }
  /** the way into the stage now (0..1): a move, a turn or a dive */
  get wayK(): number {
    const d = this.stage === 'turn' ? RULES.turnSec : this.stage === 'dive' ? RULES.diveSec : this.stage === 'move' ? RULES.moveSec : 0;
    return d > 0 ? ease.inOutSine(clamp(this.stageT / d)) : 1;
  }
  /** the element's fill as the picture draws it */
  get shown(): number { return this.stage === 'full' || this.stage === 'lit' || this.stage === 'whole' ? 1 : this.fill; }
  /** elements lit (ever) in the current meditation, and whether one was */
  litEver(id: string): boolean { return (this.p.lit[id] ?? 0) > 0; }
  /** an element lit this session or before (the picture shows it lit) */
  isLit(id: string): boolean { return this.litNow.includes(id) || this.litEver(id); }
  /** the breath now (rest): its phase, progress, the lungs' fullness, the whole cycles */
  get breath(): BreathState { return breathAt(BREATH_DEFAULT, this.restBlock ? this.restT : 0); }
  get breathCycles(): number { return Math.round(this.restSec / breathCycle(BREATH_DEFAULT)); }
  /** the narrator must wait: a telegraph, the runner's banner, a story card, the picker, a coach mark */
  get talkBlocked(): boolean {
    if (this.story || this.picker || this.t < this.hintUntil || this.factShown) return true;
    if (this.phase !== 'play') return false;
    return this.telegraphed || this.blockT < RULES.bannerSec;
  }
  /** The next element in the meditation (round again after the last). */
  get nextElement(): Element { return elementAt(this.variant, (this.idx + 1) % this.count); }
  get fact(): { text: string; id: string; depth: number } | null {
    if (this.factT < 0 || !this.factId) return null;
    const e = LISTS[this.variant].find(x => x.id === this.factId);
    return e ? { text: elFact(e, this.factDepth), id: e.id, depth: this.factDepth } : null;
  }
  /** whether the fact card is still to be read (its reading time, or longer after a tap) */
  get factUp(): boolean {
    const f = this.fact;
    return !!f && this.factT < readSec(f.text) + this.factExtra;
  }
  private factExtra = 0;
  private litThisPush = false;
  /** the fact card is on screen: in a rest or the finale, or while its element glows */
  get factShown(): boolean {
    if (!this.factUp) return false;
    return this.restBlock || this.phase !== 'play' || ((this.stage === 'full' || this.stage === 'lit' || this.stage === 'whole') && this.element.id === this.factId);
  }

  // ── the session ────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.firstEver) this.beginBlock('warmup', warmFor(this.plannedSec));
    else this.beginBlock('push', Infinity);
    this.enter(this.idx, 'start', this.fill);
    if (this.firstEver) {
      markSeen(this.p, 's.news');
      if (markSeen(this.p, 's.open')) {
        this.story = { kind: 'open', page: 0, pages: 2, t: 0, variant: this.variant };
        this.emit({ type: 'story', kind: 'open', page: 0 });
      }
      this.talk.ask('open', 3, 40);
    } else if (markSeen(this.p, 's.news')) {
      this.story = { kind: 'news', page: 0, pages: 1, t: 0, variant: this.variant };
      this.emit({ type: 'story', kind: 'news', page: 0 });
      this.talk.ask('resume', 2, 30);
    } else this.talk.ask('resume', 2, 10);
  }

  /** One frame of play: `hr` = the band's pulse reading this frame (bpm, null: none). */
  update(dt: number, f: FocusFrame, now: number, hr: number | null = null): void {
    if (!this.started || this.phase === 'done') return;
    dt = Math.max(0, Math.min(0.1, dt));
    this.t = now;
    this.reliable = f.reliable && f.activity !== null;
    if (this.reliable) this.relSec += dt;
    this.readPulse(hr, dt);
    if (this.phase === 'play') this.schedule(dt, f, now);
    if (this.phase === 'finale' && now >= this.plannedSec) this.end();
    if ((this.phase as string) === 'done') return;
    this.updateLight(dt, f);
    this.updateBreath(dt);
    this.updateStory(dt);
    if (!this.story) this.updateWay(dt, f);
    else this.setFilling(false);
    this.updateLux(dt);
    if (this.factT >= 0) this.factT += dt;
    this.reshow = Math.max(0, this.reshow - dt);
    if (this.picker) {
      this.pickerT += dt;
      if (this.pickerT >= RULES.pickerIdle) this.closePicker();
    }
    this.talk.update(dt, now, this.talkBlocked);
  }

  private readPulse(hr: number | null, dt: number): void {
    const ok = hr !== null && Number.isFinite(hr) && hr >= 30 && hr <= 220;
    if (ok && this.pulse === null) {
      this.emit({ type: 'pulse', bpm: hr! });
      if (!this.p.pulseSeen) {
        this.p.pulseSeen = true;
        this.talk.ask('pulse', 2, 10);
      }
    }
    this.pulse = ok ? hr : null;
    if (!ok) return;
    this.hrAll.sum += hr! * dt;
    this.hrAll.sec += dt;
    if (this.sighted) { this.pushHr.sum += hr! * dt; this.pushHr.sec += dt; }
    if (this.restBlock && this.blockT >= 6) { this.restHr.sum += hr! * dt; this.restHr.sec += dt; }
  }

  private updateLight(dt: number, f: FocusFrame): void {
    let target: number = RULES.baseLight;
    if (this.restBlock) target = RULES.restLight;
    else if (this.sighted && this.reliable) target = clamp(f.level);
    this.light = approach(this.light, target, dt, RULES.lightTau);
    this.calmShown = approach(this.calmShown, this.restBlock && this.reliable ? clamp(f.calm) : 0, dt, 0.8);
    if (this.restBlock && this.reliable && f.calm >= 0.5) this.calmSec += dt;
    const gold = this.sighted && this.reliable && f.focused;
    if (gold !== this.gold) {
      this.gold = gold;
      this.emit({ type: 'gold', on: gold });
    }
    this.goldRun = gold ? this.goldRun + dt : 0;
    if (this.goldRun >= RULES.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 5);
    }
    this.unrelT = this.pushBlock && !this.reliable ? this.unrelT + dt : 0;
    if (this.unrelT > 3 && !this.noSigSaid) {
      this.noSigSaid = true;
      this.talk.ask('nosignal', 3, 8);
    }
  }

  private updateBreath(dt: number): void {
    if (!this.restBlock) {
      this.lastPhase = null;
      return;
    }
    this.restT += dt;
    const ph = this.breath.phase;
    if (ph !== this.lastPhase) {
      this.lastPhase = ph;
      this.emit({ type: 'breath', phase: ph });
    }
  }

  private updateStory(dt: number): void {
    const s = this.story;
    if (!s) return;
    s.t += dt;
    if (s.t >= (s.kind === 'whole' ? RULES.closeSec : RULES.pageSec)) this.turnStory();
  }

  /** The next page of a story card, or close it (a tap, or its time ran out). */
  private turnStory(): void {
    const s = this.story;
    if (!s) return;
    if (s.page + 1 < s.pages) {
      s.page++;
      s.t = 0;
      this.emit({ type: 'story', kind: s.kind, page: s.page });
      return;
    }
    this.story = null;
    if (s.kind === 'whole') this.afterWhole();
  }

  // ── filling (only with focus) ──────────────────────────────────
  /** The element may fill now: a push past its lead-in or the warm-up, the light at the element, nothing over it. */
  get canFill(): boolean {
    if (!this.started || this.phase !== 'play' || this.story || this.picker || this.stage !== 'at') return false;
    const b = this.block;
    return b.kind === 'warmup' || (b.kind === 'push' && this.blockT >= this.lead && !this.pushDone);
  }

  /** The fill per second for a focus frame now (0 without focus). */
  fillRate(f: FocusFrame): number {
    if (!this.canFill || !this.reliable || !f.focused) return 0;
    return (fillMult(f) / RULES.elementSec) * (this.warmBlock ? RULES.warmK : 1);
  }

  private setFilling(on: boolean): void {
    if (on === this.filling) return;
    this.filling = on;
    this.emit({ type: 'filling', on });
  }

  private updateWay(dt: number, f: FocusFrame): void {
    this.stageT += dt;
    switch (this.stage) {
      case 'move':
        this.setFilling(false);
        if (this.stageT >= RULES.moveSec) this.arrive();
        break;
      case 'turn':
        this.setFilling(false);
        if (this.stageT >= RULES.turnSec) this.arrive();
        break;
      case 'dive':
        this.setFilling(false);
        if (this.stageT >= RULES.diveSec) this.arrive();
        break;
      case 'at': {
        this.updateReveal(dt);
        const rate = this.fillRate(f);
        this.mult = rate > 0 ? fillMult(f) : this.mult;
        this.setFilling(rate > 0);
        this.watchStill(dt, f);
        if (rate <= 0) break;
        const df = rate * dt;
        this.fillSec += dt;
        if (this.blind) {
          this.hidden = Math.min(1 + RULES.blindCarry, this.hidden + df);
        } else {
          this.fill = Math.min(1, this.fill + df);
          this.ticks();
          this.lux += RULES.luxFill * this.mult * dt;
          this.luxAcc += RULES.luxFill * this.mult * dt;
        }
        break;
      }
      case 'full':
        this.setFilling(false);
        if (this.stageT >= 1.1) {
          if (this.pushBlock && !this.pushDone) this.step(+1, 'auto');
          else if (this.warmBlock) this.step(+1, 'auto');
          else this.stage = 'lit';
        }
        break;
      case 'lit':
        this.setFilling(false);
        break;
      case 'whole':
        this.setFilling(false);
        if (this.stageT >= RULES.wholeSec && !this.story) {
          this.closePicker();
          this.story = { kind: 'whole', page: 0, pages: 1, t: 0, variant: this.variant };
          this.emit({ type: 'story', kind: 'whole', page: 0 });
          this.stageT = -Infinity;
        }
        break;
    }
    if (this.stage === 'at' && this.fill >= 1 - 1e-9 && this.reveal.t < 0) this.complete();
  }

  /** A tenth of the element filled: a small event (a glint, a glass tone) so the sound follows the fill. */
  private ticks(): void {
    const k = Math.floor(this.fill * 10 + 1e-9);
    while (this.tickK < k && this.tickK < 10) {
      this.tickK++;
      this.emit({ type: 'tick', id: this.element.id, k: this.tickK });
    }
  }

  /** A blind push's fill shown at its end: the element fills quickly to where it got. */
  private updateReveal(dt: number): void {
    const r = this.reveal;
    if (r.t < 0) return;
    r.t += dt;
    const k = ease.outCubic(clamp(r.t / RULES.revealSec));
    this.fill = r.from + (r.to - r.from) * k;
    this.ticks();
    if (r.t >= RULES.revealSec) {
      this.fill = r.to;
      r.t = -1;
    }
  }

  private watchStill(dt: number, f: FocusFrame): void {
    const waiting = this.sighted && this.reliable && !f.focused;
    this.stillRun = waiting ? this.stillRun + dt : 0;
    if (this.stillRun >= RULES.stillSec && !this.stillSaid) {
      this.stillSaid = true;
      this.talk.ask('still', 1.5, 6);
    }
  }

  // ── the way through a meditation ───────────────────────────────
  /** Bring the light to element `i` (a move, a turn when the view changes, a dive into the head for the brain). */
  private enter(i: number, via: Via, fill?: number, fromEl?: Element): void {
    const prev = fromEl ?? (this.started && via !== 'start' ? this.element : null);
    if (prev) this.fills.set(prev.id, this.stage === 'full' || this.stage === 'lit' || this.stage === 'whole' ? 1 : this.fill);
    this.idx = Math.max(0, Math.min(this.count - 1, i));
    const e = this.element;
    const brainNow = isBrainView(e.view);
    const from: View = prev ? prev.view : brainNow ? 'front' : e.view;
    this.fromView = from;
    this.via = via;
    const turned = from !== e.view;
    // into the head (or out of it) is a dive; front ↔ back and the brain's face ↔ its middle are turns
    this.stage = brainNow !== isBrainView(from) ? 'dive' : turned ? 'turn' : 'move';
    this.stageT = 0;
    let f = clamp(fill ?? this.fills.get(e.id) ?? 0);
    if (f >= 1 - 1e-9) f = 0;
    this.fill = f;
    this.hidden = 0;
    this.reveal.t = -1;
    this.tickK = Math.floor(this.fill * 10 + 1e-9);
    this.stillRun = 0;
    this.kick = e.loop ? kickOf(e.loop, this.session + this.round + this.idx) : null;
    this.reshow = 0;
    if (this.pushBlock) this.tip = this.tipFor(this.block);
    if (this.stage === 'turn') this.talk.ask(isBrainView(e.view) ? 'inner' : 'turn', 2.5, 6);
    if (this.stage === 'dive') this.talk.ask('dive', 2.5, 8);
    this.emit({ type: 'element', id: e.id, via, view: e.view, turned: turned || this.stage === 'dive' });
    this.savePlace();
  }

  /** The light has arrived: the element fills (with any blind carry). */
  private arrive(): void {
    this.stage = 'at';
    this.stageT = 0;
    if (this.carry > 0) {
      this.fill = Math.min(0.999, this.fill + this.carry);
      this.carry = 0;
      this.ticks();
    }
    if (this.sighted) this.coach('fill', 'element');
  }

  /** The element is full by focus: it glows, its fact opens, the album counts it; the push may end now. */
  private complete(): void {
    const e = this.element;
    this.fill = 1;
    this.stage = 'full';
    this.stageT = 0;
    this.fills.set(e.id, 1);
    const before = this.p.lit[e.id] ?? 0;
    this.p.lit[e.id] = before + 1;
    if (!this.litNow.includes(e.id)) this.litNow.push(e.id);
    this.lux += RULES.luxElement;
    this.factId = e.id;
    this.factDepth = Math.min(3, before + 1);
    this.factT = 0;
    this.factExtra = 0;
    this.litThisPush = this.pushBlock || this.warmBlock;
    this.emit({ type: 'lit', id: e.id, lux: RULES.luxElement, first: before === 0, times: before + 1 });
    if (this.rng() < 0.5) this.talk.ask('lit', 1, 4);
    if (this.pushBlock && this.blockT >= RULES.minPush) this.pushDone = true;
    if (this.litNow.length === 1) this.coach('nav', 'controls');
    // the meditation's last element: the whole of it in light
    if (this.idx >= this.count - 1 && LISTS[this.variant].every(x => this.litNow.includes(x.id) || (this.p.lit[x.id] ?? 0) > 0)) {
      this.wholeMeditation();
    }
    this.savePlace();
  }

  /** The whole meditation lit: a moment in its light, then its closing card; the next round begins after it. */
  private wholeMeditation(): void {
    this.stage = 'whole';
    this.stageT = 0;
    this.p.whole[this.variant] = (this.p.whole[this.variant] ?? 0) + 1;
    this.wholeNow.push(this.variant);
    this.lux += RULES.luxWhole;
    this.emit({ type: 'whole', variant: this.variant, lux: RULES.luxWhole });
    this.talk.ask('whole', 3, 8);
  }

  private afterWhole(): void {
    this.round++;
    for (const e of LISTS[this.variant]) this.fills.delete(e.id);
    this.enter(0, 'auto', 0);
  }

  /** Walk one element on (+1) or back (−1), round the meditation. */
  private step(d: number, via: Via): void {
    const n = this.count;
    this.enter((((this.idx + d) % n) + n) % n, via);
  }

  /** Where the meditation goes on next time: this element and its light (a lit one hands on to the next). */
  private savePlace(): void {
    const full = this.stage === 'full' || this.stage === 'lit' || this.stage === 'whole';
    this.p.pos[this.variant] = full
      ? { idx: (this.idx + 1) % this.count, fill: 0 }
      : { idx: this.idx, fill: this.fill >= 1 ? 0 : clamp(this.fill) };
  }

  /** May the player walk now? (Not over a story card; the warm-up and the finale too.) */
  get canWalk(): boolean { return this.started && this.phase !== 'done' && !this.story; }

  prev(): boolean {
    if (!this.canWalk) return false;
    this.closePicker();
    this.step(-1, 'prev');
    return true;
  }

  next(): boolean {
    if (!this.canWalk) return false;
    this.closePicker();
    this.step(+1, 'next');
    return true;
  }

  /** Jump to an element (a tap on it on the picture, when it is not the one in the light). */
  goTo(i: number): boolean {
    if (!this.canWalk || i === this.idx || i < 0 || i >= this.count) return false;
    this.enter(i, 'next');
    return true;
  }

  openPicker(): boolean {
    if (!this.canWalk) return false;
    if (this.picker) return this.closePicker();
    this.picker = true;
    this.pickerT = 0;
    this.emit({ type: 'picker', open: true });
    return true;
  }

  closePicker(): boolean {
    if (!this.picker) return false;
    this.picker = false;
    this.emit({ type: 'picker', open: false });
    return true;
  }

  /** Choose a meditation in the picker: it goes on where it stopped (the current one: just close). */
  pick(v: VariantId): boolean {
    if (!this.canWalk || !(VARIANTS as readonly string[]).includes(v)) return false;
    this.closePicker();
    if (v === this.variant) return true;
    this.savePlace();
    const old = this.element;
    this.fills.set(old.id, this.stage === 'full' || this.stage === 'lit' || this.stage === 'whole' ? 1 : this.fill);
    this.variant = v;
    this.p.variant = v;
    const place = this.p.pos[v];
    this.talk.ask('pick', 2, 6);
    this.enter(place.idx, 'pick', place.fill, old);
    return true;
  }

  /** A tap on the picture or Space: stay with the element — its words again (and a fact a little longer). */
  stay(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= RULES.tapAfter) this.turnStory();
      return true;
    }
    if (this.picker) return this.closePicker();
    this.reshow = 3;
    if (this.factT >= 0) this.factExtra += 3;
    this.emit({ type: 'stay' });
    return true;
  }

  /** Keys during play: Space stays, ← → walk, M (or Escape in the picker) the meditations, 1–5 choose in the picker. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const used = (fn: () => unknown): boolean => { if (down) fn(); return true; };
    if (k === ' ' || k === 'Spacebar' || k === 'Enter') return used(() => this.stay());
    if (k === 'ArrowLeft') return used(() => this.prev());
    if (k === 'ArrowRight') return used(() => this.next());
    if (k === 'm') return used(() => this.openPicker());
    if (k === 'Escape' && this.picker) return used(() => this.closePicker());
    if (this.picker && /^[1-5]$/.test(k)) return used(() => this.pick(VARIANTS[Number(k) - 1]));
    return false;
  }

  // ── the blocks ─────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, now: number): void {
    const b = this.block;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'rest' && this.blockT >= RULES.bannerSec && this.blockT - dt < RULES.bannerSec) this.coach('rest', 'card');
    // the session's time is up: the block ends where it is (what was gained stays) and the finale begins
    if (now >= this.plannedSec - this.finaleSec) {
      this.endBlock();
      this.beginFinale();
      return;
    }
    if (b.kind === 'warmup') {
      if (!this.telegraphed && this.blockT >= b.dur - RULES.telegraph) this.telegraph('push');
      if (this.blockT >= b.dur) {
        this.endBlock();
        this.beginBlock('push', Infinity);
      }
      return;
    }
    if (b.kind === 'push') {
      // the reveal of a blind push, once its hidden fill is whole
      if (b.blind && this.hidden >= 1 - 1e-9 && this.blockT >= RULES.minPush && !this.pushDone) this.pushDone = true;
      const fillNow = b.blind ? this.hidden : this.fill;
      const done = this.pushDone && (this.stage === 'full' || this.stage === 'lit' || this.stage === 'whole' || b.blind);
      if (!this.telegraphed) {
        const soon = this.stage === 'at' && fillNow >= RULES.announceAt && this.blockT >= RULES.minPush - RULES.telegraph;
        if (soon || this.blockT >= RULES.maxPush - RULES.telegraph) this.telegraph('rest');
      }
      if (done) {
        this.endBlock();
        this.beginBlock('rest', this.restSec);
      } else if (this.blockT >= RULES.maxPush) {
        if (!this.valveSaid) {
          this.valveSaid = true;
          this.talk.ask('valve', 3, 8);
        }
        this.endBlock();
        this.beginBlock('rest', this.restSec);
      }
      return;
    }
    // rest: near its end the light moves on (the next push starts at the next element)
    if (!this.telegraphed && this.blockT >= b.dur - RULES.telegraph) {
      this.telegraph('push');
      if (this.stage === 'lit' || this.stage === 'full') this.step(+1, 'auto');
    }
    if (this.blockT >= b.dur) {
      this.endBlock();
      this.beginBlock('push', Infinity);
    }
  }

  private telegraph(next: BlockKind): void {
    this.telegraphed = true;
    this.emit({ type: 'telegraph', next });
  }

  private beginBlock(kind: BlockKind, dur: number): void {
    const first = !this.blocks.some(x => x.kind === kind);
    const b: Block = { kind, dur, blind: false, t0: this.t };
    this.blocks.push(b);
    this.blockT = 0;
    this.telegraphed = false;
    this.relSec = 0;
    this.judge.reset();
    this.goodSaid = false;
    this.noSigSaid = false;
    this.stillSaid = false;
    this.stillRun = 0;
    this.pushDone = false;
    const litBefore = this.litThisPush;
    this.litThisPush = false;
    if (kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.pushHr = { sum: 0, sec: 0 };
      this.hidden = 0;
      // a push on a lit element (the rest's move did not happen: a short rest) moves on first
      if (this.stage === 'lit' || this.stage === 'full') this.step(+1, 'auto');
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 10);
      if (b.blind) this.coach('blind', 'element');
    } else if (kind === 'rest') {
      this.restT = 0;
      // the fact of what the push lit is read in the rest (an early fill's card was only a glimpse)
      if (litBefore && this.factId) {
        this.factT = 0;
        this.factExtra = 0;
      }
      this.restHr = { sum: 0, sec: 0 };
      this.talk.ask('rest', 2, 10);
    } else this.talk.ask('warm', 1, 12);
    this.tip = this.tipFor(b);
    this.emit({ type: 'blockStart', block: b, index: this.blocks.length - 1 });
  }

  /** The strategy under the block's name: the element's own guidance; every third push a counting one; rest's breath. */
  tipFor(b: Block): string {
    if (b.kind === 'warmup') return t(TIPS.warmup, { name: elName(this.element) });
    if (b.kind === 'push') {
      if (b.blind) return t(TIPS.blind[this.pushesBegun % TIPS.blind.length]);
      if (this.pushesBegun > 0 && this.pushesBegun % RULES.countEvery === 0) return t(TIPS.count[(this.session + this.pushesBegun) % TIPS.count.length]);
      return elGuide(this.element);
    }
    return t(TIPS.rest[(this.session + this.blocks.length) % TIPS.rest.length]);
  }

  /** The block's end: its verdict and what it pays — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block;
    if (b.end !== undefined) return;
    b.end = this.t;
    if (b.kind === 'push' && b.dur === Infinity) b.dur = this.blockT;
    let verdict: boolean | null = null, share = 0;
    if (b.kind !== 'warmup') {
      share = this.judge.share;
      const long = b.kind === 'rest' || this.blockT >= RULES.judgeMin;
      verdict = long && this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push' && b.blind) {
        const s = this.judge.measured > 0 ? share : 0;
        const n = Math.round(RULES.luxBlind * s);
        this.lux += n;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        this.emit({ type: 'blindEnd', share: s, lux: n });
        this.talk.ask('blindEnd', 2, 6);
        this.revealBlind();
      } else if (verdict === true) {
        this.lux += RULES.luxBlock;
        this.emit({ type: 'lux', n: RULES.luxBlock, at: 'block' });
      }
      if (b.kind === 'rest') {
        if (verdict) this.passedRests++;
        const push = this.pushHr.sec >= 5 ? this.pushHr.sum / this.pushHr.sec : null;
        const rest = this.restHr.sec >= 5 ? this.restHr.sum / this.restHr.sec : null;
        if (push !== null && rest !== null && push - rest >= 3) this.slowedBy = Math.max(this.slowedBy, Math.round(push - rest));
      }
    }
    b.verdict = verdict;
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share });
  }

  /** A blind push's hidden fill is shown: up to full (the rest carries into the next element). */
  private revealBlind(): void {
    if (this.stage !== 'at' || this.hidden <= 0) return;
    const to = Math.min(1, this.fill + this.hidden);
    this.carry = Math.max(0, this.fill + this.hidden - 1);
    this.lux += RULES.luxFill * RULES.elementSec * Math.max(0, to - this.fill) * 0.5;
    this.reveal = { from: this.fill, to, t: 0 };
    this.hidden = 0;
  }

  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.telegraphed = false;
    this.setFilling(false);
    if (this.stage === 'full') this.stage = 'lit';
    this.emit({ type: 'finale' });
    this.talk.ask('end', 3, 10);
  }

  private end(): void {
    if (this.phase === 'done') return;
    this.settle();
    this.phase = 'done';
    this.emit({ type: 'done' });
  }

  /** The session's counters reach the progress once (at the end, or early with finish()). */
  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    const p = this.p;
    this.savePlace();
    p.sessions++;
    p.pushes += this.pushesBegun;
    p.luxAll += this.score;
    p.lastLen = this.plannedSec;
  }

  /** Ended early ("Zakończ i zapisz", the overtime limit): settle at once. */
  finish(): void {
    this.end();
  }

  // ── coach marks ────────────────────────────────────────────────
  private coach(what: Coach, at: CoachAt): void {
    if (!markSeen(this.p, `c.${what}`)) return;
    this.emit({ type: 'coach', what, at });
  }

  // ── output ─────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  private updateLux(dt: number): void {
    if (this.restBlock && this.reliable) {
      const n = RULES.luxRest * (0.3 + this.calmShown) * dt;
      this.lux += n;
      this.luxAcc += n;
    }
    this.luxTick += dt;
    if (this.luxTick >= (this.restBlock ? 3 : 2)) {
      const shown = Math.round(this.luxAcc);
      if (shown >= 1) this.emit({ type: 'lux', n: shown, at: this.restBlock ? 'rest' : 'fill' });
      this.luxAcc -= shown;
      this.luxTick = 0;
    }
  }

  /** The panel's gauge: the band's level in a sighted push past its lead-in, calm in rest; null blind or without a signal. */
  meter(): number | null {
    if (!this.started || this.phase !== 'play' || !this.reliable) return null;
    if (this.sighted) return clamp(this.light);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  /** The pad follows the light in a sighted push, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.warmBlock) return 0.5;
    if (this.sighted) return clamp(this.light);
    return null;
  }

  /** The song's level: the focus in a sighted push, a gentle level in rest and around, held in a blind push. */
  songLevel(f: FocusFrame): number | null {
    if (!this.started) return null;
    if (this.phase !== 'play') return 0.4;
    if (this.blind) return null;
    if (this.restBlock) return 0.32;
    if (this.sighted) return f.reliable ? clamp(f.level) : null;
    return 0.4;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The mean real pulse of the session (null without a reading). */
  get meanPulse(): number | null {
    return this.hrAll.sec >= 5 ? Math.round(this.hrAll.sum / this.hrAll.sec) : null;
  }

  /** What to do now, in one short line with an icon (the clarity rule: it changes only when the action changes). */
  doNow(): { icon: string; text: string } | null {
    if (!this.started || this.story) return null;
    if (this.picker) return { icon: '≡', text: t('now.pick') };
    if (this.phase === 'finale' || this.phase === 'done') return { icon: '✦', text: t('now.end') };
    const name = elName(this.element);
    const b = this.block;
    if (b.kind === 'rest') return this.telegraphed ? { icon: '◎', text: t('now.soon', { name }) } : { icon: '☾', text: t('now.rest') };
    if (b.kind === 'warmup') return { icon: '◎', text: t('now.warm', { name }) };
    if (this.unrelT > 3) return { icon: '…', text: t('now.nosignal') };
    if (b.blind) return { icon: '◐', text: t('now.blind', { name }) };
    return { icon: '◎', text: t('now.focus', { name }) };
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reached the progress once, in settle(). */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const hr = this.meanPulse;
    const stats: [string, string][] = [
      [t('stat.lit'), String(this.litNow.length)],
      [t('stat.meditation'), variantName(this.variant)],
      [t('stat.fill'), secText(this.fillSec)],
      [t('stat.calm'), secText(this.calmSec)],
      [t('stat.pulse'), hr === null ? '—' : `${hr}/min`],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /** The summary's closing passage, in turn from session to session among those the session fits. */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('psa139.13-14');
    for (const v of this.wholeNow) fit.push(VERSE[v]);
    if (this.litNow.length > 0) fit.push(VERSE[this.variant]);
    if (this.passedRests > 0 || this.slowedBy > 0) fit.push('pro3.7-8');
    fit.push(ROOT);
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.wholeNow.length) add(0, t('hl.whole', { med: variantName(this.wholeNow[this.wholeNow.length - 1]) }));
    if (this.litNow.length === 1) add(1, t('hl.one', { name: elName(LISTS[this.variant].find(e => e.id === this.litNow[0]) ?? this.element) }));
    else if (this.litNow.length > 1) add(1, t('hl.many', { n: this.litNow.length }));
    else if (this.started) add(1, t('hl.none'));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(2, t('hl.record', { lux: luxText(this.score) }));
    else if (this.bestBefore !== null && this.score > 0 && this.bestBefore - this.score <= Math.max(60, this.bestBefore * 0.25)) {
      add(2, t('hl.toBest', { lux: luxText(this.bestBefore - this.score) }));
    }
    if (this.slowedBy > 0) add(3, t('hl.slower', { n: this.slowedBy }));
    if (this.blindShare >= 0) add(4, t('hl.blind', { pct: t('pct', { n: this.blindShare }) }));
    const place = this.p.pos[this.variant];
    add(5, t('hl.next', { med: variantName(this.variant), name: elName(elementAt(this.variant, place.idx)), n: place.idx + 1, of: this.count }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
