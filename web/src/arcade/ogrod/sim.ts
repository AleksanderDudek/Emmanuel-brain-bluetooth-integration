/**
 * Ogród o świcie's session, without the canvas (DESIGN.md §23): the walk of one session over the plan of rules.ts —
 * the arrival in the night garden, the stations of the chosen way (each an opening and its acts: a push that focus
 * does, a settle in whole breaths), the dawn (the sunrise and the flowers, the name, the prayer, the close) — what
 * the focus drives, what the band is asked, what the narrator says, and the session's numbers.
 *
 * Light only from real focus (§18.3–18.4): an act moves only in a sighted push past its lead-in, with a reliable signal,
 * while focused, at `focusRate` (the level averaged over a whole breath).  Without focus the act waits — nothing is
 * forced; the settles and the dawn are receptive.  The plan is time-boxed: an act not done by its push's end is
 * finished gently by grace (the wave passes, the boat drifts on, the lantern kindles softly…) — except a stone: no one
 * lets it go for the player; it stays held in the open hand.  The flowers (the score) grow only from acts done with
 * focus, and from the focus held after one (abiding), so the garden at dawn shows the attention given.
 *
 * Own words, names and the letter never leave the session: result() carries only numbers and the catalog's sentences;
 * the letter (letter.ts) lives only in this object's memory and is never written to the progress.
 */
