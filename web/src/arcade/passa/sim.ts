/**
 * Złota passa's session, without the canvas (DESIGN.md §26): the day of one session over the plan of rules.ts — dawn
 * on the street, the moments one after another (each arrives, a heavy one is named, focus turns it, then the light flies
 * up into the garland or the card goes into the pocket), the evening with the garland, the identity, the prayer and the
 * close — what the focus drives, what the band is asked, what the narrator says, the `PassaView` the street draws every
 * frame (builder B's render.ts), and the session's numbers.
 *
 * Honest neurofeedback (§18.3–18.4): a card turns only in a sighted push past its lead-in, with a reliable signal,
 * while focused, at `focusRate` (the level averaged over a whole breath).  Taps choose the reframe, never turn.  A card
 * focus did not turn by its push's end is never turned for the player: it goes gently into the pocket ("idzie ze mną")
 * — no false win, no blame, and the run of wins ends quietly (every light of the garland stays).
 *
 * The player's own moments (the lobby's "Mój dzień") come first; their words live only in this object and the progress
 * on this device — result() carries only numbers and the catalog's sentences, never a moment's words.
 */
import { fmtNum, lang } from '../../i18n';
import { BREATH_DEFAULT, breathAt, type BreathState } from '../kit/breath';
import { BlockContrast, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import type { Rhythm } from '../kit/rhythm';
import { inTurn, passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import type { StreetCue } from './audio';
import { HEAVIES, JOYS, OWN_MOTIF, SNAGS, VERSES, setById, verseFor, type Say, type SetMoment } from './content';
import { signText, t, unit, type Key } from './i18n';
import { bestOf, creditDay, migrate, type OwnMoment, type PassaProgress } from './meta';
import type { DayPart, Moment, MomentKind } from './moments';
import { RULES, dayAt, daysBetween, focusRate, needFor, partOf, planFor, readTime, streakAfter, type BlockKind, type BlockWhat, type Plan, type PlanBlock } from './rules';
import { OWN_WINS, TRUST, setWords } from './sets';
import { Talk } from './talk';
import type { CardView, ChoiceView, PassaView, Phase } from './view';

export type { BlockKind, BlockWhat };

/** How a moment ended: turned by focus (a win), or carried in the pocket. */
export type Done = 'win' | 'carry';

/** A moment as the session plays it. */
export interface MomentRun extends Moment {
  slot: number;
  /** the set moment's id (null: the player's own), the own moment's id (null: a set's) */
  setId: string | null;
  ownId: string | null;
  /** a carried card that came back: since yesterday, or since an earlier day */
  back: 'yesterday' | 'lately' | null;
  /** focus-seconds it asks; how far it turned (0..1); the gold words written (0..1); the turn shown */
  need: number;
  p: number;
  write: number;
  shown: number;
  /** the choice picked (−1: none yet — the first goes) */
  chosen: number;
  done: Done | null;
  doneAt: number;
  /** focus-seconds held after the turn, and the sparkles they gave (no score) */
  abide: number;
  sparkles: number;
  /** its turn block began (it was met) */
  met: boolean;
}

export type Coach = 'turn' | 'choose' | 'savor' | 'carry';

export type SimEvent =
  | { type: 'block'; kind: BlockKind; what: BlockWhat }
  | { type: 'cue'; cue: StreetCue; n: number }
  | { type: 'turned'; slot: number; trust: boolean }
  | { type: 'carried'; slot: number }
  | { type: 'chose'; slot: number; i: number }
  | { type: 'picked'; i: number }
  | { type: 'sparkle' }
  | { type: 'coach'; what: Coach };

/** A passage on the street's card place: since when, for how long. */
export interface VerseCard { id: PassageId; t0: number; dur: number }

export interface SimOpts {
  progress: PassaProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  rhythm?: Rhythm | null;
  /** today ('YYYY-MM-DD') */
  day: string;
  reduced?: boolean;
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

const ease = (x: number): number => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x));

/** The labels of a moment's choices: its wins, and "not yet — I trust" on a heavy card. */
export const labelsOf = (m: Pick<Moment, 'wins' | 'trust'>): string[] => (m.trust ? [...m.wins, m.trust] : [...m.wins]);

export class PassaSim {
  readonly p: PassaProgress;
  readonly plan: Plan;
  readonly runs: MomentRun[];
  readonly talk: Talk;
  readonly eeg: boolean;
  readonly reduced: boolean;
  readonly contrast = new BlockContrast(4);
  /** the day-streak as it stands with today's session (the street's sign) */
  readonly days: number;
  started = false;
  bi = 0;
  block: PlanBlock;
  blockT = 0;
  t = 0;
  /** what the focus does this frame (focus-seconds a second) and its shown pace, calm, the glow on the card */
  rate = 0;
  rateShown = 0;
  calm = 0;
  glow = 0;
  reliable = false;
  /** the session's wins, the run now and the longest, trust's wins, cards carried */
  wins = 0;
  inRow = 0;
  bestRun = 0;
  trustWins = 0;
  carried = 0;
  /** a heavy moment was met (its turn began) */
  heavyMet = false;
  /** the passage on the card place (rests and the close) */
  verse: VerseCard | null = null;
  /** the close's "for what most?": the wins it offers (their slots) and the one picked (−1 none) */
  pickSlots: number[] = [];
  picked = -1;
  /** the runner's coach mark is up until this time (the narrator waits) */
  hintUntil = 0;
  private runBanner: { n: number; until: number } | null = null;
  private pickLapsed = false;
  private stallT = 0;
  private waited = false;
  private abideSaid = false;
  private credited = false;
  private readonly mean = new WindowMean(RULES.meanSec);
  private readonly events: SimEvent[] = [];
  private readonly bestBefore: number | null;
  private readonly session: number;
  private readonly day: string;
  private readonly first: boolean;
  private readonly firstSessions: boolean;
  private readonly rng: () => number;

  constructor(o: SimOpts) {
    this.p = migrate(o.progress);
    this.eeg = o.eeg;
    this.day = o.day;
    this.rng = o.rng;
    this.reduced = !!o.reduced;
    this.first = this.p.sessions === 0;
    this.firstSessions = this.p.sessions < 2;
    this.session = this.p.sessions + 1;
    this.bestBefore = bestOf(this.p);
    this.days = Math.max(1, streakAfter(this.p.streak, o.day).days);
    this.plan = planFor({
      plannedSec: o.plannedSec, eeg: o.eeg, focus: o.rhythm?.focus ?? null, rest: o.rhythm?.rest ?? null, custom: !!o.rhythm?.custom,
      first: this.first, heavy: this.p.hard,
    });
    this.runs = this.buildRuns();
    this.block = this.plan.blocks[0];
    this.talk = new Talk(o.rng);
  }

  // ── the day's moments ─────────────────────────────────────────

  /** The moments of the day, slot by slot: the player's own first, the cards carried back, then the sets. */
  private buildRuns(): MomentRun[] {
    const P = this.plan, p = this.p, rng = this.rng;
    const heavySlot = P.heavyAt;
    // the player's own, in turn from where the last session stopped; a hard one only when asked for
    const n0 = p.own.length;
    const own = Array.from({ length: n0 }, (_, i) => p.own[(p.ownNext + i) % n0]);
    const ownLight = own.filter(o => o.kind !== 'heavy');
    const ownHeavy = p.hard ? own.find(o => o.kind === 'heavy') ?? null : null;
    // the cards carried last time (a heavy one only when asked for: it then takes the heavy slot)
    const last = this.p.streak.last;
    const gap = last ? daysBetween(last, this.day) : NaN;
    const back: 'yesterday' | 'lately' = gap === 1 ? 'yesterday' : 'lately';
    const carriedSets = p.carried.map(setById).filter((m): m is SetMoment => !!m);
    const carriedLight = carriedSets.filter(m => m.kind !== 'heavy');
    const carriedHeavy = p.hard ? carriedSets.find(m => m.kind === 'heavy') ?? null : null;

    const used = new Set<string>();
    const recent = new Set(p.recent);
    const runs: MomentRun[] = [];
    let snagsInRow = 0, setSlots = 0;
    const partAt = (slot: number): DayPart => {
      const b = P.blocks.find(x => x.what === 'turn' && x.slot === slot);
      return partOf(dayAt(P, b ? b.t0 : 0));
    };
    const pickSet = (kind: 'joy' | 'snag', part: DayPart): SetMoment | null => {
      const all = kind === 'joy' ? JOYS : SNAGS;
      let pool = all.filter(m => !used.has(m.id));
      if (!pool.length) {
        // a very long day used them all: they may come again
        for (const m of all) used.delete(m.id);
        pool = [...all];
      }
      const tiers = [pool.filter(m => !recent.has(m.id) && m.part === part), pool.filter(m => !recent.has(m.id)), pool.filter(m => m.part === part), pool];
      for (const tier of tiers) if (tier.length) return tier[Math.floor(rng() * tier.length)];
      return null;
    };
    let ownI = 0, backI = 0;
    // the set cards' kinds over the day: a little more joys than troubles (and never fewer), troubles at most as many as
    // the set has; spread so that three troubles never come in a row
    const setTotal = Math.max(0, P.n - (heavySlot >= 0 ? 1 : 0) - ownLight.length - carriedLight.length);
    let joysLeft = Math.max(Math.ceil(setTotal * 0.55), setTotal - SNAGS.length);
    let snagsLeft = Math.max(0, setTotal - joysLeft);
    for (let slot = 0; slot < P.n; slot++) {
      const part = partAt(slot);
      if (slot === heavySlot) {
        if (ownHeavy) runs.push(this.ownRun(ownHeavy, slot, part));
        else {
          const m = carriedHeavy ?? HEAVIES[p.heavyNext % HEAVIES.length];
          runs.push(this.setRun(m, slot, part, m === carriedHeavy ? back : null));
        }
        snagsInRow = 0;
        continue;
      }
      if (ownI < ownLight.length) {
        runs.push(this.ownRun(ownLight[ownI++], slot, part));
        continue;
      }
      if (backI < carriedLight.length) {
        const m = carriedLight[backI++];
        used.add(m.id);
        runs.push(this.setRun(m, slot, part, back));
        snagsInRow = m.kind === 'snag' ? snagsInRow + 1 : 0;
        continue;
      }
      // joys a little more often at first (easy wins build the identity), never three troubles in a row; the day's
      // first card from the street, and a test's, is a joy
      const pJoy = joysLeft / Math.max(1, joysLeft + snagsLeft) + (setSlots < 3 ? 0.12 : 0);
      // a joy only while the troubles left still fit between the joys left; a trouble never the third in a row
      const canJoy = joysLeft > 0 && snagsLeft <= 2 * joysLeft;
      const canSnag = snagsLeft > 0 && snagsInRow < 2;
      const joy = !canSnag || (canJoy && (setSlots === 0 || P.test || rng() < pJoy));
      if (joy) joysLeft--;
      else snagsLeft--;
      const m = pickSet(joy ? 'joy' : 'snag', part)!;
      used.add(m.id);
      setSlots++;
      snagsInRow = m.kind === 'snag' ? snagsInRow + 1 : 0;
      runs.push(this.setRun(m, slot, part, null));
    }
    return runs;
  }

  private needOf(slot: number): number {
    const P = this.plan;
    return needFor(P.push, P.lead) * (P.test ? RULES.testNeed : 1) * (this.first && slot === 0 ? RULES.firstNeed : 1);
  }

  private base(slot: number): Omit<MomentRun, keyof Moment | 'setId' | 'ownId' | 'back'> {
    return { slot, need: this.needOf(slot), p: 0, write: 0, shown: 0, chosen: -1, done: null, doneAt: -1, abide: 0, sparkles: 0, met: false };
  }

  private setRun(m: SetMoment, slot: number, part: DayPart, back: 'yesterday' | 'lately' | null): MomentRun {
    const w = setWords(m.id, lang) ?? setWords(m.id, 'pl')!;
    return {
      ...this.base(slot), id: m.id, kind: m.kind, motif: m.motif, part, what: w.what, wins: [...w.wins],
      trust: m.kind === 'heavy' ? TRUST[lang] : undefined, own: false, setId: m.id, ownId: null, back,
    };
  }

  private ownRun(o: OwnMoment, slot: number, part: DayPart): MomentRun {
    const gen = OWN_WINS[lang][o.kind];
    const wins = o.win ? (o.kind === 'joy' ? [o.win] : [o.win, gen[0]]) : [...gen];
    return {
      ...this.base(slot), id: `own:${o.id}`, kind: o.kind, motif: OWN_MOTIF[o.kind], part, what: o.text, wins,
      trust: o.kind === 'heavy' ? TRUST[lang] : undefined, own: true, setId: null, ownId: o.id, back: null,
    };
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
  /** the moment of this block (null: the intro or the evening) */
  get cur(): MomentRun | null { return this.block.slot >= 0 ? this.runs[this.block.slot] ?? null : null; }
  /** the breath of a rest (4 · 0 · 6 · 0 from its start), null elsewhere */
  get breath(): BreathState | null { return this.restBlock ? breathAt(BREATH_DEFAULT, this.blockT) : null; }
  /** the day's light now (0 dawn … 1 night) */
  get day01(): number { return dayAt(this.plan, this.t); }
  /** a story card of a first-ever session's dawn (the hud draws it) */
  get story(): boolean { return this.started && this.first && this.block.what === 'intro' && this.left > 1.2; }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.p.lastLen = this.T;
    this.enter(this.plan.blocks[0]);
  }

  take(): SimEvent[] { return this.events.splice(0); }
  private emit(e: SimEvent): void { this.events.push(e); }
  private cue(c: StreetCue, n = 0): void { this.emit({ type: 'cue', cue: c, n }); }

  private coach(what: Coach): void {
    if (!this.firstSessions) return;
    const id = `c.${what}`;
    if (this.p.seen.includes(id)) return;
    this.p.seen.push(id);
    this.emit({ type: 'coach', what });
  }

  private showVerse(id: PassageId, dur?: number): void {
    this.verse = { id, t0: this.t, dur: dur ?? Math.max(6, readTime(passage(id).text)) };
  }

  // ── the blocks ────────────────────────────────────────────────

  private enter(b: PlanBlock): void {
    this.block = b;
    this.blockT = Math.max(0, this.t - b.t0);
    this.stallT = 0;
    this.waited = false;
    this.verse = null;
    this.emit({ type: 'block', kind: b.kind, what: b.what });
    const r = this.cur;
    switch (b.what) {
      case 'intro':
        this.cue('dawn');
        // the habit first (the streak's day), then the day's opening line
        if (this.days >= 2) this.talk.say(t('say.days', { n: this.days }), 3, 8);
        this.talk.ask(this.first ? 'introFirst' : 'intro', 2, 12);
        break;
      case 'arrive': {
        if (!r) break;
        this.cue('arrive');
        const say: Say | null = r.back ? (r.back === 'yesterday' ? 'backYesterday' : 'backLately') : r.own ? 'arriveOwn' : r.kind === 'joy' ? 'arriveJoy' : r.kind === 'snag' ? 'arriveSnag' : null;
        if (say) this.talk.ask(say, r.back ? 3 : 1, 4);
        if (r.kind !== 'heavy' && labelsOf(r).length > 1) this.coach('choose');
        break;
      }
      case 'name':
        this.talk.hush();
        this.cue('heavy');
        this.talk.ask('name', 3, 8);
        break;
      case 'turn':
        if (!r) break;
        r.met = true;
        if (r.kind === 'heavy') this.heavyMet = true;
        this.abideSaid = false;
        this.cue('turnStart');
        this.talk.ask(r.kind === 'joy' ? 'turnJoy' : r.kind === 'snag' ? 'turnSnag' : 'turnHeavy', 2, 6);
        this.coach('turn');
        if (r.kind === 'heavy') this.coach('choose');
        break;
      case 'after':
        if (!r) break;
        if (r.done === 'win') {
          this.cue('light', this.wins);
          this.talk.ask('savor', 1, 5);
          this.coach('savor');
        } else {
          this.cue('carry');
          this.talk.hush();
          this.talk.ask('carry', 3, 6);
          this.coach('carry');
        }
        break;
      case 'garland':
        this.talk.hush();
        this.cue('evening', this.wins);
        this.talk.ask(this.wins > 0 ? 'evening' : 'eveningQuiet', 3, 8);
        break;
      case 'prayer':
        this.talk.hush();
        break;
      case 'close': {
        this.talk.hush();
        // the day's wins to pick "for what most" (≥ 2): the player's own first, then the latest
        const won = this.runs.filter(x => x.done === 'win');
        const pick = [...won.filter(x => x.own), ...won.filter(x => !x.own).reverse()].slice(0, 4);
        this.pickSlots = won.length >= 2 ? pick.map(x => x.slot) : [];
        if (!this.pickSlots.length) this.talk.ask('close', 1, 8);
        break;
      }
    }
  }

  /** The block ends: a moment's push not turned by focus goes into the pocket (never turned for the player). */
  private leave(b: PlanBlock): void {
    if (b.what !== 'turn') return;
    const r = this.runs[b.slot];
    if (!r || r.done) return;
    r.done = 'carry';
    r.doneAt = this.t;
    this.carried++;
    this.inRow = 0;
    this.emit({ type: 'carried', slot: r.slot });
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
    this.rateShown = approach(this.rateShown, this.rate, step, RULES.showTau);
    this.calm = approach(this.calm, f.reliable ? f.calm : 0, step, 1.5);
    if (this.block.kind !== 'free') this.contrast.push(this.block.kind === 'push' ? 'focus' : 'rest', f.activity, f.reliable, this.blockT, step);
    switch (this.block.what) {
      case 'turn': this.updateTurn(step); break;
      case 'after': this.updateAfter(step); break;
      case 'name': this.updateName(); break;
      case 'intro': this.updateIntro(); break;
      case 'garland': this.updateGarland(); break;
      case 'prayer': this.updatePrayer(); break;
      case 'close': this.updateClose(); break;
      default: break;
    }
    this.updateGlow(step);
    const r = this.cur;
    if (r) r.shown = this.block.what === 'after' && r.done === 'carry' ? approach(r.shown, 0, step, 0.8) : approach(r.shown, r.p, step, this.reduced ? 0.05 : 0.35);
    if (this.verse && this.t > this.verse.t0 + this.verse.dur) this.verse = null;
    if (this.runBanner && this.t > this.runBanner.until) this.runBanner = null;
    const blocked = this.t < this.hintUntil || this.blockT < 0.8 || this.block.what === 'prayer';
    this.talk.update(step, this.t, blocked);
  }

  // ── a turn: only focus turns the card ─────────────────────────

  private updateTurn(dt: number): void {
    const r = this.cur;
    if (!r) return;
    if (!r.done) {
      if (this.rate > 0) {
        this.stallT = 0;
        r.p = Math.min(1, r.p + (this.rate * dt) / r.need);
        if (r.p >= 1) this.turned(r);
      } else if (this.sighted) {
        this.stallT += dt;
        if (this.stallT > RULES.waitSec && !this.waited) {
          this.waited = true;
          this.talk.ask('wait', 2, 6);
        }
      }
    } else if (r.done === 'win' && this.rate > 0) {
      // abiding: the glow stays; a held focus gives a sparkle now and then — never a score
      r.abide += this.rate * dt;
      if (r.sparkles < RULES.sparkleMax && r.abide >= RULES.sparkleSec * (r.sparkles + 1)) {
        r.sparkles++;
        this.emit({ type: 'sparkle' });
      }
      if (!this.abideSaid && this.left > 6) {
        this.abideSaid = true;
        this.talk.ask('abide', 1, 4);
      }
    }
    // the gold words write themselves as the card turns, never back; once turned they finish at their pace
    const target = r.done === 'win' ? 1 : clamp((r.p - RULES.writeFrom) / (1 - RULES.writeFrom));
    if (target > r.write) r.write = Math.min(target, r.write + RULES.writeRate * dt);
  }

  private turned(r: MomentRun): void {
    r.p = 1;
    r.done = 'win';
    r.doneAt = this.t;
    if (r.chosen < 0) r.chosen = 0;
    const trust = this.isTrust(r, r.chosen);
    this.wins++;
    this.inRow++;
    this.bestRun = Math.max(this.bestRun, this.inRow);
    if (trust) this.trustWins++;
    this.emit({ type: 'turned', slot: r.slot, trust });
    this.cue(trust ? 'trust' : 'turned', this.wins);
    this.talk.hush();
    if (RULES.runSay.includes(this.inRow)) {
      this.talk.say(t('say.run', { n: this.inRow }), 4, 6);
      this.runBanner = { n: this.inRow, until: this.t + RULES.runBanner };
    } else this.talk.ask(trust ? 'turnedTrust' : 'turned', 3, 5);
  }

  private isTrust(r: MomentRun, i: number): boolean {
    return !!r.trust && i === r.wins.length;
  }

  // ── the rests and the free parts ──────────────────────────────

  private updateAfter(dt: number): void {
    const r = this.cur;
    if (r && r.done === 'win') r.write = Math.min(1, r.write + RULES.writeRate * dt);
  }

  private updateIntro(): void {
    if (this.first || this.verse || this.plan.test) return;
    const k = this.blockT;
    if (k > 3 && this.left > 4) this.showVerse(verseFor('intro', this.session), Math.max(2, this.left - 0.5));
  }

  private updateName(): void {
    if (!this.verse && this.blockT >= Math.min(this.cyc * 0.9, this.dur * 0.4) && this.left > 3) this.showVerse(VERSES.name[0], Math.max(2, this.left));
  }

  private updateGarland(): void {
    // the identity first (the banner), the garland's passage after a breath — when the garland has two or more
    if (!this.verse && this.dur >= 2 * this.cyc - 0.01 && this.blockT >= this.cyc * 0.95 && this.left > 3) {
      this.showVerse(verseFor('garland', this.session), Math.max(2, this.left));
    }
  }

  private updatePrayer(): void {
    if (!this.verse && this.blockT >= 0.6 && this.left > 3) this.showVerse(verseFor('prayer', this.session), Math.max(2, this.left));
  }

  private updateClose(): void {
    const open = this.pickOpen;
    // no pick made: the question closes quietly and the narrator says good night
    if (!open && this.pickSlots.length && this.picked < 0 && !this.pickLapsed) {
      this.pickLapsed = true;
      this.talk.ask('close', 1, 8);
    }
    // the closing verse: once the pick is made (or there is none), from 45 % of the close
    if (!this.verse && !open && this.blockK >= (this.picked >= 0 ? 0 : 0.45)) this.showVerse(this.closingVerse, Infinity);
  }

  private updateGlow(dt: number): void {
    const r = this.cur, w = this.block.what;
    let target = 0;
    if (w === 'turn' && r) {
      if (r.done === 'win') target = 0.82 + (this.rate > 0 ? 0.18 : 0);
      else if (!this.sighted) target = 0.15;
      else {
        const pace = r.need / Math.max(1, this.plan.push - this.lead);
        target = clamp((0.5 * this.rateShown) / Math.max(0.05, pace));
      }
    } else if (w === 'after' && r) target = r.done === 'win' ? 0.4 + 0.6 * this.calm : 0.12;
    else if (w === 'name') target = 0.2 + 0.35 * this.calm;
    else if (w === 'arrive') target = 0.2;
    this.glow = approach(this.glow, target, dt, this.reduced ? 0.05 : 0.4);
  }

  // ── input ─────────────────────────────────────────────────────

  /** The choices open now: a moment's reframes (as it arrives and until it turns), or the close's pick. */
  get choiceLabels(): string[] {
    if (this.pickOpen) return this.pickSlots.map(s => this.winLabel(this.runs[s]));
    const r = this.cur;
    if (!r || r.done) return [];
    const w = this.block.what;
    const open = w === 'turn' || (w === 'arrive' && r.kind !== 'heavy');
    const labels = labelsOf(r);
    return open && labels.length > 1 ? labels : [];
  }

  /** The close's "for what most?" is open (until a pick, or quietly closed at `pickUntil` of the close for the verse). */
  get pickOpen(): boolean {
    return this.block.what === 'close' && this.pickSlots.length > 0 && this.picked < 0 && this.blockK < RULES.pickUntil;
  }

  /** Choose the i-th choice open now (a reframe, a hope, trust — or the close's pick). */
  choose(i: number): boolean {
    if (!this.started || !Number.isInteger(i) || i < 0) return false;
    if (this.pickOpen) {
      if (i >= this.pickSlots.length) return false;
      this.picked = i;
      this.emit({ type: 'picked', i });
      this.cue('turned', this.wins);
      this.talk.hush();
      return true;
    }
    const r = this.cur, n = this.choiceLabels.length;
    if (!r || i >= n) return false;
    if (r.chosen === i) return true;
    r.chosen = i;
    this.emit({ type: 'chose', slot: r.slot, i });
    return true;
  }

  key(key: string, down: boolean): boolean {
    if (!down) return false;
    if (/^[1-4]$/.test(key)) return this.choose(Number(key) - 1);
    if (key === ' ' || key === 'Enter') {
      const n = this.choiceLabels.length;
      if (!n) return false;
      if (this.pickOpen) return this.choose(0);
      const r = this.cur!;
      return this.choose(((r.chosen < 0 ? -1 : r.chosen) + 1) % n);
    }
    return false;
  }

  // ── what the runner reads ─────────────────────────────────────

  canStop(): boolean { return this.t >= this.T; }

  /** The runner's gauge: the card's glow in a push (null in the lead-in or without a signal), calm in a rest. */
  meter(): number | null {
    if (this.pushBlock) return this.reliable && (this.sighted || this.cur?.done) ? clamp(this.glow) : null;
    if (this.restBlock) return this.reliable ? clamp(this.calm) : null;
    return null;
  }

  /** The next block is near: its telegraph is up (the arrive is the turn's). */
  get telegraphed(): boolean {
    const next = this.plan.blocks[this.bi + 1];
    if (!next) return false;
    return this.left <= RULES.telegraph && (this.block.what === 'arrive' || this.dur > RULES.telegraph + 1);
  }

  get nextKind(): BlockKind | null {
    const n = this.plan.blocks[this.bi + 1];
    return n ? n.kind : null;
  }

  /** What the band asks now, in the panel's words. */
  get tip(): string {
    const r = this.cur;
    switch (this.block.what) {
      case 'intro': return t('task.intro');
      case 'arrive': return t('task.arrive');
      case 'name': return t('task.name');
      case 'turn':
        if (r?.done === 'win') return t('task.abide');
        return t(r?.kind === 'snag' ? 'task.turnSnag' : r?.kind === 'heavy' ? 'task.turnHeavy' : 'task.turnJoy');
      case 'after': return t(r?.done === 'win' ? 'task.savor' : 'task.carry');
      case 'garland': return t('task.garland');
      case 'prayer': return t('task.prayer');
      default: return this.pickOpen ? t('task.close') : t('task.end');
    }
  }

  /** The headline's second line: the run (2 and more in a row) or the part of the day. */
  get subLine(): string {
    if (this.inRow >= 2 && this.block.what !== 'garland' && this.block.what !== 'prayer' && this.block.what !== 'close') return t('sub.run', { n: this.inRow });
    return t(`part.${this.part}` as Key);
  }

  get part(): DayPart {
    const r = this.cur;
    if (r) return r.part;
    return this.block.what === 'intro' ? 'morning' : this.t >= this.plan.eveningStart ? 'evening' : partOf(this.day01);
  }

  coachWords(what: Coach, touch: boolean): string {
    if (what === 'choose') return t(touch ? 'coach.choose' : 'coach.chooseClick');
    return t(`coach.${what}` as Key);
  }

  // ── the view ──────────────────────────────────────────────────

  /** The words on a moment's gold side: the choice, the first once the turn is well on its way, '' before. */
  winLabel(r: MomentRun): string {
    const labels = labelsOf(r);
    if (r.chosen >= 0) return labels[r.chosen] ?? labels[0];
    if (labels.length === 1 || r.done === 'win' || r.p >= RULES.autoPick) return labels[0];
    return '';
  }

  get phase(): Phase {
    if (this.t >= this.T && this.started) return 'end';
    switch (this.block.what) {
      case 'intro': return 'intro';
      case 'arrive': return 'arrive';
      case 'name': return 'name';
      case 'turn': return 'turn';
      case 'after': return this.cur?.done === 'win' ? 'savor' : 'carry';
      default: return 'evening';
    }
  }

  private cardView(): CardView | null {
    const r = this.cur, w = this.block.what;
    if (!r) return null;
    let near = 1;
    if (w === 'arrive') near = this.reduced ? 1 : ease(this.blockT / Math.max(0.5, this.dur));
    else if (w === 'after' && r.done !== 'win') {
      // into the pocket
      const k = this.blockT / RULES.carrySec;
      if (k >= 1) return null;
      near = 1 - ease(k);
    }
    const trust = r.kind === 'heavy' && this.isTrust(r, r.chosen >= 0 ? r.chosen : -1);
    return { kind: r.kind, motif: r.motif, what: r.what, win: this.winLabel(r), turn: clamp(r.shown), write: clamp(r.write), near, own: r.own, trust };
  }

  private choicesView(): ChoiceView[] {
    const labels = this.choiceLabels;
    if (!labels.length) return [];
    if (this.pickOpen) return labels.map((label, i) => ({ id: `pick:${i}`, label, chosen: false, trust: false }));
    const r = this.cur!;
    const lit = r.chosen >= 0 ? r.chosen : r.p >= RULES.autoPick ? 0 : -1;
    return labels.map((label, i) => ({ id: `${r.slot}:${i}`, label, chosen: i === lit, trust: this.isTrust(r, i) }));
  }

  private get flying(): number | null {
    const r = this.cur;
    if (this.block.what !== 'after' || !r || r.done !== 'win') return null;
    const k = this.blockT / RULES.flySec;
    return k < 1 ? clamp(k) : null;
  }

  private get banner(): string | null {
    const w = this.block.what;
    if (w === 'intro') return this.blockT < 3.5 && !this.first ? t('banner.dawn') : null;
    if (this.runBanner) return t('banner.run', { n: this.runBanner.n });
    if (w === 'garland' && this.blockT >= 1.2) return t(this.wins > 0 ? 'banner.identity' : 'banner.quiet');
    if (w === 'close') return t(this.wins > 0 ? 'banner.identity' : 'banner.quiet');
    return null;
  }

  private get sayText(): string | null {
    const w = this.block.what;
    if (w === 'prayer') return t(this.blockK < 0.5 ? 'prayer.1' : 'prayer.2');
    if (this.pickOpen) return t('pick.q');
    if (w === 'close' && this.picked >= 0) return t('pick.done', { win: this.winLabel(this.runs[this.pickSlots[this.picked]]) });
    return this.talk.line?.text ?? null;
  }

  /** The street's view of this frame (B's render.ts draws it). */
  view(): PassaView {
    const flying = this.flying;
    const b = this.breath;
    return {
      phase: this.phase,
      day: this.day01,
      part: this.part,
      card: this.cardView(),
      choices: this.choicesView(),
      lights: Math.max(0, this.wins - (flying !== null ? 1 : 0)),
      flying,
      days: this.days,
      glow: clamp(this.glow),
      say: this.sayText,
      banner: this.banner,
      breath: b && (this.block.what === 'name' || this.block.what === 'after' || this.block.what === 'garland' || this.block.what === 'prayer') ? b.k : 0.5,
      carried: this.carried,
      reduced: this.reduced,
      sign: signText(this.days),
    };
  }

  // ── the session's numbers ─────────────────────────────────────

  get score(): number { return this.wins; }

  /** Moments met (their turn began). */
  get met(): number { return this.runs.filter(r => r.met).length; }

  /** The closing passage (result().verse too): after a heavy moment the passages on trials and Joseph's. */
  get closingVerse(): PassageId {
    return this.heavyMet ? inTurn(VERSES.closeHeavy, this.session) : inTurn(VERSES.close, this.session);
  }

  /** Settle the session once (the runner's finish()): the records, the streak, the cards carried, the turns. */
  finish(): void {
    if (this.credited || !this.started) return;
    this.credited = true;
    const p = this.p;
    p.sessions = this.session;
    p.best = Math.max(p.best, this.wins);
    p.wins += this.wins;
    p.bestRun = Math.max(p.bestRun, this.bestRun);
    p.trusts += this.trustWins;
    p.moments += this.met;
    creditDay(p, this.day);
    // the set cards carried (a few come back next time); a card carried before and not met this time keeps waiting
    const metSets = new Set(this.runs.filter(r => r.met && r.setId).map(r => r.setId!));
    const carriedNow = this.runs.filter(r => r.done === 'carry' && r.setId).map(r => r.setId!);
    p.carried = [...p.carried.filter(id => !metSets.has(id)), ...carriedNow].filter((id, i, a) => a.indexOf(id) === i).slice(-RULES.carryKeep);
    p.recent = [...p.recent.filter(id => !metSets.has(id)), ...metSets].slice(-RULES.recentMax);
    // the player's own moments come in turn: the next session begins after the last one met
    const ownMet = this.runs.filter(r => r.met && r.ownId && r.kind !== 'heavy').length;
    if (p.own.length) p.ownNext = (p.ownNext + ownMet) % p.own.length;
    // the heavy set's turn moves on when one of its cards was met (not a carried or an own one)
    const h = this.runs.find(r => r.kind === 'heavy' && r.met && r.setId && !r.back);
    if (h && h.setId === HEAVIES[p.heavyNext % HEAVIES.length].id) p.heavyNext = (p.heavyNext + 1) % HEAVIES.length;
  }

  result(): ArcadeOutcome {
    const stats: [string, string][] = [];
    stats.push([t('stat.wins'), t('stat.of', { n: this.wins, of: this.met })]);
    stats.push([t('stat.run'), t('stat.runV', { n: this.bestRun })]);
    stats.push([t('stat.days'), fmtNum(this.days)]);
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    stats.push([t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })]);
    const highlights: string[] = [];
    if (this.bestRun >= 3) highlights.push(t('hl.run', { n: this.bestRun }));
    if (this.days >= 2) highlights.push(t('hl.days', { n: this.days }));
    if (this.trustWins > 0) highlights.push(t('hl.trust'));
    if (this.heavyMet) highlights.push(t('hl.heavy'));
    if (this.carried > 0) highlights.push(t('hl.carried', { n: this.carried }));
    if (this.wins === 0) highlights.push(t('hl.quiet'));
    const record = this.wins > 0 && (this.bestBefore === null || this.wins > this.bestBefore);
    if (record && this.bestBefore !== null) highlights.push(t('hl.record'));
    return { score: this.wins, unit: unit(this.wins), record, stats, highlights, verse: this.closingVerse };
  }

  /** For tests and the debug view. */
  get debug(): Record<string, unknown> {
    const r = this.cur;
    return {
      block: `${this.block.kind}:${this.block.what}`, t: Math.round(this.t), blockT: Math.round(this.blockT * 10) / 10,
      moment: r ? `${r.kind}:${r.id}:${Math.round(r.p * 100)}:${r.done ?? '-'}` : '-', wins: this.wins, inRow: this.inRow, day: Math.round(this.day01 * 100) / 100,
    };
  }
}

/** The kinds a session's moments have, in order (tests and the debug view). */
export const kindsOf = (runs: readonly MomentRun[]): MomentKind[] => runs.map(r => r.kind);
