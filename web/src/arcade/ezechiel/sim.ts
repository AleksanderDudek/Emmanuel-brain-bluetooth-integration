/**
 * Rzeka Ezechiela's session, without the DOM (DESIGN §18): the river from the temple (Ezekiel 47) rises up a figure
 * of light — only while focus is held — washes the grey dust off it, and the trees on its banks put out leaves that
 * the player lays in prayer where body or heart needs God.
 *
 *   a sighted push past its lead-in, a reliable signal, `focused`     the step goes on at mult(level, hold) / work a
 *        second: the water rises to its mark, the current rinses the dust, the trees open their leaves one by one
 *   rest (whole breaths of the player's pattern)                      nothing moves on; the mark's measuring line,
 *        the verse, the prayer at a leaf laid, the figure breathing (floating at the end)
 *   a blind push (from the 3rd session, every 4th push)              a morning mist veils the river; the step goes on
 *        unseen and is shown when the mist lifts
 *   no signal, below the threshold, the lead-in, a story card         nothing moves, nothing is lost
 *
 * The blocks go by the water (as Rzeki żywej wody's round 11): a push lasts until its step is done, then a rest of
 * whole breaths; a push that cannot finish rests by the safety valve (the step keeps what it gained).  The way is
 * planned for the session's length (rules.ts `planWay`); the floating rest and the last stretch — where the river
 * goes, Ezekiel 47:9 — come by the clock, so a session always ends on time.  The headline is the leaves (liście).
 */
import { fmtNum } from '../../i18n';
import { breathAt, breathCycle, type BreathPattern, type BreathState } from '../kit/breath';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  FLOAT_VERSES, LAY_VERSES, MARKS, MARK_KEYS, MARK_VERSE, OPEN_VERSE, PLACES, ROOT, TIPS, WASH_VERSES, type MarkId, type Moment, type PlaceId,
  type StageId,
} from './content';
import { leavesText, linesOf, markName, markShort, placeName, t, unit } from './i18n';
import { bestOf, breathOf, lenKey, markSeen, placeAt, type EzechielProgress } from './meta';
import { RULES, finaleFor, moreTrees, mult, planWay, warmFor, type Step, type Way } from './rules';
import { Talk } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
/** Why a rest: a mark reached, a washing pass done, a leaf to lay, the floating rest, or the safety valve. */
export type RestWhy = 'mark' | 'wash' | 'lay' | 'float' | 'valve';
export interface Block {
  kind: BlockKind;
  /** a rest's and the warm-up's length (s); a push has none (it lasts until its step is done) */
  dur: number;
  blind: boolean;
  why: RestWhy | null;
  /** a rest's whole breaths */
  cycles: number;
  /** the step this push works on, or the rest follows */
  step: number;
  /** the rest is the session's last: the figure floats in its last breaths */
  last: boolean;
}

export type StoryKind = 'open';
export interface Story { kind: StoryKind; page: number; pages: number; t: number }

/** The first-time explanations (coach marks) and what each points at. */
export type Coach = 'rise' | 'breath' | 'place' | 'blind' | 'leaf';
export type CoachAt = 'water' | 'figure' | 'list' | 'trees';

/** A leaf laid this session: where, and when (s of play) it set out from its tree. */
export interface Laid { place: PlaceId; i: number; t: number; label: string }

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number }
  | { type: 'telegraph'; next: BlockKind | null }
  | { type: 'mark'; mark: MarkId }
  | { type: 'leaf'; n: number; kind: Step['kind'] }
  | { type: 'pass'; pass: number; of: number }
  | { type: 'fruit'; n: number }
  | { type: 'lay'; place: PlaceId; i: number }
  | { type: 'place'; place: PlaceId }
  | { type: 'gold'; on: boolean }
  | { type: 'rising'; on: boolean }
  | { type: 'breathTurn'; phase: BreathState['phase'] }
  | { type: 'blindEnd'; share: number; gained: number }
  | { type: 'coach'; what: Coach; at: CoachAt }
  | { type: 'story'; kind: StoryKind; page: number }
  | { type: 'stay' }
  | { type: 'picker'; open: boolean }
  | { type: 'arc' }
  | { type: 'finale' }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];

