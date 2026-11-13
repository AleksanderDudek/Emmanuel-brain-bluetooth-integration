/**
 * Rzeki żywej wody's session, without the DOM (DESIGN.md §13.14): light comes down from an open heaven and
 * rests in seven places of the body, one at a time, from the crown to the feet (receiving: the prayer of
 * each place); then it rises back from the feet to the crown (thanksgiving).  The lobby's card chooses
 * down, up, or both (the default: down, then up).
 *
 *   focus (a sighted push past its lead-in)   the place's light: its glow passes a faint ring at the
 *                                              threshold and turns gold; the place fills faster
 *                                              (fillBase + fillFocus × light per second), its rose window
 *                                              unfolding petal by petal; full → the light flows on
 *   rest (abiding)                             the breath guide in 4 / out 6, the lit places shine, drops of
 *                                              living water gather (more with calm and with more places
 *                                              lit), the place still deepens a little
 *   the hands (a tap anywhere, Space)          stay with the place: its prayer returns, a little light is
 *                                              added (less for a flurry)
 *   a blind push ("w ciemności")               the light gathers unseen and is shown at the block's end
 *
 * The headline is the drops of living water (kropli).  Blocks follow the kit's rules: push and rest of
 * 20–30 s with jitter and a 4 s telegraph, each judged once at its end, blind pushes from the third session,
 * a warm-up the first time, a quiet finale.  An unreliable signal holds the light at its neutral base —
 * never a loss.
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp, ease } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  PLACE, PLACES, TIPS, cleanOwn, legs, lineAt, linesOf, placeName, pushTip, route, tierName, verseOf, windowTier,
  type Dir, type Moment, type PlaceId, type Tier, type Way,
} from './content';
import { dropsText, t, unit } from './i18n';
import { bestOf, countPlace, lenKey, markSeen, tierOf, timesLit, type RzekiProgress } from './meta';
import { BREATH, RULES } from './rules';
import { Talk } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

/**
 * Where the light is on its way: `enter` (coming down from the open heaven to the crown, or up from the
 * pool into the feet), `at` a place (filling), `hold` (full, a moment in its light), `flow` (the stream to
 * the next place), `whole` (the last place done: the whole body in light, then the closing card).
 */
export type Stage = 'enter' | 'at' | 'hold' | 'flow' | 'whole';

export type StoryKind = 'open' | 'down' | 'up';
export interface Story { kind: StoryKind; page: number; pages: number; t: number }

/** The first-time explanations (coach marks) and what each points at. */
export type Coach = 'tap' | 'light' | 'petals' | 'breath' | 'drops' | 'blind';
export type CoachAt = 'place' | 'chest' | 'pool';

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'enter'; dir: Dir }
  | { type: 'arrive'; place: PlaceId; dir: Dir; idx: number }
  | { type: 'tap'; place: PlaceId; eff: number; stage: Stage }
  | { type: 'petal'; place: PlaceId; n: number; of: number }
  | { type: 'full'; place: PlaceId; dir: Dir; drops: number }
  | { type: 'flow'; from: PlaceId; to: PlaceId; dir: Dir }
  | { type: 'whole'; dir: Dir; drops: number }
  | { type: 'tier'; place: PlaceId; tier: Tier }
  | { type: 'again'; round: number }
  | { type: 'gold'; on: boolean }
  | { type: 'breathTurn'; inhale: boolean }
  | { type: 'drops'; n: number; at: 'rest' | 'block' }
  | { type: 'blindEnd'; share: number; drops: number; gained: number }
  | { type: 'coach'; what: Coach; at: CoachAt }
  | { type: 'story'; kind: StoryKind; page: number }
  | { type: 'finale' }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];

/** The last stretch without a block: 12 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/** Lift blocks shorter than `min` by taking from the longest, keeping the sum. */
function liftShort(durs: number[], min: number): void {
  for (let guard = 0; guard < 20; guard++) {
    const i = durs.findIndex(d => d < min - 1e-9);
    if (i < 0) return;
    const need = min - durs[i];
    let j = 0;
    for (let k = 1; k < durs.length; k++) if (durs[k] > durs[j]) j = k;
    if (durs[j] - need < min) return;
    durs[j] -= need;
    durs[i] = min;
  }
}