import { fmtNum } from '../../i18n';
import { breathAt, breathCycle, breathOk, type BreathPattern, type BreathState } from '../kit/breath';
import { BlockContrast, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import type { Rhythm } from '../kit/rhythm';
import { inTurn, passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import type { Place, SoundCue } from './audio';
import { VERSES, openMoment, verseFor, type Moment } from './content';
import { t, unit, type Key } from './i18n';
import { takeLetter } from './letter';
import { BREATH_DEF, addWeight, bestOf, cleanWeight, migrate, type OgrodProgress } from './meta';
import { prepView, weekOf, type PrepView } from './prep';
import { RULES, focusRate, needFor, planFor, readTime, type BlockKind, type BlockWhat, type Plan, type PlanBlock } from './rules';
import type { StationId } from './stations';
import { Talk } from './talk';
import { flowerSpot, type FlowerSpot } from './world';

export type { BlockKind, BlockWhat };

/** What an act is: the station's symbol the focus moves. */
export type ActKind = 'wave' | 'write' | 'fold' | 'sail' | 'foldSail' | 'close' | 'rose' | 'closeRose' | 'drop' | 'hold' | 'light' | 'sow' | 'tend';

/** How an act ended: by focus, gently by grace, or (a stone) kept in the open hand. */
export type Done = 'focus' | 'grace' | 'kept';

export interface ActRun {
  /** the station's index in the way, its id, and this act's index in it */
  station: number;
  id: StationId;
  i: number;
  kind: ActKind;
  /** the words it carries (the feeling on a wave, the kind word, the stone's word, the lantern's, the seed's) */
  word: string;
  /** the item it is about: a feeling's, a stone's, a lantern's (in the view's order) or a seed's index */
  item: number;
  /** focus-seconds it asks, and how far it is (0..1) */
  need: number;
  p: number;
  done: Done | null;
  doneAt: number;
  /** focus-seconds held after it was done, and the flowers it grew */
  abide: number;
  flowers: number;
  /** its push and its settle (planned, s of play) */
  t0: number;
  t1: number;
  r1: number;
}

export interface Flower { station: StationId; spot: FlowerSpot; born: number; act: number }

export type Coach = 'act' | 'settle' | 'flower' | 'tap';

export type SimEvent =
  | { type: 'place'; place: Place }
  | { type: 'block'; kind: BlockKind; what: BlockWhat }
  | { type: 'act'; act: number }
  | { type: 'done'; act: number; by: Done }
  | { type: 'flower'; n: number }
  | { type: 'cue'; cue: SoundCue }
  | { type: 'rated'; n: number }
  | { type: 'tap' }
  | { type: 'coach'; what: Coach };

/** A passage on the band: since when, for how long. */
export interface Card { id: PassageId; t0: number; dur: number }

export interface SimOpts {
  progress: OgrodProgress;
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

/** The acts of a station: what each is and the words it carries, from the plan's count and the preparation. */
export function actsOf(id: StationId, n: number, v: PrepView): { kind: ActKind; word: string; item: number }[] {
  const out: { kind: ActKind; word: string; item: number }[] = [];
  const cyc = <T>(a: readonly T[], i: number): T | undefined => (a.length ? a[i % a.length] : undefined);
  for (let i = 0; i < n; i++) {
    switch (id) {
      case 'lzy': out.push({ kind: 'wave', word: cyc(v.feelings, i) ?? '', item: v.feelings.length ? i % v.feelings.length : 0 }); break;
      case 'dlon': out.push({ kind: 'write', word: v.kind, item: i }); break;
      case 'list': out.push({ kind: n === 1 ? 'foldSail' : i === 0 ? 'fold' : 'sail', word: '', item: i }); break;
      case 'furtka': out.push({ kind: n === 1 ? 'closeRose' : i === 0 ? 'close' : 'rose', word: '', item: i }); break;
      case 'kamienie': {
        const s = v.stones[i] ?? { text: '', ready: true };
        out.push({ kind: s.ready ? 'drop' : 'hold', word: s.text, item: i });
        break;
      }
      case 'latarnie': break;
      case 'nasiona': out.push(i < v.seeds.length ? { kind: 'sow', word: v.seeds[i], item: i } : { kind: 'tend', word: '', item: i }); break;
    }
  }
  if (id === 'latarnie') {
    // me first, all last: when fewer acts fit, the lanterns between kindle softly with the last one's blessing
    const L = v.lanterns.length;
    const idx = n >= L ? v.lanterns.map((_, i) => i) : n === 1 ? [0] : [...Array.from({ length: n - 1 }, (_, i) => i), L - 1];
    for (const i of idx.slice(0, n)) out.push({ kind: 'light', word: v.lanterns[i]?.text ?? '', item: i });
  }
  return out;
}

/** The narrator's moment for an act as it begins. */
function actMoment(kind: ActKind, id: StationId): Moment {
  switch (kind) {
    case 'sail': return 'listSail';
    case 'rose': return 'furtkaRose';
    case 'hold': return 'kamienieHold';
    case 'tend': return 'nasionaTend';
    default: return `${id}Act` as Moment;
  }
}

/** The sound of an act done (by focus; grace has its own soft chord). */
function doneCue(kind: ActKind): SoundCue | null {
  switch (kind) {
    case 'write': return 'kind';
    case 'fold': return 'fold';
    case 'sail': case 'foldSail': return 'sail';
    case 'close': return 'gate';
    case 'rose': case 'closeRose': return 'rose';
    case 'drop': return 'stone';
    case 'hold': return 'warm';
    case 'light': return 'lantern';
    case 'sow': return 'seed';
    case 'tend': return 'sprout';
    default: return null;
  }
}

export class GardenSim {
  readonly p: OgrodProgress;
  readonly plan: Plan;
  readonly view: PrepView;
  /** the friends' names as typed, in the lanterns' order (the view's lantern texts read "For Anna" outside Polish) */
  private readonly friends: readonly string[];
  /** the unsent letter, held only here for this session (never saved) */
  readonly letter: string;
  readonly acts: ActRun[] = [];
  readonly flowers: Flower[] = [];
  readonly talk: Talk;
  readonly breathPattern: BreathPattern;
  readonly eeg: boolean;
  readonly contrast = new BlockContrast(4);
  started = false;
  /** the block now (the plan's), its index, and the seconds since it began */
  bi = 0;
  block: PlanBlock;
  blockT = 0;
  t = 0;
  /** where the walk is: the arrival, a station, the dawn, the close */
  place: Place = 'arrive';
  /** what the focus does this frame (focus-seconds a second), the light shown (smoothed level), calm */
  rate = 0;
  light = 0;
  calm = 0;
  reliable = false;
  /** the passage on the band (rests only) */
  card: Card | null = null;
  /** the 0–10 after, and the before this session carries */
  rating: number | null = null;
  readonly before: number | null;
  /** a tap makes the words glow again until this time */
  reshowUntil = 0;
  /** the runner's coach mark is up until this time (the narrator waits) */
  hintUntil = 0;
  /** when the camera began its walk to the place now (s of play) */
  walkAt = 0;
  /** tears gathered into the vessel (one a wave's settle) */
  tears = 0;
  private stallT = 0;
  private waited = false;
  private abideSaid = false;
  private overT = 0;
  private dawnReached = false;
  private credited = false;
  private cued = new Set<string>();
  private readonly meadowUsed = { n: 0 };
  private readonly stationFlowers = new Map<StationId, number>();
  private readonly mean = new WindowMean(RULES.meanSec);
  private readonly events: SimEvent[] = [];
  private readonly bestBefore: number | null;
  private readonly session: number;
  private readonly day: string;
  private readonly firstSessions: boolean;

  constructor(o: SimOpts) {
    this.p = migrate(o.progress);
    this.eeg = o.eeg;
    this.day = o.day;
    this.breathPattern = breathOk(this.p.breath) ? this.p.breath : BREATH_DEF;
    // the preparation, read once; the letter taken from the lobby (it is gone from there now)
    this.view = prepView(this.p.prep);
    this.friends = [...this.p.prep.friends];
    this.letter = takeLetter();
    const cyc = breathCycle(this.breathPattern);
    this.plan = planFor({
      plannedSec: o.plannedSec, cyc, eeg: o.eeg, way: this.p.prep.way,
      counts: { feelings: this.view.feelings.length, stones: this.view.stones.length, lanterns: this.view.lanterns.length, seeds: this.view.seeds.length },
      focus: o.rhythm?.focus ?? null, rest: o.rhythm?.rest ?? null, custom: !!o.rhythm?.custom,
    });
    // the acts, in the schedule's order
    const P = this.plan;
    P.stations.forEach((st, si) => {
      const list = actsOf(st.id, st.acts.length, this.view);
      st.acts.forEach((a, k) => {
        const pb = P.blocks.find(b => b.what === 'act' && b.station === si && b.act === k)!;
        const rb = P.blocks.find(b => b.what === 'settle' && b.station === si && b.act === k);
        const d = list[k] ?? { kind: 'wave' as ActKind, word: '', item: 0 };
        this.acts.push({
          station: si, id: st.id, i: k, kind: d.kind, word: d.word, item: d.item, need: needFor(a.push, P.lead) * (P.test ? RULES.testNeed : 1), p: 0, done: null, doneAt: -1,
          abide: 0, flowers: 0, t0: pb.t0, t1: pb.t1, r1: rb ? rb.t1 : pb.t1,
        });
      });
    });
    this.block = P.blocks[0];
    this.talk = new Talk(o.rng, undefined, o.plannedSec > RULES.talkFrom ? RULES.talkFresh : 0);
    this.bestBefore = bestOf(this.p);
    this.session = this.p.sessions + 1;
    this.before = cleanWeight(this.view.before ?? this.p.prep.before);
    this.firstSessions = this.p.sessions < 2;
  }

  // ── the clock ─────────────────────────────────────────────────

  get T(): number { return this.plan.T; }
  get lead(): number { return this.plan.lead; }
  get cyc(): number { return this.plan.cyc; }
  get pushBlock(): boolean { return this.block.kind === 'push'; }
  get restBlock(): boolean { return this.block.kind === 'rest'; }
  get sighted(): boolean { return this.pushBlock && this.blockT >= this.lead; }
  get dur(): number { return Math.max(0, this.block.t1 - this.block.t0); }
  /** the block's seconds left */
  get left(): number { return Math.max(0, this.block.t1 - this.t); }
  /** how far the block is (0..1) */
  get blockK(): number { return clamp(this.blockT / Math.max(0.01, this.dur)); }
  /** the breath now (rest blocks count it from their start; elsewhere from the session's) */
  get breath(): BreathState { return breathAt(this.breathPattern, this.restBlock ? this.blockT : this.t); }
  /** whole breaths of the current rest */
  get breaths(): number { return Math.max(1, Math.round(this.dur / this.cyc)); }
  /** the station now (null: the arrival or the dawn) */
  get station(): StationId | null { return this.block.station >= 0 ? this.plan.stations[this.block.station].id : null; }
  /** the act of this block (its push, or the settle after it) */
  get act(): ActRun | null {
    const b = this.block;
    if (b.act < 0) return null;
    return this.acts.find(a => a.station === b.station && a.i === b.act) ?? null;
  }
  /** the acts of a station, in order */
  actsAt(station: number): ActRun[] { return this.acts.filter(a => a.station === station); }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.p.lastLen = this.T;
    this.enter(this.plan.blocks[0]);
    if (this.firstSessions) this.coach('tap');
  }

  take(): SimEvent[] { return this.events.splice(0); }
  private emit(e: SimEvent): void { this.events.push(e); }
  private cue(c: SoundCue): void { this.emit({ type: 'cue', cue: c }); }
  /** A cue once per key (a moment inside a block). */
  private cueOnce(key: string, c: SoundCue): void {
    if (this.cued.has(key)) return;
    this.cued.add(key);
    this.cue(c);
  }

  private coach(what: Coach): void {
    const id = `c.${what}`;
    if (this.p.seen.includes(id)) return;
    this.p.seen.push(id);
    this.emit({ type: 'coach', what });
  }

  private showVerse(id: PassageId, dur?: number): void {
    this.card = { id, t0: this.t, dur: dur ?? Math.max(6, readTime(passage(id).text)) };
  }

  private setPlace(p: Place): void {
    if (this.place === p) return;
    this.place = p;
    this.walkAt = this.t;
    this.emit({ type: 'place', place: p });
  }

  // ── the blocks ────────────────────────────────────────────────

  private enter(b: PlanBlock): void {
    this.block = b;
    this.blockT = Math.max(0, this.t - b.t0);
    this.stallT = 0;
    this.waited = false;
    this.card = null;
    this.emit({ type: 'block', kind: b.kind, what: b.what });
    const st = b.station >= 0 ? this.plan.stations[b.station] : null;
    switch (b.what) {
      case 'arrive':
        this.talk.ask('arrive', 2, 8);
        break;
      case 'open':
        this.talk.hush();
        this.setPlace(st!.id);
        this.cue('step');
        this.abideSaid = false;
        this.talk.ask(openMoment(st!.id), 3, 10);
        if (st!.id === 'dlon') this.cue('warm');
        break;
      case 'act': {
        const a = this.act!;
        this.emit({ type: 'act', act: this.acts.indexOf(a) });
        const first = a.i === 0;
        this.talk.ask(actMoment(a.kind, a.id), first ? 2 : 1, 7);
        if (a.kind === 'wave') this.cue('wave');
        if (this.firstSessions) this.coach('act');
        break;
      }
      case 'settle': {
        const a = this.act!;
        if (a.id === 'kamienie' && a.done === 'kept') this.talk.ask('kamienieKeep', 3, 6);
        else if (a.id !== 'latarnie') this.talk.ask(`${a.id}Settle` as Moment, 1, 6);
        if (a.id === 'kamienie' && a.done === 'focus' && a.kind === 'drop') this.cue('ring');
        if (a.id === 'latarnie') this.cue('bless');
        if (this.firstSessions) this.coach('settle');
        break;
      }
      case 'sunrise':
        this.talk.hush();
        this.dawnReached = true;
        this.setPlace('dawn');
        this.cue('sun');
        this.talk.ask('sunrise', 3, 8);
        break;
      case 'call':
        this.talk.hush();
        this.talk.ask('call', 3, 6);
        break;
      case 'prayer':
        this.talk.hush();
        break;
      case 'close':
        this.talk.hush();
        this.dawnReached = true;
        this.setPlace('close');
        break;
    }
  }

  /** The block ends: an act not done is finished gently (a stone is kept in the open hand). */
  private leave(b: PlanBlock): void {
    if (b.what !== 'act') return;
    const a = this.act;
    if (!a || a.done) return;
    if (a.kind === 'drop' || a.kind === 'hold') {
      a.done = 'kept';
    } else {
      a.done = 'grace';
      a.p = 1;
      this.talk.hush();
      this.talk.ask(`${a.id}Grace` as Moment, 3, 6);
      this.cue('grace');
    }
    a.doneAt = this.t;
    this.emit({ type: 'done', act: this.acts.indexOf(a), by: a.done });
  }

  update(dt: number, f: FocusFrame, now: number): void {
    if (!this.started) return;
    const step = Math.max(0, Math.min(0.25, dt));
    this.t = now;
    // the schedule: every block ends at its planned time (late frames shorten the next, never the session)
    const B = this.plan.blocks;
    while (this.bi < B.length - 1 && this.t >= this.block.t1) {
      this.leave(this.block);
      this.bi++;
      this.enter(B[this.bi]);
    }
    this.blockT = Math.max(0, this.t - this.block.t0);
    this.reliable = f.reliable;
    if (f.reliable) this.mean.push(f.level, step);
    this.rate = this.sighted && f.reliable ? focusRate(this.mean.value ?? f.level, f.focused, f.hold) : 0;
    const shown = this.pushBlock ? (f.reliable ? f.level : 0.15) : 0.35;
    this.light = approach(this.light, shown, step, RULES.showTau);
    this.calm = approach(this.calm, f.reliable ? f.calm : 0, step, 1.5);
    if (this.block.kind !== 'free') this.contrast.push(this.block.kind === 'push' ? 'focus' : 'rest', f.activity, f.reliable, this.blockT, step);
    switch (this.block.what) {
      case 'arrive': this.updateArrive(); break;
      case 'act': this.updateAct(step); break;
      case 'settle': this.updateSettle(); break;
      case 'sunrise': this.updateSunrise(); break;
      case 'call': this.updateCall(); break;
      case 'close': this.updateClose(step); break;
      default: break;
    }
    if (this.card && this.t > this.card.t0 + this.card.dur) this.card = null;
    const blocked = this.t < this.hintUntil || this.blockT < 1.2;
    this.talk.update(step, this.t, blocked);
  }

  // ── the arrival ───────────────────────────────────────────────

  private updateArrive(): void {
    const A = this.block.t1;
    if (!this.card && this.blockT > Math.min(this.cyc, A * 0.4) && this.blockT < A - 4) this.showVerse(verseFor('arrive', this.session), A - this.t);
  }

  // ── an act: only focus moves it ───────────────────────────────

  private updateAct(dt: number): void {
    const a = this.act;
    if (!a) return;
    if (this.rate > 0) {
      this.stallT = 0;
      if (!a.done) {
        a.p = Math.min(1, a.p + (this.rate * dt) / a.need);
        // the half-way of a two-part act (the letter folded, the gate closed)
        if (a.kind === 'foldSail' && a.p >= 0.45) this.cueOnce(`fold${this.bi}`, 'fold');
        if (a.kind === 'closeRose' && a.p >= 0.55) this.cueOnce(`gate${this.bi}`, 'gate');
        if (a.p >= 1) this.complete(a);
      } else if (a.done === 'focus' && a.flowers < 1 + RULES.abideMax) {
        a.abide += this.rate * dt;
        if (a.abide >= RULES.abideSec * a.flowers) this.grow(a);
        if (!this.abideSaid && this.left > 6) {
          this.abideSaid = true;
          this.talk.ask('abide', 1, 4);
        }
      }
    } else if (this.sighted && !a.done) {
      this.stallT += dt;
      if (this.stallT > RULES.waitSec && !this.waited) {
        this.waited = true;
        this.talk.ask('wait', 2, 6);
      }
    }
  }

  private complete(a: ActRun): void {
    a.p = 1;
    a.done = 'focus';
    a.doneAt = this.t;
    this.emit({ type: 'done', act: this.acts.indexOf(a), by: 'focus' });
    const c = doneCue(a.kind);
    if (c) this.cue(c);
    this.grow(a);
  }

  /** A flower grown by an act (its bud stands at the act's place until the dawn opens it). */
  private grow(a: ActRun): void {
    const k = this.stationFlowers.get(a.id) ?? 0;
    const at = flowerSpot(a.id, k, this.meadowUsed.n);
    if (at.meadow) this.meadowUsed.n++;
    this.stationFlowers.set(a.id, k + 1);
    a.flowers++;
    this.flowers.push({ station: a.id, spot: at.spot, born: this.t, act: this.acts.indexOf(a) });
    this.emit({ type: 'flower', n: this.flowers.length });
    if (this.firstSessions) this.coach('flower');
  }

  // ── a settle: receptive, whole breaths ────────────────────────

  private updateSettle(): void {
    const a = this.act;
    if (!a) return;
    const k = this.blockK;
    // the moments of a settle: the tear gathered, the sprouts in the rain
    if (a.id === 'lzy' && k >= 0.55 && !this.cued.has(`drop${this.bi}`)) {
      this.cueOnce(`drop${this.bi}`, 'drop');
      this.tears++;
    }
    if (a.id === 'nasiona' && k >= 0.5) this.cueOnce(`sprout${this.bi}`, 'sprout');
    if (this.card) return;
    const st = this.plan.stations[a.station];
    const settles = st.acts.length;
    const B = this.breaths;
    const showAt = B >= 2 ? this.cyc * 0.95 : this.dur * 0.45;
    if (this.blockT < showAt || this.left < 3) return;
    if (a.id === 'latarnie') {
      // the blessing has the band; a passage only after it, in a settle of two breaths or more (the first and the last)
      if (B < 2 || this.blockK < 0.5 || (a.i !== 0 && a.i !== settles - 1)) return;
      this.showVerse(verseFor('latarnie', this.session, a.i === 0 ? 0 : 1), Math.max(2, this.left));
      return;
    }
    // the station's passage in its first settle; later ones every other settle (one-breath settles: every other too)
    const show = a.i === 0 || (a.i % 2 === 0);
    if (!show) return;
    this.showVerse(verseFor(a.id, this.session, a.i / 2), Math.max(2, this.left));
  }

  /** The blessing under the lantern of this settle (null: not a lantern's settle, or its passage has the band). */
  get blessing(): string | null {
    const a = this.act;
    if (!a || a.id !== 'latarnie' || this.block.what !== 'settle' || this.card) return null;
    const L = this.view.lanterns[a.item];
    if (!L) return null;
    // the friend by name alone: the lantern's paper says "For Anna" in English, German and Swedish ("Anna" in Polish)
    const name = L.who === 'friend' ? this.friends[a.item - 1] ?? L.text : '';
    const line = L.who === 'me' ? t('bless.me') : L.who === 'friend' ? t('bless.friend', { name }) : L.who === 'hurt' ? t('bless.hurt') : t('bless.all');
    const acts = this.actsAt(a.station);
    const last = a.i === acts.length - 1 && acts.length < this.view.lanterns.length;
    return last ? `${line} ${t('bless.others')}` : line;
  }

  /** The friend's name a lantern carries (the view draws it on the paper); the catalog's text otherwise. */
  lanternText(i: number): string { return this.view.lanterns[i]?.text ?? ''; }

  // ── the dawn ──────────────────────────────────────────────────

  private updateSunrise(): void {
    const k = this.blockK;
    if (k >= 0.12) this.cueOnce('bird', 'bird');
    // the buds open one after another over the sunrise's middle
    if (this.flowers.length && k >= 0.2) this.cueOnce('bloom', 'bloom');
    const showAt = this.breaths >= 2 ? this.cyc * 0.95 : this.dur * 0.4;
    if (!this.card && this.blockT >= showAt && this.left > 3) this.showVerse(verseFor('sunrise', this.session), Math.max(2, this.left));
  }

  /** The name: the gardener's question (Jn 20:15-16), then the player's name in light — or "I have called you by name". */
  get callPhase(): 'say' | 'verse' | 'name' {
    if (this.block.what !== 'call') return 'say';
    const k = this.blockK;
    if (this.dur < 9) return 'name';
    // the narrator's line (from 1.2 s, ~5 s long), then the passage; the name from 62 % (the view's fade of the name
    // in light begins there)
    const say = Math.min(0.3, RULES.callSay / this.dur);
    return k < say ? 'say' : k < 0.62 ? 'verse' : 'name';
  }

  private updateCall(): void {
    const ph = this.callPhase;
    if (ph === 'verse' && (!this.card || this.card.id !== VERSES.call[0])) {
      // the passage needs ~20 s to read: with a name to call it stays on the band while the name rises in light
      // ("…Maryjo!"); without one it gives way to "I have called you by name" when the name's moment comes
      const until = this.view.name ? this.block.t1 : this.block.t0 + this.dur * 0.62;
      this.showVerse(VERSES.call[0], Math.max(2, until - this.t));
    }
    if (ph === 'name') {
      this.cueOnce('call', 'call');
      if (!this.view.name && (!this.card || this.card.id !== VERSES.name[0])) this.showVerse(VERSES.name[0], Math.max(2, this.left));
    }
  }

  /** The name the dawn calls (null: none given — the card says "I have called you by name"). */
  get name(): string | null { return this.view.name; }

  /** The sky's dawn now: the night (0) through the blue hour and the rose to the risen sun (1). */
  get sky(): number {
    const P = this.plan;
    const first = P.blocks.find(b => b.what === 'open');
    const s0 = first ? first.t0 : P.dawnStart;
    if (this.t < s0) return 0.02;
    if (this.t < P.dawnStart) return 0.04 + (RULES.skyStations - 0.04) * clamp((this.t - s0) / Math.max(1, P.dawnStart - s0));
    if (this.t < P.sunriseEnd) {
      const k = clamp((this.t - P.dawnStart) / Math.max(1, P.sunriseEnd - P.dawnStart));
      return RULES.skyStations + (1 - RULES.skyStations) * (0.5 - 0.5 * Math.cos(Math.PI * k));
    }
    return 1;
  }

  /** How open the flowers are at dawn (0 buds … 1 all open), the i-th of n opening in turn over the sunrise. */
  bloomOf(i: number, n: number): number {
    const P = this.plan;
    if (this.t < P.dawnStart) return 0;
    const span = Math.max(1, P.sunriseEnd - P.dawnStart);
    const k = (this.t - P.dawnStart) / span;
    const at = 0.18 + 0.6 * (n <= 1 ? 0 : i / (n - 1));
    return clamp((k - at) / 0.22);
  }

  // ── the close ─────────────────────────────────────────────────

  /** The words of the close in turn: the prayer (when the dawn had no rest of its own for it), the blessing, the verse. */
  get closeText(): 'prayer' | 'bless' | 'verse' {
    if (this.block.what !== 'close') return 'bless';
    const prayed = this.plan.prayerEnd > this.plan.callEnd + 0.5;
    const k = this.blockK;
    if (!prayed) return k < 0.45 ? 'prayer' : k < 0.66 ? 'bless' : 'verse';
    return k < 0.4 ? 'bless' : 'verse';
  }

  /** The closing passage (result().verse too). */
  get closingVerse(): PassageId { return inTurn(VERSES.close, this.session); }

  private updateClose(dt: number): void {
    if (this.closeText === 'verse' && !this.card) this.showVerse(this.closingVerse, Infinity);
    if (this.t >= this.T) this.overT += dt;
  }

  /** The 0–10 row shows in the close. */
  get rateOpen(): boolean { return this.block.what === 'close'; }

  /** The player's "how heavy is your heart now" (0–10), once. */
  rate10(n: number): boolean {
    if (!this.rateOpen || this.rating !== null) return false;
    const v = cleanWeight(n);
    if (v === null) return false;
    this.rating = v;
    this.emit({ type: 'rated', n: v });
    return true;
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
    if (/^[0-9]$/.test(key) && this.rateOpen) return this.rate10(Number(key));
    if (key === ' ' || key === 'Enter') return this.stay();
    return false;
  }

  // ── what the runner reads ─────────────────────────────────────

  canStop(): boolean {
    if (this.t < this.T) return false;
    return this.rating !== null || this.overT >= RULES.rateWait || this.block.what !== 'close';
  }

  /** The runner's gauge: the act's light in a push (null without a signal), calm in a rest. */
  meter(): number | null {
    if (this.pushBlock) return this.reliable ? clamp(this.light) : null;
    if (this.restBlock) return this.reliable ? clamp(this.calm) : null;
    return null;
  }

  /** The next block is near: its telegraph is up. */
  get telegraphed(): boolean {
    const d = this.dur;
    return this.left <= RULES.telegraph && d > RULES.telegraph + 1 && this.bi < this.plan.blocks.length - 1;
  }

  get nextKind(): BlockKind | null {
    const n = this.plan.blocks[this.bi + 1];
    return n ? n.kind : null;
  }

  /** What the band asks now, in the panel's words. */
  get tip(): string {
    const b = this.block, a = this.act;
    switch (b.what) {
      case 'arrive': return t('task.arrive');
      case 'open': return t('task.open');
      case 'act': {
        if (!a) return t('task.open');
        if (a.done === 'focus') return t('task.abide');
        switch (a.kind) {
          case 'wave': return t('task.lzy');
          case 'write': return t('task.dlon');
          case 'fold': return t('task.fold');
          case 'foldSail': return t(a.p < 0.45 ? 'task.fold' : 'task.sail');
          case 'sail': return t('task.sail');
          case 'close': return t('task.close');
          case 'closeRose': return t(a.p < 0.55 ? 'task.close' : 'task.rose');
          case 'rose': return t('task.rose');
          case 'drop': return t('task.drop');
          case 'hold': return t('task.hold');
          case 'light': return t('task.light');
          case 'sow': return t('task.sow');
          default: return t('task.tend');
        }
      }
      case 'settle':
        if (a && a.id === 'kamienie' && a.done === 'kept') return t('task.settle.keep');
        return a ? t(`task.settle.${a.id}` as Key) : t('task.open');
      case 'sunrise': return t('task.sunrise');
      case 'call': return t('task.call');
      case 'prayer': return t('task.prayer');
      default: return t('task.end');
    }
  }

  /** The headline's second line: where the walk is. */
  get subLine(): string {
    const id = this.station;
    if (id) return t(`st.${id}` as Key);
    return t(this.block.what === 'arrive' ? 'st.arrive' : 'st.dawn');
  }

  coachWords(what: Coach, touch: boolean): string {
    if (what === 'tap') return t(touch ? 'coach.tap' : 'coach.click');
    return t(`coach.${what}` as Key);
  }

  // ── the session's numbers ─────────────────────────────────────

  get score(): number { return this.flowers.length; }

  /** Acts done with focus, by grace, kept (stones), and in all (of those begun). */
  get tally(): { focus: number; grace: number; kept: number; all: number; dropped: number } {
    let focus = 0, grace = 0, kept = 0, dropped = 0;
    for (const a of this.acts) {
      if (a.done === 'focus') { focus++; if (a.kind === 'drop') dropped++; }
      else if (a.done === 'grace') grace++;
      else if (a.done === 'kept') kept++;
    }
    return { focus, grace, kept, all: this.acts.length, dropped };
  }

  /** Stations walked: entered (all of them once the dawn is reached). */
  get walked(): number {
    if (this.dawnReached) return this.plan.stations.length;
    return this.block.station >= 0 ? this.block.station + 1 : 0;
  }

  /** Settle the session once (the runner's finish(), or the close's end): the records, the week, the before → after. */
  finish(): void {
    if (this.credited || !this.started) return;
    this.credited = true;
    const p = this.p;
    const tl = this.tally;
    p.sessions = this.session;
    p.best = Math.max(p.best, this.score);
    p.flowers += this.score;
    p.acts += tl.focus;
    p.grace += tl.grace;
    p.stones += tl.dropped;
    if (this.dawnReached) p.ways += 1;
    if (this.rating !== null) addWeight(p, this.day, this.before, this.rating);
    // the before belongs to this session: the next one asks again
    p.prep.before = null;
    // the week: the boundary chosen, the friends to reach out to, the seeds to tend — of the stations walked (the
    // lobby's card shows it); what this session did not walk keeps last week's (≤ 7 days old), and a session that walked
    // none of the three keeps last week's card as it was (a short way, or a session ended early)
    const walked = this.plan.stations.slice(0, this.walked).map(s => s.id);
    const today = this.day.slice(0, 10), prev = p.week;
    const fresh = !!prev && (Date.parse(today) - Date.parse(prev.day)) / 86_400_000 <= 7;
    const gives = (['furtka', 'latarnie', 'nasiona'] as const).filter(s => walked.includes(s));
    if (prev && fresh && !gives.length) return;
    const week = weekOf(p.prep, today, walked);
    if (prev && fresh) {
      if (!walked.includes('furtka')) week.intention = prev.intention;
      if (!walked.includes('latarnie')) week.friends = [...prev.friends];
      if (!walked.includes('nasiona')) week.seeds = [...prev.seeds];
    }
    p.week = week;
  }

  result(): ArcadeOutcome {
    const tl = this.tally;
    const stats: [string, string][] = [];
    stats.push([t('stat.stations'), t('stat.of', { n: this.walked, of: this.plan.stations.length })]);
    stats.push([t('stat.acts'), t('stat.of', { n: tl.focus, of: tl.all })]);
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    stats.push([t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })]);
    if (this.before !== null && this.rating !== null) stats.push([t('stat.heavy'), t('stat.heavyV', { a: this.before, b: this.rating })]);
    const highlights: string[] = [];
    if (this.dawnReached) highlights.push(t('hl.dawn'));
    highlights.push(this.score > 0 ? t('hl.garden') : t('hl.quiet'));
    if (tl.grace > 0 && this.score > 0) highlights.push(t('hl.grace'));
    if (tl.kept > 0) highlights.push(t('hl.kept'));
    const record = this.score > 0 && (this.bestBefore === null || this.score > this.bestBefore);
    if (record && this.bestBefore !== null) highlights.push(t('hl.record'));
    return { score: this.score, unit: unit(this.score), record, stats, highlights, verse: this.closingVerse };
  }

  /** For tests and the debug view. */
  get debug(): Record<string, unknown> {
    const a = this.act;
    return {
      place: this.place, block: `${this.block.kind}:${this.block.what}`, t: Math.round(this.t), blockT: Math.round(this.blockT * 10) / 10,
      act: a ? `${a.kind}:${Math.round(a.p * 100)}:${a.done ?? '-'}` : '-', flowers: this.score, sky: Math.round(this.sky * 100) / 100,
    };
  }
}