/** Seconds as the summary says them: "42 s", "1:42". */
export function secText(s: number): string {
  const v = Math.max(0, Math.round(s));
  return v < 60 ? t('secs', { n: v }) : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

export interface SimInit {
  progress: EzechielProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
  /**
   * The rest's rhythm the player set in the lobby (kit/rhythm.ts, `ezechielRhythm`): seconds of one step of the way,
   * whole breaths of the rest after it — taken when the player moved a dial (`custom`); absent: the panel's old count
   * of breaths (p.restBreaths) and the way's curves; as designed: the curves.
   */
  rhythm?: { focus: number; rest: number; custom?: boolean } | null;
}

export class EzechielSim {
  readonly p: EzechielProgress;
  readonly rng: () => number;
  readonly plannedSec: number;
  readonly eeg: boolean;
  /** this session's number (1 = the first ever) */
  readonly session: number;
  readonly firstEver: boolean;
  readonly talk: Talk;
  readonly way: Way;
  readonly breathP: BreathPattern;
  /** a push under 85 % this long rests by the valve (s): RULES.valveMax, longer for the player's long steps */
  readonly valveMax: number;
  readonly contrast = new BlockContrast(4);
  /** how many steps the plan has (a strong player's extra trees come after) */
  readonly planned: number;
  private readonly steps: Step[];
  private readonly judge: RoundJudge;
  private readonly lead: number;
  private readonly finaleSec: number;
  private readonly pushesBase: number;
  private readonly bestBefore: number | null;
  /** the leaves the trees kept from earlier sessions (drawn dim; never counted again) */
  readonly oldLeaves: number;

  started = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  // the blocks
  block: Block;
  blockIndex = -1;
  blockT = 0;
  telegraphed = false;
  tip = '';
  pushesBegun = 0;
  private relSec = 0;
  private sinceGain = 0;
  // the way
  stepIdx = 0;
  /** the current step's progress (0..1, as shown) and what a blind push gathers unseen */
  stepK = 0;
  hidden = 0;
  /** a blind push's progress being shown (from → to over revealSec; t < 0: none) */
  reveal = { from: 0, to: 0, t: -1 };
  /** the highest mark the water has reached this session (0–4), and when (s of play) its line was laid */
  markReached = 0;
  lineT = -1;
  /** washing passes done; leaves given for the current step; leaves grown; fruits ripened */
  passes = 0;
  private stepLeaves = 0;
  leaves = 0;
  fruits = 0;
  /** the leaves laid this session (in order) and the place the player chose for the next one */
  readonly laid: Laid[] = [];
  chosen: PlaceId | null = null;
  /** the way's planned steps all done at this time (s of play), or −1 */
  arcAt = -1;
  // the light and the signal
  light: number = RULES.baseLight;
  private lightTrue: number = RULES.baseLight;
  calmShown = 0;
  reliable = false;
  rising = false;
  private gold = false;
  private goldRun = 0;
  private goodSaid = false;
  private stillRun = 0;
  private stillSaid = false;
  private unrelT = 0;
  private noSigSaid = false;
  // the breath, the far land, the float
  breathT = 0;
  private lastPhase: BreathState['phase'] | null = null;
  /** the land downstream coming alive (0..1): in stages with the way, wholly at the end */
  farK = 0;
  /** the figure floating (0..1) */
  floatK = 0;
  // the hands, the cards
  reshow = 0;
  story: Story | null = null;
  picker = false;
  private pickerT = 0;
  // the session's tallies
  riseSec = 0;
  abideNow = 0;
  private abideRun = 0;
  private abideGap = 0;
  longestNow = 0;
  private blindShare = -1;
  valves = 0;
  private placeTaught = false;
  private settled = false;
  /** a coach mark of the runner is on screen until this time (s of play): the narrator waits for it */
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
    this.breathP = breathOf(this.p);
    const rh = init.rhythm;
    const own = rh ? (rh.custom !== false ? rh : null) : undefined;
    this.way = planWay(this.plannedSec, {
      firstEver: this.firstEver, eeg: this.eeg, breath: this.breathP,
      restBreaths: own === undefined ? this.p.restBreaths : own ? own.rest : 0, pushSec: own ? own.focus : undefined,
    });
    this.valveMax = Math.max(RULES.valveMax, Math.round(1.5 * (own ? this.way.pushSec : 0)));
    this.steps = this.way.steps.slice();
    this.planned = this.steps.length;
    this.talk = new Talk(m => linesOf(m), init.rng);
    this.oldLeaves = Math.min(40, this.p.leaves);
    this.block = { kind: 'warmup', dur: 0, blind: false, why: null, cycles: 0, step: 0, last: false };
  }

  // ── what the view and the runner read ───────────────────────────
  get pushBlock(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get warmBlock(): boolean { return this.phase === 'play' && this.block.kind === 'warmup'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a sighted push past its lead-in: the picture answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get leadIn(): number { return this.lead; }
  get score(): number { return this.leaves; }
  get goldOn(): boolean { return this.gold; }
  get step(): Step | null { return this.steps[this.stepIdx] ?? null; }
  /** the steps there are now (the plan, and any extra trees) */
  get stepCount(): number { return this.steps.length; }
  stepAt(i: number): Step | null { return this.steps[i] ?? null; }
  /** the cycle of the player's breath (s) */
  get cycle(): number { return breathCycle(this.breathP); }

  /** The water's level 0..4 as the picture shows it (it never falls). */
  get water(): number {
    let lvl = 0;
    for (let i = 0; i < this.stepIdx && i < this.steps.length; i++) lvl = Math.max(lvl, this.steps[i].to);
    const s = this.step;
    if (s && s.kind === 'rise') lvl = Math.max(lvl, s.from + (s.to - s.from) * this.stepK);
    return Math.max(lvl, this.markReached);
  }
  /** washing passes planned this session */
  get washes(): number { return this.steps.reduce((n, s) => n + (s.kind === 'wash' ? 1 : 0), 0); }
  /** The grey dust over the figure: how much is left below the washing's front, above it, and where the front is (0 crown … 1 feet). */
  get dust(): { above: number; below: number; front: number } {
    const of = Math.max(1, this.washes);
    const s = this.step;
    if (this.washes === 0) return { above: 1, below: 1, front: 0 };
    if (s && s.kind === 'wash' && this.stepK > 0 && this.stepK < 1) {
      return { above: 1 - s.pass / of, below: 1 - (s.pass - 1) / of, front: this.stepK };
    }
    const left = 1 - this.passes / of;
    return { above: left, below: left, front: 0 };
  }
  /** The stage of the way the words band names. */
  get stage(): StageId {
    if (this.phase !== 'play') return 'close';
    const b = this.block;
    if (b.kind === 'warmup') return 'prog';
    if (b.kind === 'rest') {
      if (b.why === 'mark') return 'rise';
      if (b.why === 'wash') return 'wash';
      if (b.why === 'lay') return 'lay';
      if (b.why === 'float') return 'float';
    }
    const s = this.steps[b.step] ?? this.step;
    if (!s) return 'float';
    if (b.kind === 'push' && this.pushesBegun === 1 && this.stepIdx === 0 && this.stepK === 0 && this.blockT < this.lead) return 'prog';
    return s.kind === 'rise' ? 'rise' : s.kind === 'wash' ? 'wash' : 'trees';
  }
  /** The breath in a rest (where in the player's pattern), or null outside rest. */
  get breath(): BreathState | null { return this.restBlock ? breathAt(this.breathP, this.breathT) : null; }
  /** The place the next leaf will be laid on. */
  get nextPlace(): PlaceId { return this.chosen ?? placeAt(this.p, this.laid.length); }
  /** the narrator must wait: a telegraph, the runner's banner, a story card, the chooser, a coach mark */
  get talkBlocked(): boolean {
    if (this.story || this.picker || this.t < this.hintUntil) return true;
    if (this.phase !== 'play') return false;
    return this.telegraphed || this.blockT < RULES.bannerSec;
  }
  /** The passage the words band shows now (rests and the end), or null. */
  get verse(): PassageId | null {
    if (this.phase !== 'play') return ROOT;
    const b = this.block;
    if (b.kind === 'warmup') return OPEN_VERSE;
    if (b.kind !== 'rest') return null;
    switch (b.why) {
      case 'mark': return MARK_VERSE[Math.max(1, Math.min(4, this.steps[b.step]?.to ?? 1)) as MarkId];
      case 'wash': return WASH_VERSES[(Math.max(1, this.passes) - 1) % WASH_VERSES.length];
      case 'lay': return LAY_VERSES[(Math.max(1, this.laid.length) - 1 + (this.session - 1)) % LAY_VERSES.length];
      case 'float': return FLOAT_VERSES[(this.session - 1) % FLOAT_VERSES.length];
      default: return null;
    }
  }
  /** the way's planned steps all done */
  get arcDone(): boolean { return this.arcAt >= 0; }

  // ── the session ────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.firstEver) this.startWarm();
    else this.startPush();
    if (this.firstEver && markSeen(this.p, 's.open')) {
      this.story = { kind: 'open', page: 0, pages: 2, t: 0 };
      this.emit({ type: 'story', kind: 'open', page: 0 });
      this.talk.ask('open', 3, 30);
    } else this.talk.ask('open', 1, 8);
  }

  /** One frame of play. */
  update(dt: number, f: FocusFrame, now: number): void {
    if (!this.started || this.phase === 'done') return;
    dt = Math.max(0, Math.min(0.1, dt));
    this.t = now;
    this.reliable = f.reliable && f.activity !== null;
    if (this.reliable) this.relSec += dt;
    this.updateStory(dt);
    if (this.phase === 'play') this.schedule(dt, f);
    if (this.phase === 'finale' && now >= this.plannedSec) this.end();
    if ((this.phase as string) === 'done') return;
    this.updateLight(dt, f);
    this.updateBreath(dt);
    this.updateAbide(dt);
    this.updateFar(dt);
    this.reshow = Math.max(0, this.reshow - dt);
    if (this.picker) {
      this.pickerT += dt;
      if (this.pickerT >= RULES.pickerIdle) this.closePicker();
    }
    this.talk.update(dt, now, this.talkBlocked);
  }

  private updateStory(dt: number): void {
    const s = this.story;
    if (!s) return;
    s.t += dt;
    if (s.t >= RULES.pageSec) this.turnStory();
  }

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
  }

  private updateLight(dt: number, f: FocusFrame): void {
    const live = this.pushBlock && this.blockT >= this.lead && this.reliable;
    this.lightTrue = approach(this.lightTrue, live ? clamp(f.level) : RULES.baseLight, dt, RULES.lightTau);
    if (this.sighted) this.light = this.lightTrue;
    else this.light = approach(this.light, this.restBlock ? RULES.restLight : RULES.baseLight, dt, RULES.lightTau);
    this.calmShown = approach(this.calmShown, this.restBlock && this.reliable ? clamp(f.calm) : 0, dt, 0.8);
    const gold = this.sighted && this.reliable && !!f.focused && !this.story;
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
      this.talk.ask('nosignal', 2, 6);
    }
  }

  private updateBreath(dt: number): void {
    if (!this.restBlock) {
      this.lastPhase = null;
      return;
    }
    this.breathT += dt;
    const ph = breathAt(this.breathP, this.breathT).phase;
    if (ph !== this.lastPhase) {
      this.lastPhase = ph;
      this.emit({ type: 'breathTurn', phase: ph });
    }
  }

  private updateAbide(dt: number): void {
    if (!this.restBlock) {
      this.abideRun = 0;
      this.abideGap = 0;
      return;
    }
    if (this.reliable && this.calmShown >= 0.5) {
      this.abideRun += dt;
      this.abideNow += dt;
      this.abideGap = 0;
    } else {
      this.abideGap += dt;
      if (this.abideGap > 2) this.abideRun = 0;
    }
    this.longestNow = Math.max(this.longestNow, this.abideRun);
  }

  /** The land downstream: a share of it with each step done (up to 60 %), the whole of it at the end; the float rises at the end. */
  private updateFar(dt: number): void {
    const done = this.planned ? Math.min(this.stepIdx, this.planned) / this.planned : 0;
    const want = this.phase !== 'play' ? 1 : 0.6 * done;
    this.farK = approach(this.farK, Math.max(this.farK, want), dt, this.phase !== 'play' ? 2.2 : 3);
    const b = this.block;
    const floating = this.phase !== 'play' || (b.kind === 'rest' && (b.why === 'float' || (b.last && this.blockT >= b.dur - this.way.float.sec)));
    this.floatK = approach(this.floatK, floating && this.water >= MARKS - 0.01 ? 1 : 0, dt, 1.6);
  }

  // ── progress (only with focus) ──────────────────────────────────
  /** The step's progress a second for a focus frame now (0 without focus). */
  rate(f: FocusFrame): number {
    const s = this.step;
    if (!s || !this.pushBlock || this.story || this.blockT < this.lead || this.reveal.t >= 0) return 0;
    if (!this.reliable || !f.focused) return 0;
    return mult(f.level, f.hold) / s.work;
  }

  private setRising(on: boolean): void {
    if (on === this.rising) return;
    this.rising = on;
    this.emit({ type: 'rising', on });
  }

  /** The push's work this frame: the step goes on (shown, or unseen in a blind push). */
  private work(dt: number, f: FocusFrame): void {
    const r = this.rate(f);
    this.setRising(r > 0 && !this.block.blind);
    this.watchStill(dt, f);
    if (this.blockT >= this.lead) this.sinceGain += dt;
    if (r <= 0) return;
    this.sinceGain = 0;
    this.riseSec += dt;
    if (this.block.blind) this.hidden = Math.min(1 - this.stepK, this.hidden + r * dt);
    else this.advance(r * dt);
  }

  /** The step goes on by `dk` (what the water, the dust and the leaves show follows). */
  private advance(dk: number): void {
    const s = this.step;
    if (!s || dk <= 0) return;
    this.stepK = Math.min(1, this.stepK + dk);
    this.follow(s);
  }

  /** The marks the water has passed, the leaves the step has opened, from its progress. */
  private follow(s: Step): void {
    if (s.kind === 'rise') {
      const lvl = s.from + (s.to - s.from) * this.stepK;
      while (this.markReached < Math.floor(lvl + 1e-9) && this.markReached < MARKS) {
        this.markReached++;
        this.lineT = this.t;
        this.emit({ type: 'mark', mark: this.markReached as MarkId });
        if (this.markReached < s.to) this.talk.ask('mark', 2, 5);
      }
    }
    const of = s.kind === 'trees' ? s.leaves : RULES.byLeaves;
    const want = Math.floor(this.stepK * of + 1e-9);
    while (this.stepLeaves < want) {
      this.stepLeaves++;
      this.leaves++;
      this.emit({ type: 'leaf', n: this.leaves, kind: s.kind });
      if (s.kind === 'trees' && this.stepLeaves === 1 && this.rng() < 0.5) this.talk.ask('leaf', 1, 4);
    }
  }

  /** A blind push's progress shown when the mist lifts: the step goes on quickly to where it got. */
  private updateReveal(dt: number): void {
    const r = this.reveal;
    if (r.t < 0) return;
    r.t += dt;
    const k = 1 - (1 - clamp(r.t / RULES.revealSec)) ** 3;
    const s = this.step;
    this.stepK = r.from + (r.to - r.from) * k;
    if (s) this.follow(s);
    if (r.t >= RULES.revealSec) {
      this.stepK = r.to;
      if (s) this.follow(s);
      r.t = -1;
      if (this.stepK >= 1 - 1e-9) {
        this.complete();
        // a blind trees push shown as its rest begins: the rest's leaf sets out now
        if (this.restBlock && this.block.why === 'lay') this.layLeaf();
      }
    }
  }

  /** A sighted push with a signal but without focus for a while: the narrator says the water waits (once a block). */
  private watchStill(dt: number, f: FocusFrame): void {
    const waiting = this.sighted && this.reliable && !f.focused;
    this.stillRun = waiting ? this.stillRun + dt : 0;
    if (this.stillRun >= RULES.stillSec && !this.stillSaid) {
      this.stillSaid = true;
      this.talk.ask('still', 1.5, 6);
    }
  }

  /** The step is done: its moment (a pass, a fruit), the way on to the next step. */
  private complete(): void {
    const s = this.step;
    if (!s) return;
    this.stepK = 1;
    this.follow(s);
    if (s.kind === 'wash') {
      this.passes++;
      this.emit({ type: 'pass', pass: s.pass, of: s.of });
    } else if (s.kind === 'trees' && this.fruits < RULES.fruitsMax) {
      this.fruits++;
      this.emit({ type: 'fruit', n: this.fruits });
      if (this.fruits === 1 || this.fruits === RULES.fruitsMax) this.talk.ask('fruit', 1.4, 6);
    }
    this.stepIdx++;
    this.stepK = 0;
    this.stepLeaves = 0;
    if (this.stepIdx === this.planned && this.arcAt < 0) {
      this.arcAt = this.t;
      this.emit({ type: 'arc' });
    }
    if (this.stepIdx >= this.steps.length) {
      this.steps.push(moreTrees(this.way));
      if (this.stepIdx === this.planned) this.talk.ask('more', 1.2, 10);
    }
  }

  // ── the blocks ─────────────────────────────────────────────────
  /** When the floating rest must begin so that it and the last stretch end the session on time. */
  get tailAt(): number { return this.plannedSec - this.finaleSec - this.way.float.sec; }

  private schedule(dt: number, f: FocusFrame): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    this.updateReveal(dt);
    if (b.kind === 'push') {
      if (!this.story) this.work(dt, f);
      else this.setRising(false);
      if (this.blockT >= this.lead && this.blockT - dt < this.lead && !b.blind) {
        const s = this.step;
        if (s?.kind === 'trees') this.coach('leaf', 'trees');
        else this.coach('rise', 'water');
      }
      this.pushTelegraph(f);
      const done = this.stepK >= 1 - 1e-9 && this.reveal.t < 0;
      const blindDone = b.blind && this.hidden >= 1 - this.stepK - 1e-9;
      if (done) {
        this.complete();
        this.endBlock();
        this.startRest(this.whyAfter(b.step));
      } else if (blindDone) {
        this.endBlock();
        this.startRest(this.whyAfter(b.step));
      } else if (this.t >= this.tailAt) {
        this.endBlock();
        this.startRest('float');
      } else if (this.blockT >= this.lead + R.valveStall && this.sinceGain >= R.valveStall || this.blockT >= this.valveMax && this.stepK < R.valveUnder) {
        this.valves++;
        this.endBlock();
        this.startRest('valve');
      }
      return;
    }
    this.setRising(false);
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('breath', 'figure');
    if (this.t >= 40 && this.t - dt < 40) this.teachPlace();
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: this.nextAfterRest() });
    }
    if (this.blockT >= b.dur) {
      this.endBlock();
      if (b.kind === 'rest' && (b.why === 'float' || b.last)) this.beginFinale();
      else if (this.t >= this.tailAt - R.minPushRoom) this.startRest('float');
      else this.startPush();
    }
  }

  /** What follows the current rest or warm-up: a push, or the end. */
  private nextAfterRest(): BlockKind | null {
    const b = this.block;
    if (b.kind === 'rest' && (b.why === 'float' || b.last)) return null;
    if (this.t + (b.dur - this.blockT) >= this.tailAt - RULES.minPushRoom) return 'rest';
    return 'push';
  }

  /** A push telegraphs its rest when its step is nearly done (sighted only: a blind one would tell the hidden light), or the tail comes. */
  private pushTelegraph(f: FocusFrame): void {
    if (this.telegraphed) return;
    let soon = this.t >= this.tailAt - RULES.telegraph;
    if (!this.block.blind && this.blockT >= this.lead) {
      const r = this.rate(f);
      soon = soon || this.stepK >= 0.85 || (r > 0 && (1 - this.stepK) / r <= RULES.telegraph);
    }
    if (soon) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: 'rest' });
    }
  }

  /** The rest a push's step asks for when it is done. */
  private whyAfter(stepIndex: number): RestWhy {
    const s = this.steps[stepIndex];
    if (!s) return 'float';
    return s.kind === 'rise' ? 'mark' : s.kind === 'wash' ? 'wash' : 'lay';
  }

  private resetBlock(): void {
    this.blockT = 0;
    this.telegraphed = false;
    this.relSec = 0;
    this.sinceGain = 0;
    this.judge.reset();
    this.goodSaid = false;
    this.noSigSaid = false;
    this.stillSaid = false;
    this.goldRun = 0;
    this.stillRun = 0;
  }

  private startWarm(): void {
    this.blockIndex++;
    this.resetBlock();
    const dur = Math.min(warmFor(this.plannedSec), Math.max(4, this.tailAt - RULES.minPushRoom));
    this.block = { kind: 'warmup', dur, blind: false, why: null, cycles: 0, step: this.stepIdx, last: false };
    this.tip = t(TIPS.warm[0]);
    this.talk.ask('warm', 1, 14);
    this.emit({ type: 'blockStart', block: this.block, index: this.blockIndex });
  }

  private startPush(): void {
    this.blockIndex++;
    this.resetBlock();
    this.pushesBegun++;
    const first = this.pushesBegun === 1;
    const blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
    this.block = { kind: 'push', dur: 0, blind, why: null, cycles: 0, step: this.stepIdx, last: false };
    const s = this.step;
    if (blind) {
      this.talk.ask('blind', 3, 12);
      this.coach('blind', 'water');
    } else if (s) {
      if (s.kind === 'rise') this.talk.ask(MARK_KEYS[Math.min(MARKS, s.to)] as Moment, 1.5, 10);
      else if (s.kind === 'wash') this.talk.ask('wash', 1.5, 10);
      else this.talk.ask(this.stepIdx >= this.planned ? 'more' : 'trees', 1.5, 10);
    }
    this.tip = this.tipFor();
    this.emit({ type: 'blockStart', block: this.block, index: this.blockIndex });
  }

  /**
   * A rest of whole breaths after a push (`why`: what it follows).  The floating rest (and a rest with no room for a
   * push after it, which floats in its last breaths) takes the whole breaths left before the last stretch.
   */
  private startRest(why: RestWhy): void {
    const left = this.plannedSec - this.finaleSec - this.t;
    const cyc = this.cycle;
    if (left < cyc * 0.75) {
      if (why === 'lay') this.layLeaf();
      this.beginFinale();
      return;
    }
    let cycles = this.way.rest.cycles;
    let last = false;
    if (why === 'float') cycles = Math.max(1, Math.floor(left / cyc + 0.25));
    else if (this.t + cycles * cyc + RULES.minPushRoom > this.tailAt) {
      // no room for another push after this rest: it is the last, and floats in its last breaths
      cycles = Math.max(1, Math.floor(left / cyc + 0.25));
      last = true;
    }
    this.blockIndex++;
    this.resetBlock();
    this.breathT = 0;
    this.lastPhase = null;
    const stepIndex = Math.max(0, why === 'valve' || why === 'float' ? this.stepIdx : this.stepIdx - (this.reveal.t >= 0 ? 0 : 1));
    this.block = { kind: 'rest', dur: cycles * cyc, blind: false, why, cycles, step: stepIndex, last };
    if (why === 'lay' && this.reveal.t < 0) this.layLeaf();
    // the clock cut a trees push that had opened leaves: its leaf is still laid, in the floating rest
    else if (why === 'float' && this.step?.kind === 'trees' && this.stepLeaves > 0 && this.reveal.t < 0) this.layLeaf();
    this.talk.ask(why === 'mark' && this.markReached >= MARKS ? 'release'
      : why === 'mark' ? 'rest' : why === 'wash' ? 'washed' : why === 'lay' ? 'lay' : why === 'float' ? 'float' : 'valve', 2, 12);
    this.tip = this.tipFor();
    this.emit({ type: 'blockStart', block: this.block, index: this.blockIndex });
  }

  /** The leaf of this rest sets out from its tree to the chosen place (the player may still choose another). */
  private layLeaf(): void {
    const place = this.nextPlace;
    const i = this.laid.length;
    this.laid.push({ place, i, t: this.t, label: place === 'matter' ? this.p.label : '' });
    this.chosen = null;
    this.emit({ type: 'lay', place, i });
    this.teachPlace();
  }

  /** The block's strategy: the step's picture in a push (counting every third), the breath in rest. */
  private tipFor(): string {
    const b = this.block, s = this.step;
    if (b.kind === 'warmup') return t(TIPS.warm[0]);
    if (b.kind === 'push') {
      if (b.blind) return t(TIPS.blind[(this.session + this.pushesBegun) % TIPS.blind.length]);
      if (this.pushesBegun % RULES.repeatEvery === 0) return t(TIPS.count);
      if (!s || s.kind === 'rise') return t(TIPS.rise[MARK_KEYS[Math.min(MARKS, Math.max(1, s?.to ?? 1))] as 'ankles']);
      if (s.kind === 'wash') return t(TIPS.wash[(s.pass - 1) % TIPS.wash.length]);
      return t(TIPS.trees[this.pushesBegun % TIPS.trees.length]);
    }
    if (b.why === 'lay') return t(TIPS.lay[0]);
    if (b.why === 'float') return t(TIPS.float[0]);
    return t(TIPS.rest[(this.session - 1 + this.blockIndex) % TIPS.rest.length], { breath: this.breathWords() });
  }

  /** The player's breath in words: "wdech 4 s, wydech 6 s". */
  breathWords(): string {
    const b = this.breathP;
    const parts: string[] = [];
    if (b.in) parts.push(t('br.in', { n: b.in }));
    if (b.holdIn) parts.push(t('br.holdIn', { n: b.holdIn }));
    if (b.out) parts.push(t('br.out', { n: b.out }));
    if (b.holdOut) parts.push(t('br.holdOut', { n: b.holdOut }));
    return parts.join(', ');
  }

  /** The block's end: its verdict and, for a blind push, the progress gathered unseen (after its window, never during it). */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0;
    if (b.kind !== 'warmup') {
      share = this.judge.share;
      const judged = b.kind === 'rest' || this.blockT >= RULES.minJudged;
      verdict = judged && this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push' && b.blind) {
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        const gained = this.hidden;
        if (gained > 0) this.reveal = { from: this.stepK, to: Math.min(1, this.stepK + gained), t: 0 };
        this.hidden = 0;
        this.emit({ type: 'blindEnd', share: s, gained });
        this.talk.ask('blindEnd', 2, 6);
      }
    }
    this.setRising(false);
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share });
  }

  private beginFinale(): void {
    if (this.phase !== 'play') return;
    if (this.reveal.t >= 0) {
      this.reveal.t = RULES.revealSec;
      this.updateReveal(0);
    }
    this.phase = 'finale';
    this.telegraphed = false;
    this.setRising(false);
    this.closePicker();
    this.tip = t(TIPS.close);
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
    if (this.reveal.t >= 0) {
      this.reveal.t = RULES.revealSec;
      this.updateReveal(0);
    }
    const p = this.p;
    p.sessions++;
    p.pushes += this.pushesBegun;
    p.leaves += this.leaves;
    for (const l of this.laid) p.laid[l.place] = (p.laid[l.place] ?? 0) + 1;
    p.deepest = Math.max(p.deepest, this.markReached);
    if (this.markReached >= MARKS) p.rivers++;
    p.abideBest = Math.max(p.abideBest, Math.round(this.longestNow * 10) / 10);
    p.lastLen = this.plannedSec;
  }

  /** Ended early ("Zakończ i zapisz", the overtime limit): settle at once. */
  finish(): void {
    this.end();
  }

  // ── the hands ──────────────────────────────────────────────────
  /** A tap on the picture, a click, Space: turn a story card's page (after a moment); close the chooser; else the words glow again. */
  stay(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= RULES.tapAfter) this.turnStory();
      return true;
    }
    if (this.picker) {
      this.closePicker();
      return true;
    }
    this.reshow = RULES.reshowSec;
    this.emit({ type: 'stay' });
    return true;
  }

  /**
   * The place of the next leaf (the chooser, a tap on the figure).  In a leaf's rest, while its leaf is still on its way
   * (the first half of the rest), the leaf turns to the new place instead.
   */
  choose(place: PlaceId): boolean {
    if (!this.started || this.phase === 'done' || !(PLACES as readonly string[]).includes(place)) return false;
    const b = this.block, last = this.laid[this.laid.length - 1];
    if (this.restBlock && b.why === 'lay' && last && this.t - last.t < Math.max(RULES.layFly, b.dur / 2)) {
      last.place = place;
      last.label = place === 'matter' ? this.p.label : '';
      last.t = this.t;
    } else this.chosen = place;
    this.closePicker();
    this.emit({ type: 'place', place });
    return true;
  }

  get canChoose(): boolean { return this.started && this.phase !== 'done' && !this.story; }

  togglePicker(): boolean {
    if (!this.canChoose) return false;
    if (this.picker) this.closePicker();
    else {
      this.picker = true;
      this.pickerT = 0;
      this.emit({ type: 'picker', open: true });
    }
    return true;
  }

  closePicker(): void {
    if (!this.picker) return;
    this.picker = false;
    this.emit({ type: 'picker', open: false });
  }

  /** Keys during play: M the chooser (1–9 choose while it is open), Space and Enter stay / turn a card, Escape closes. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const act = (fn: () => unknown): boolean => {
      if (down) fn();
      return true;
    };
    if (k === ' ' || k === 'Spacebar' || k === 'Enter') return act(() => this.stay());
    if (k === 'm') return act(() => this.togglePicker());
    if (k === 'Escape' && this.picker) return act(() => this.closePicker());
    if (this.picker && /^[1-9]$/.test(k)) return act(() => this.choose(PLACES[Number(k) - 1]));
    return false;
  }

  /** The chooser is taught once: after the first leaf laid, or 40 s into a session. */
  private teachPlace(): void {
    if (this.placeTaught) return;
    this.placeTaught = true;
    this.coach('place', 'list');
  }

  private coach(what: Coach, at: CoachAt): void {
    if (this.story) return;
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

  /** The panel's gauge: the light in a sighted push, calm in rest; null blind, without a signal, elsewhere. */
  meter(): number | null {
    if (!this.started || this.phase !== 'play' || !this.reliable) return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.light);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  /** The pad follows the light in a sighted push, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(this.light);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reached the progress once, in settle(). */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.water'), this.markReached > 0 ? markShort(this.markReached as MarkId) : t('stat.trickle')],
      [t('stat.laid'), String(this.laid.length)],
      [t('stat.focus'), secText(this.riseSec)],
      [t('stat.abide'), secText(this.abideNow)],
      [t('stat.longest'), secText(this.longestNow)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, in turn from session to session: the root (Ezek 47:9) the first time and whenever
   * the river was reached; a leaf laid: Jer 17:14 or Ps 147:3; the washing: Ps 51:7; else Isa 43:2.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1 || this.markReached >= MARKS) fit.push(ROOT);
    if (this.laid.length) fit.push('jer17.14', 'psa147.3', 'ezk47.12');
    if (this.passes) fit.push('psa51.7');
    fit.push('isa43.2', 'isa58.11', 'rev22.2');
    return inTurn(fit, this.session || 1);
  }

  /** The places of the leaves laid, one line: "serce, kolana +2". */
  laidLine(): string {
    const seen: PlaceId[] = [];
    for (const l of this.laid) if (!seen.includes(l.place)) seen.push(l.place);
    const names = seen.slice(0, 3).map(placeName);
    return seen.length > 3 ? `${names.join(', ')} +${seen.length - 3}` : names.join(', ');
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    add(0, t('hl.line', { leaves: leavesText(this.score), water: this.markReached > 0 ? markName(this.markReached as MarkId) : t('stat.trickle') }));
    if (this.laid.length) add(0.5, t('hl.laid', { n: this.laid.length, places: this.laidLine() }));
    if (this.passes) add(1, t('hl.washed', { n: this.passes, of: this.washes }));
    if (this.fruits) add(1.5, t('hl.fruit', { n: this.fruits }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(2, t('hl.record', { leaves: leavesText(this.score) }));
    if (this.longestNow >= 10) add(3, t('hl.longest', { sec: secText(this.longestNow) }));
    if (this.blindShare >= 0) add(4, t('hl.blind', { pct: t('pct', { n: this.blindShare }) }));
    if (this.started && this.markReached === 0) add(0.2, t('hl.waits'));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