/**
 * The session's blocks.  A first-ever session opens with the warm-up (30 s in 5 and 10 min, 20 s in 3, 6 s
 * in a short test); then Światło / Trwanie pairs (24 ± 3 s and 26 ± 3 s, scaled to end on time, jittered
 * only when there is room) ending with a rest, leaving the quiet last stretch at the end.  Any planned
 * length from 10 s gets at least one push and one rest.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const fin = finaleFor(plannedSec);
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * 4, plannedSec - fin);
    if (firstEver) {
      const warm = Math.min(R.warm.test, left / 3), rest = left - warm;
      return [b('warmup', warm), b('push', rest / 2), b('rest', rest / 2)];
    }
    const rest = Math.max(4, Math.min(14, left / 2));
    return [b('push', left - rest), b('rest', rest)];
  }
  const plan: Block[] = [];
  let left = plannedSec - fin;
  if (firstEver) {
    const warm = plannedSec >= 300 ? R.warm.long : R.warm.short;
    plan.push(b('warmup', warm));
    left -= warm;
  }
  const pair = R.push[0] + R.rest[0];
  const pairs = Math.max(1, Math.round(left / pair));
  const jitter = pairs >= 2 && left / (pairs * pair) >= 0.85 ? 1 : 0;
  const durs: number[] = [];
  for (let i = 0; i < pairs; i++) durs.push(R.push[0] + jitter * (rnd() * 2 - 1) * R.push[1], R.rest[0] + jitter * (rnd() * 2 - 1) * R.rest[1]);
  const scale = left / durs.reduce((s, d) => s + d, 0);
  for (let i = 0; i < durs.length; i++) durs[i] *= scale;
  liftShort(durs, R.minBlock);
  durs.forEach((dur, i) => plan.push(b(i % 2 ? 'rest' : 'push', dur)));
  return plan;
}

/** How far a place's rose window has opened at a fill: its inner ring first, then the outer petals (fractional). */
export function petalsOpen(place: PlaceId, fill: number): { inner: number; outer: number } {
  const r = PLACE[place].rose, f = clamp(fill);
  return {
    inner: clamp(f / RULES.innerShare) * r.inner,
    outer: clamp((f - RULES.innerShare) / (1 - RULES.innerShare)) * r.outer,
  };
}

/** The whole petals open at a fill (the glass ticks count them). */
export function petalCount(place: PlaceId, fill: number): number {
  const o = petalsOpen(place, fill);
  return Math.floor(o.inner + 1e-9) + Math.floor(o.outer + 1e-9);
}

/** All the petals of a place's rose window. */
export const petalTotal = (place: PlaceId): number => PLACE[place].rose.inner + PLACE[place].rose.outer;

/** Seconds as the summary says them: "42 s", "1:42". */
export function secText(s: number): string {
  const v = Math.max(0, Math.round(s));
  return v < 60 ? t('secs', { n: v }) : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

export interface SimInit {
  progress: RzekiProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

/** The lit bits of a place this round: 1 lit going down, 2 thanked going up. */
export const LIT_DOWN = 1;
export const LIT_UP = 2;

export class RzekiSim {
  readonly p: RzekiProgress;
  readonly rng: () => number;
  readonly plannedSec: number;
  readonly eeg: boolean;
  /** this session's number (1 = the first ever) */
  readonly session: number;
  readonly firstEver: boolean;
  readonly way: Way;
  readonly own: string;
  readonly talk: Talk;
  readonly contrast = new BlockContrast(4);
  private readonly judge: RoundJudge;
  private readonly lead: number;
  private readonly finaleSec: number;
  private readonly plan: Block[];
  private readonly pushesBase: number;
  private readonly bestBefore: number | null;
  private readonly legList: readonly Dir[];

  started = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  // the blocks
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  tip = '';
  private pushesBegun = 0;
  private relSec = 0;
  // the way
  leg = 0;
  dir: Dir = 'down';
  round = 1;
  stage: Stage = 'enter';
  stageT = 0;
  idx = 0;
  /** the current place's light gathered (0..1, as shown), and what a blind block gathers unseen */
  fill = 0;
  hidden = 0;
  /** a blind block's light being shown (from → to over revealSec; t < 0: none) */
  reveal = { from: 0, to: 0, t: -1 };
  /** light a tap gives while the stream flows: the next place starts with it */
  private pre = 0;
  /** light gathered in the dark past the place's full: the next place starts with it */
  private carry = 0;
  private petals = 0;
  /** each place this round: LIT_DOWN | LIT_UP bits; and the session's memory of places lit (for a soft glow) */
  lit: Record<PlaceId, number>;
  memory: Record<PlaceId, number>;
  /** each place's window craft now (it grows with the times lit, across sessions and in this one) */
  tiers: Record<PlaceId, Tier>;
  private tiersNow: { place: PlaceId; tier: Tier }[] = [];
  // the light
  light: number = RULES.baseLight;
  private lightTrue: number = RULES.baseLight;
  calmShown = 0;
  reliable = false;
  private gold = false;
  private goldRun = 0;
  private goodSaid = false;
  private unrelT = 0;
  private noSigSaid = false;
  // the breath, the hands
  breathT = 0;
  private fervour = 0;
  /** the prayer glows again after a tap (s left) */
  reshow = 0;
  // the story cards
  story: Story | null = null;
  // the drops
  drops = 0;
  private restAcc = 0;
  private restTick = 0;
  // the session's tallies
  placesNow = 0;
  descentsNow = 0;
  ascentsNow = 0;
  tapsNow = 0;
  goldSec = 0;
  abideNow = 0;
  private abideRun = 0;
  private abideGap = 0;
  longestNow = 0;
  private litDownNow: Record<PlaceId, number>;
  private litUpNow: Record<PlaceId, number>;
  private lastLit: PlaceId | null = null;
  private passedRests = 0;
  private blindShare = -1;
  /** the session's counters reached the progress (once) */
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
    this.way = this.p.way;
    this.own = cleanOwn(this.p.own);
    this.legList = legs(this.way);
    this.dir = this.legList[0];
    this.pushesBase = this.p.pushes;
    this.bestBefore = bestOf(this.p);
    this.judge = RoundJudge.from(init.tuning);
    this.lead = this.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
    this.finaleSec = finaleFor(this.plannedSec);
    this.plan = planBlocks(this.plannedSec, this.firstEver, init.rng);
    this.talk = new Talk(m => linesOf(m), init.rng);
    const zeros = () => Object.fromEntries(PLACES.map(p => [p, 0])) as Record<PlaceId, number>;
    this.lit = zeros();
    this.memory = zeros();
    this.litDownNow = zeros();
    this.litUpNow = zeros();
    this.tiers = Object.fromEntries(PLACES.map(p => [p, tierOf(this.p, p)])) as Record<PlaceId, Tier>;
  }

  // ── what the view and the runner read ───────────────────────────
  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get next(): Block | null { return this.blockIndex + 1 < this.plan.length ? this.plan[this.blockIndex + 1] : null; }
  get blocks(): readonly Block[] { return this.plan; }
  get pushBlock(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get warmBlock(): boolean { return this.phase === 'play' && this.block.kind === 'warmup'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a sighted push past its lead-in: the light answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get leadIn(): number { return this.lead; }
  get score(): number { return Math.floor(this.drops); }
  get goldOn(): boolean { return this.gold; }
  /** the places the way visits, in order */
  get route(): readonly PlaceId[] { return route(this.dir); }
  /** the place the light is at (or flows to, or comes down to) */
  get place(): PlaceId { return this.route[Math.min(this.idx, PLACES.length - 1)]; }
  /** where the stream flows to (during `flow`) */
  get nextPlace(): PlaceId | null { return this.idx + 1 < PLACES.length ? this.route[this.idx + 1] : null; }
  /** the line at the current place: the player's own words, or its prayer (down) / thanks (up) */
  get line(): string { return lineAt(this.place, this.dir, this.own); }
  /** the places lit this round */
  get litCount(): number { return PLACES.reduce((n, p) => n + (this.lit[p] ? 1 : 0), 0); }
  /** the river's reach from the pool (0..1): the session's drops */
  get river(): number { return clamp(this.drops / RULES.riverFull); }
  /** the verse of the current place on this way */
  get verse(): PassageId { return verseOf(this.place, this.dir); }
  /** the narrator must wait: a telegraph, the runner's banner, a story card, a coach mark */
  get talkBlocked(): boolean {
    if (this.story || this.t < this.hintUntil) return true;
    if (this.phase !== 'play') return false;
    return this.telegraphed || this.blockT < RULES.bannerSec;
  }
  /** the breath guide: 'in' for 4 s, 'out' for 6 s, how far through the current half (0..1), and the chest's fullness k */
  get breath(): { inhale: boolean; p: number; k: number } {
    const x = ((this.breathT % BREATH) + BREATH) % BREATH;
    const inhale = x < RULES.inhale;
    const p = inhale ? x / RULES.inhale : (x - RULES.inhale) / RULES.exhale;
    const k = inhale ? 0.5 - 0.5 * Math.cos(Math.PI * p) : 0.5 + 0.5 * Math.cos(Math.PI * p);
    return { inhale, p, k };
  }

  // ── the session ────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.startBlock(0);
    this.beginLeg(false);
    if (this.firstEver && markSeen(this.p, 's.open')) {
      this.story = { kind: 'open', page: 0, pages: 2, t: 0 };
      this.emit({ type: 'story', kind: 'open', page: 0 });
      this.talk.ask('open', 3, 30);
    } else this.talk.ask(this.session === 1 ? 'open' : this.dir, 2, 10);
    if (this.own) this.talk.ask('own', 1, 24);
  }

  /** One frame of play. */
  update(dt: number, f: FocusFrame, now: number): void {
    if (!this.started || this.phase === 'done') return;
    dt = Math.max(0, Math.min(0.1, dt));
    this.t = now;
    this.reliable = f.reliable && f.activity !== null;
    if (this.reliable) this.relSec += dt;
    if (this.phase === 'play') this.schedule(dt, f, now);
    if (this.phase === 'finale' && now >= this.plannedSec) this.end();
    // end() moved the phase on (TypeScript narrowed it before the calls above)
    if ((this.phase as string) === 'done') return;
    this.updateLight(dt, f);
    this.updateBreath(dt);
    this.updateStory(dt);
    if (!this.story) this.updateWay(dt);
    this.updateDrops(dt);
    this.updateAbide(dt);
    this.fervour *= Math.exp(-dt / RULES.fervourTau);
    this.reshow = Math.max(0, this.reshow - dt);
    this.talk.update(dt, now, this.talkBlocked);
  }

  private updateLight(dt: number, f: FocusFrame): void {
    // the light the brain gives: in a push past its lead-in with a signal, else the neutral base
    const live = this.pushBlock && this.blockT >= this.lead && this.reliable;
    this.lightTrue = approach(this.lightTrue, live ? clamp(f.level) : RULES.baseLight, dt, RULES.lightTau);
    // what is shown: the light in a sighted push, a steady glow in rest, the base elsewhere (a blind block hides it)
    if (this.sighted) this.light = this.lightTrue;
    else this.light = approach(this.light, this.restBlock ? RULES.restLight : RULES.baseLight, dt, RULES.lightTau);
    this.calmShown = approach(this.calmShown, this.restBlock && this.reliable ? clamp(f.calm) : 0, dt, 0.8);
    const gold = this.sighted && this.reliable && this.light >= RULES.gold;
    if (gold !== this.gold) {
      this.gold = gold;
      this.emit({ type: 'gold', on: gold });
    }
    if (gold) this.goldSec += dt;
    this.goldRun = gold ? this.goldRun + dt : 0;
    if (this.goldRun >= RULES.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 5);
    }
    if (this.sighted && this.blockT >= this.lead + 0.5 && this.stage === 'at') this.coach('light', 'place');
    // no signal for a while in a push: the sensor, never the player
    this.unrelT = this.pushBlock && !this.reliable ? this.unrelT + dt : 0;
    if (this.unrelT > 3 && !this.noSigSaid) {
      this.noSigSaid = true;
      this.talk.ask('nosignal', 2, 6);
    }
  }

  private updateBreath(dt: number): void {
    if (!this.restBlock) return;
    const before = this.breath.inhale;
    this.breathT += dt;
    const now = this.breath.inhale;
    if (before !== now) this.emit({ type: 'breathTurn', inhale: now });
  }

  private updateStory(dt: number): void {
    const s = this.story;
    if (!s) return;
    s.t += dt;
    if (s.t >= (s.kind === 'open' ? RULES.pageSec : RULES.closeSec)) this.turnStory();
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
    if (s.kind === 'open') {
      this.talk.ask(this.dir, 2, 8);
      this.coach('tap', 'place');
    } else this.nextLeg();
  }

  // ── the way ────────────────────────────────────────────────────
  /** A way begins: the light comes down from the open heaven (down) or up from the pool (up). */
  private beginLeg(say: boolean): void {
    this.stage = 'enter';
    this.stageT = 0;
    this.idx = 0;
    this.fill = 0;
    this.hidden = 0;
    this.reveal.t = -1;
    this.pre = 0;
    this.carry = 0;
    this.petals = 0;
    this.emit({ type: 'enter', dir: this.dir });
    if (say) this.talk.ask(this.dir, 2, 8);
  }

  private updateWay(dt: number): void {
    this.stageT += dt;
    switch (this.stage) {
      case 'enter':
        if (this.stageT >= RULES.heavenSec) this.arrive(0);
        break;
      case 'at':
        this.updateReveal(dt);
        this.grow(this.fillRate() * dt);
        if (this.fill >= 1 - 1e-9 && this.reveal.t < 0) this.complete();
        break;
      case 'hold':
        if (this.stageT >= RULES.holdSec) {
          if (this.idx >= PLACES.length - 1) this.wholeWay();
          else this.flowOn();
        }
        break;
      case 'flow':
        if (this.stageT >= RULES.flowSec) this.arrive(this.idx + 1);
        break;
      case 'whole':
        if (this.stageT >= RULES.wholeSec) {
          this.story = { kind: this.dir, page: 0, pages: 1, t: 0 };
          this.emit({ type: 'story', kind: this.dir, page: 0 });
          // stays 'whole' until the card closes (then nextLeg)
          this.stageT = -Infinity;
        }
        break;
    }
  }

  /** The place's fill rate now (per second): the light in a push, a gentle pace without the brain, a little in rest. */
  fillRate(): number {
    if (this.phase !== 'play') return RULES.fillFree;
    const b = this.block;
    if (b.kind === 'warmup') return RULES.fillFree;
    if (b.kind === 'rest') return RULES.fillRest * (RULES.restLo + (1 - RULES.restLo) * (this.reliable ? this.calmShown : 0.5));
    return RULES.fillBase + RULES.fillFocus * this.lightTrue;
  }

  /**
   * Light gathers at the place: shown at once, or unseen in a blind block — where it may gather past the
   * place's full (up to RULES.blindCarry more), which the next place then starts with.
   */
  private grow(n: number): void {
    if (n <= 0 || this.stage !== 'at') return;
    if (this.blind) {
      this.hidden = Math.min(Math.max(0, 1 - this.fill) + RULES.blindCarry, this.hidden + n);
      return;
    }
    this.fill = Math.min(1, this.fill + n);
    this.ticks();
    if (this.fill >= 0.3) this.coach('petals', 'place');
  }

  /** A petal opened: the glass's tick (one event per petal, so the sound and the sparkle follow the light). */
  private ticks(): void {
    const n = petalCount(this.place, this.fill);
    while (this.petals < n) {
      this.petals++;
      this.emit({ type: 'petal', place: this.place, n: this.petals, of: petalTotal(this.place) });
    }
  }

  /** A blind block's light shown at its end: the window opens quickly to where it got. */
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

  /** The light arrives at the i-th place of the way. */
  private arrive(i: number): void {
    this.idx = Math.max(0, Math.min(PLACES.length - 1, i));
    this.stage = 'at';
    this.stageT = 0;
    this.fill = Math.min(RULES.blindCarry, Math.max(Math.min(0.2, this.pre), this.carry));
    this.pre = 0;
    this.carry = 0;
    this.hidden = 0;
    this.reveal.t = -1;
    this.petals = petalCount(this.place, this.fill);
    const place = this.place;
    this.emit({ type: 'arrive', place, dir: this.dir, idx: this.idx });
    if (this.dir === 'down') {
      if (this.round === 1 || this.rng() < 0.4) this.talk.ask(`at.${place}` as Moment, 1.5, 7);
    } else if (this.rng() < 0.3) this.talk.ask('rise', 1, 6);
    if (this.pushBlock) this.tip = this.tipFor(this.block);
    this.coach('tap', 'place');
  }

  /** The place is full: a moment in its light, the drops it brings, the tally. */
  private complete(): void {
    const place = this.place;
    this.fill = 1;
    this.stage = 'hold';
    this.stageT = 0;
    this.lit[place] |= this.dir === 'down' ? LIT_DOWN : LIT_UP;
    this.memory[place] = 1;
    if (this.dir === 'down') this.litDownNow[place]++;
    else this.litUpNow[place]++;
    this.placesNow++;
    this.lastLit = place;
    this.drops += RULES.dropPlace;
    this.emit({ type: 'full', place, dir: this.dir, drops: RULES.dropPlace });
    // its window's glass grows richer with the times it was lit (across sessions and in this one)
    const tier = windowTier(timesLit(this.p, place) + this.litDownNow[place] + this.litUpNow[place]);
    if (tier > this.tiers[place]) {
      this.tiers[place] = tier;
      this.tiersNow.push({ place, tier });
      this.emit({ type: 'tier', place, tier });
      this.talk.ask('tier', 2, 6);
    } else if (this.idx < PLACES.length - 1 && this.rng() < 0.35) this.talk.ask('full', 1, 4);
  }

  /** The stream flows on to the next place. */
  private flowOn(): void {
    const from = this.place, to = this.nextPlace!;
    this.stage = 'flow';
    this.stageT = 0;
    this.pre = 0;
    this.emit({ type: 'flow', from, to, dir: this.dir });
  }

  /** The last place of the way: the whole body in light, the drops of a whole way, then the closing card. */
  private wholeWay(): void {
    this.stage = 'whole';
    this.stageT = 0;
    this.drops += RULES.dropWay;
    if (this.dir === 'down') this.descentsNow++;
    else this.ascentsNow++;
    this.emit({ type: 'whole', dir: this.dir, drops: RULES.dropWay });
    this.talk.ask(this.dir === 'down' ? 'wayDown' : 'wayUp', 3, 8);
  }

  /** After a closing card: the next way of the round (up after down), or a new round. */
  private nextLeg(): void {
    if (this.leg + 1 < this.legList.length) {
      this.leg++;
      this.dir = this.legList[this.leg];
      this.beginLeg(true);
      return;
    }
    this.leg = 0;
    this.round++;
    this.dir = this.legList[0];
    for (const p of PLACES) this.lit[p] = 0;
    this.emit({ type: 'again', round: this.round });
    this.beginLeg(false);
    this.talk.ask('again', 2, 8);
  }

  // ── the drops and the abiding ──────────────────────────────────
  private updateDrops(dt: number): void {
    if (this.phase !== 'play') {
      this.drops += RULES.dropFree * dt;
      return;
    }
    const b = this.block;
    if (b.kind === 'rest') {
      const calm = this.reliable ? this.calmShown : 0.3;
      const n = RULES.dropRest * (RULES.restDropLo + calm) * (1 + (RULES.litK * this.litCount) / PLACES.length) * dt;
      this.drops += n;
      this.restAcc += n;
      this.restTick += dt;
      if (this.restTick >= RULES.restTick) {
        const shown = Math.round(this.restAcc);
        if (shown >= 1) this.emit({ type: 'drops', n: shown, at: 'rest' });
        this.restAcc -= shown;
        this.restTick = 0;
      }
    } else if (b.kind === 'push') {
      // a blind block's headline must not leak its light: it flows at the base until the block's end pays
      this.drops += RULES.dropPush * (0.5 + (this.blind ? RULES.baseLight : this.light)) * dt;
    } else this.drops += RULES.dropFree * dt;
  }

  private updateAbide(dt: number): void {
    if (!this.restBlock) {
      this.abideRun = 0;
      this.abideGap = 0;
      return;
    }
    if (this.reliable && this.calmShown >= RULES.abideCalm) {
      this.abideRun += dt;
      this.abideNow += dt;
      this.abideGap = 0;
    } else {
      // a short dip is forgiven (the pulse of the blood pressure, a swallow)
      this.abideGap += dt;
      if (this.abideGap > 2) this.abideRun = 0;
    }
    this.longestNow = Math.max(this.longestNow, this.abideRun);
  }

  // ── the hands ──────────────────────────────────────────────────
  /**
   * A tap anywhere, a click, Space: on a story card, turn its page (after a moment); else stay with the place —
   * its prayer glows again and a little light is added (less for a flurry); while the stream flows, the next
   * place gets it.  Returns true when it did something.
   */
  stay(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= RULES.tapAfter) this.turnStory();
      return true;
    }
    const eff = 1 / (1 + RULES.fervourK * this.fervour);
    this.fervour += 1;
    this.reshow = RULES.reshowSec;
    const n = RULES.tap * eff;
    if (this.stage === 'at') this.grow(n);
    else if (this.stage === 'flow' || this.stage === 'enter') this.pre = Math.min(0.15, this.pre + n);
    this.tapsNow++;
    this.emit({ type: 'tap', place: this.stage === 'flow' ? (this.nextPlace ?? this.place) : this.place, eff, stage: this.stage });
    return true;
  }

  /** Keys during play: Space stays with the place (like a tap), Enter turns a story card. */
  key(key: string, down: boolean): boolean {
    if (key === ' ' || key === 'Spacebar') {
      if (down) this.stay();
      return true;
    }
    if (key === 'Enter') {
      if (down && this.story) this.stay();
      return !!this.story;
    }
    return false;
  }

  // ── the blocks ─────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, now: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('breath', 'chest');
    if (b.kind === 'rest' && this.blockT >= R.bannerSec + 7 && this.blockT - dt < R.bannerSec + 7) this.coach('drops', 'pool');
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: last ? null : this.plan[this.blockIndex + 1] });
    }
    if ((last && this.blockT >= b.dur) || now >= this.plannedSec - this.finaleSec) {
      this.endBlock();
      this.beginFinale();
    } else if (!last && this.blockT >= b.dur) {
      this.endBlock();
      this.startBlock(this.blockIndex + 1);
    }
  }

  private startBlock(i: number): void {
    this.blockIndex = i;
    this.blockT = 0;
    this.telegraphed = false;
    this.relSec = 0;
    this.judge.reset();
    this.goodSaid = false;
    this.noSigSaid = false;
    this.goldRun = 0;
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      if (b.blind) {
        this.talk.ask('blind', 3, 12);
        this.coach('blind', 'place');
      }
    } else if (b.kind === 'rest') {
      this.breathT = 0;
      // the guide's first in-breath begins with the block
      this.emit({ type: 'breathTurn', inhale: true });
      this.talk.ask('rest', 2, 12);
    } else this.talk.ask('warm', 1, 14);
    this.tip = this.tipFor(b);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  /** The block's strategy: the place's own picture in a push (the repetition every third), the breath in rest. */
  private tipFor(b: Block): string {
    if (b.kind === 'warmup') return t(TIPS.warmup);
    if (b.kind === 'push') {
      if (b.blind) return t(TIPS.blind[(this.session + this.blockIndex) % TIPS.blind.length]);
      return t(pushTip(this.place, this.dir, this.pushesBegun - 1));
    }
    return t(TIPS.rest[(this.session - 1 + this.blockIndex) % TIPS.rest.length]);
  }

  /** The block's end: its verdict and what it pays — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0;
    if (b.kind !== 'warmup') {
      share = this.judge.share;
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push' && b.blind) {
        const s = this.judge.measured > 0 ? share : 0;
        const n = Math.round(RULES.dropBlind * s);
        this.drops += n;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        // the light gathered in the dark is shown now
        const gained = this.hidden;
        if (gained > 0 && this.stage === 'at') {
          this.reveal = { from: this.fill, to: Math.min(1, this.fill + gained), t: 0 };
          this.carry = Math.min(RULES.blindCarry, Math.max(0, this.fill + gained - 1));
          this.hidden = 0;
        }
        this.emit({ type: 'blindEnd', share: s, drops: n, gained });
        this.talk.ask('blindEnd', 2, 6);
      } else if (verdict === true) {
        this.drops += RULES.dropBlock;
        this.emit({ type: 'drops', n: RULES.dropBlock, at: 'block' });
      }
      if (b.kind === 'rest' && verdict) this.passedRests++;
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share });
  }

  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.telegraphed = false;
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
    p.sessions++;
    p.pushes += this.pushesBegun;
    p.descents += this.descentsNow;
    p.ascents += this.ascentsNow;
    for (const pl of PLACES) {
      countPlace(p, pl, 'down', this.litDownNow[pl]);
      countPlace(p, pl, 'up', this.litUpNow[pl]);
    }
    p.drops += this.score;
    p.abideBest = Math.max(p.abideBest, Math.round(this.longestNow * 10) / 10);
    p.abideAll += Math.round(this.abideNow);
    p.lastLen = this.plannedSec;
  }

  /** Ended early ("Zakończ i zapisz", the overtime limit): settle at once. */
  finish(): void {
    this.end();
  }

  // ── coach marks ────────────────────────────────────────────────
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

  /** The chorale's level: the focus in a sighted push, a gentle fixed level in rest and around, nothing in a blind block. */
  songLevel(f: FocusFrame): number | null {
    if (!this.started) return null;
    if (this.phase !== 'play') return 0.4;
    if (this.blind) return null;
    if (this.restBlock) return 0.34;
    if (this.sighted) return f.reliable ? clamp(f.level) : null;
    return 0.4;
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
    // short values: the summary sets each in a tile with a large serif number
    const stats: [string, string][] = [
      [t('stat.places'), String(this.placesNow)],
      [t('stat.down'), String(this.descentsNow)],
      [t('stat.up'), String(this.ascentsNow)],
      [t('stat.abide'), secText(this.abideNow)],
      [t('stat.longest'), secText(this.longestNow)],
      [t('stat.gold'), secText(this.goldSec)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session (DESIGN §13.14): an
   * ascent (Psalm 141:2, prayer rising like incense), a descent (Luke 11:13, the Father gives the Holy Spirit to
   * those who ask), the first session (the root, John 7:38-39), calm abiding (Philippians 4:7, the peace that
   * guards); else Acts 2:17, Isaiah 11:2 and the root.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.ascentsNow > 0) fit.push('psa141.2');
    if (this.descentsNow > 0) fit.push('luk11.13');
    if (this.session === 1) fit.push('jhn7.38-39');
    if (this.passedRests > 0 || this.longestNow >= 15) fit.push('php4.7');
    fit.push('act2.17', 'isa11.2', 'jhn7.38-39');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.descentsNow > 0) add(0, t('hl.down'));
    if (this.ascentsNow > 0) add(0.5, t('hl.up'));
    if (!this.descentsNow && !this.ascentsNow) {
      if (this.lastLit) add(0, t('hl.part', { place: placeName(this.lastLit) }));
      else if (this.started) add(0, t('hl.calm'));
    }
    if (this.bestBefore !== null && this.score > this.bestBefore) add(1, t('hl.record', { drops: dropsText(this.score) }));
    else if (this.bestBefore !== null && this.score > 0 && this.bestBefore - this.score <= Math.max(60, this.bestBefore * 0.25)) {
      add(1, t('hl.toBest', { drops: dropsText(this.bestBefore - this.score) }));
    }
    const ways = this.descentsNow + this.ascentsNow;
    if (ways > 2) add(2, t('hl.again', { n: ways }));
    const tn = this.tiersNow.at(-1);
    if (tn) add(2.5, t('hl.tier', { place: placeName(tn.place), tier: tierName(tn.tier) }));
    if (this.longestNow >= 10) add(3, t('hl.longest', { sec: secText(this.longestNow) }));
    if (this.blindShare >= 0) add(4, t('hl.blind', { pct: t('pct', { n: this.blindShare }) }));
    if (this.own) add(5, t('hl.own'));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
