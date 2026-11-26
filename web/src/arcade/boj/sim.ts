/**
 * Dobry bój's session, without the canvas (DESIGN.md §25): the fights over the plan of rules.ts — the walk-in, the
 * rounds of exchanges (read → sequence → slow motion → resolve), the corner, the knockdowns and the count, the end —
 * what the focus drives, what the band is asked, what the coach says, the `FightView` the ring draws every frame
 * (view.ts) and the session's numbers.
 *
 * Honest neurofeedback (§18.3–18.4): the energy charges only in a sighted push past its lead-in, with a reliable
 * signal, while focused, at `focusRate`.  Taps choose the move, never charge it; the read and the corner are receptive
 * (calm restores health).  A first-ever session's first window asks half; the coach's pick glows while the player
 * learns.  Never out while lives remain: the count always ends on the feet with what was charged.
 */
import { breathAt } from '../kit/breath';
import type { FocusFrame, FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import type { Rhythm } from '../kit/rhythm';
import { passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import type { RingCue } from './audio';
import { LADDER, ROOT, foeLook, ladderOf, playerLook, verseFor, type FoeId, type Moment, type Persona } from './content';
import { t, unit, type Key } from './i18n';
import { bestOf, ladderAfter, migrate, type BojProgress } from './meta';
import {
  COMBOS, DEFENSES, DEFENSE_IDS, OPENINGS, STRIKES, answer, bestAnswers, combosFor, fit,
  type Combo, type DefenseId, type Opening, type StrikeId, type Style,
} from './moves';
import {
  BREATH, RULES, attackDamage, attackLands, counterDamage, defend, defenseSec, fightPlan, focusRate, landSec, needFor, planFor,
  readTime, strikeDamage, strikeSec, weakBackDamage, windowFits, type FightPlan, type Plan,
} from './rules';
import { Talk } from './talk';
import type { Act, FightView, FighterView, Impact, Option, Phase } from './view';

/** The sim's stages: the view's phases plus the opponent's count and a fight's result in the middle of a session. */
export type Stage = 'intro' | 'read' | 'sequence' | 'slow' | 'resolve' | 'corner' | 'count' | 'foeCount' | 'fightEnd' | 'end';
export type BlockKind = 'rest' | 'push' | 'free';
export const KIND: Readonly<Record<Stage, BlockKind>> = {
  intro: 'free', read: 'rest', sequence: 'free', slow: 'push', resolve: 'free', corner: 'rest', count: 'push', foeCount: 'free', fightEnd: 'free', end: 'free',
};
const PHASE: Readonly<Record<Stage, Phase>> = {
  intro: 'intro', read: 'read', sequence: 'sequence', slow: 'slow', resolve: 'resolve', corner: 'corner', count: 'count', foeCount: 'count', fightEnd: 'end', end: 'end',
};

/** A first-time explanation (the runner's coach mark). */
export type CoachMark = 'slow' | 'chooseIn' | 'chooseOpen' | 'count' | 'read' | 'corner';

export type FightHow = 'ko' | 'bell' | 'out';

export type SimEvent =
  | { type: 'stage'; stage: Stage }
  | { type: 'cue'; cue: RingCue; strength: number }
  | { type: 'coach'; what: CoachMark }
  | { type: 'hit'; on: 'player' | 'foe'; force: number }
  | { type: 'counter' }
  | { type: 'knockdown'; who: 'player' | 'foe' }
  | { type: 'fight'; how: FightHow }
  | { type: 'choose'; i: number };

/** A passage on the card: since when, for how long. */
export interface Card { id: PassageId; t0: number; dur: number }

export interface SimOpts {
  progress: BojProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  rhythm?: Rhythm | null;
}

/** A choice in the slow motion, with what it does. */
export interface OptSpec {
  id: string;
  kind: 'defense' | 'counter' | 'attack';
  defense?: DefenseId;
  counter?: StrikeId;
  combo?: Combo;
  /** how well it answers (moves.ts `answer`) or fits (`fit`) */
  value: number;
  right: boolean;
}

export interface Exchange {
  kind: 'in' | 'open';
  combo: Combo | null;
  key: StrikeId | null;
  opening: Opening | null;
  opts: OptSpec[];
  /** the index of the right option */
  right: number;
  chosen: number | null;
  /** the coach's pick glows */
  hint: boolean;
  /** the window (s, lead-in included) and the focus-seconds it asks */
  window: number;
  need: number;
  charge: number;
  energy: number;
  readyAt: number | null;
  /** at the release: the charge, the option that went */
  e: number;
  pick: number;
  released: boolean;
}

interface Body { hp: number; lives: number; act: Act; at: number; dur: number; fix: number | null }
interface Step { at: number; run: () => void; done: boolean }
interface ImpactRun { on: 'player' | 'foe'; target: Impact['target']; force: number; text: string; t: number }
interface RoundNote { key: StrikeId | null; opening: string | null; right: boolean; e: number }

/** A running mean over a window (quarter-second bins). */
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

const GUARD: Act = { kind: 'guard' };
/** Acts that return to the guard when they end. */
const TRANSIENT = new Set<Act['kind']>(['tell', 'strike', 'defend', 'hit', 'rise', 'touch']);
const LOOPS = new Set<Act['kind']>(['guard', 'corner']);

/** The right defences of a style, the partial ones and the wrong ones against a strike. */
function defensesFor(s: StrikeId, style: Style): { right: DefenseId[]; part: DefenseId[]; wrong: DefenseId[] } {
  const all = DEFENSE_IDS.filter(d => DEFENSES[d].styles.includes(style));
  return {
    right: bestAnswers(s, style),
    part: all.filter(d => answer(d, s) >= 0.4 && answer(d, s) < 1),
    wrong: all.filter(d => answer(d, s) < 0.4),
  };
}

const countersOf = (d: DefenseId, style: Style): StrikeId[] => DEFENSES[d].counters.filter(c => STRIKES[c].styles.includes(style));

/**
 * The options against an incoming strike: the right answer (a counter on a right defence most of the time, else the
 * plain right defence), a defence that answers it in part, and a wrong one (a counter on a wrong defence when the
 * right answer is plain, so the player reads the strike, not the button); shuffled.
 */
export function incomingOptions(key: StrikeId, style: Style, rng: () => number): { opts: OptSpec[]; right: number } {
  const pickOf = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length) % xs.length];
  const d = defensesFor(key, style);
  const dRight = pickOf(d.right);
  const cs = countersOf(dRight, style);
  const asCounter = cs.length > 0 && rng() < 0.7;
  const right: OptSpec = asCounter
    ? { id: `c.${dRight}`, kind: 'counter', defense: dRight, counter: pickOf(cs), value: 1, right: true }
    : { id: `d.${dRight}`, kind: 'defense', defense: dRight, value: 1, right: true };
  const others = [...d.part, ...d.wrong];
  const dB = d.part.length ? pickOf(d.part) : pickOf(d.wrong);
  const restC = others.filter(x => x !== dB);
  const opts: OptSpec[] = [right, { id: `d.${dB}`, kind: 'defense', defense: dB, value: answer(dB, key), right: false }];
  if (restC.length) {
    // prefer a wrong one; a counter on it when the right answer is plain
    const pool = restC.filter(x => d.wrong.includes(x));
    const dC = pickOf(pool.length ? pool : restC);
    const cc = countersOf(dC, style);
    opts.push(!asCounter && cc.length
      ? { id: `c.${dC}`, kind: 'counter', defense: dC, counter: pickOf(cc), value: answer(dC, key), right: false }
      : { id: `d.${dC}`, kind: 'defense', defense: dC, value: answer(dC, key), right: false });
  }
  return shuffled(opts, rng);
}

/** The options in an opening: the combination that fits (fit 1), one that fits in part, one that does not; shuffled. */
export function openingOptions(o: Opening, style: Style, rng: () => number): { opts: OptSpec[]; right: number } {
  const pickOf = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length) % xs.length];
  const all = combosFor(style).map(c => ({ c, f: fit(o, c.id) }));
  const best = all.filter(x => x.f >= 1);
  const part = all.filter(x => x.f >= 0.5 && x.f < 1);
  const miss = all.filter(x => x.f < 0.5);
  const r = pickOf(best);
  const b = part.length ? pickOf(part) : pickOf(miss.filter(x => x !== r));
  const c = pickOf(miss.filter(x => x !== b && x !== r));
  const picked = [r, b, c].filter((x): x is { c: Combo; f: number } => !!x);
  const opts: OptSpec[] = picked.map((x, i) => ({ id: `a.${x.c.id}`, kind: 'attack' as const, combo: x.c, value: x.f, right: i === 0 }));
  return shuffled(opts, rng);
}

function shuffled(opts: OptSpec[], rng: () => number): { opts: OptSpec[]; right: number } {
  const out = [...opts];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { opts: out, right: out.findIndex(o => o.right) };
}

/** An opponent's ring name in the player's division. */
export const foeName = (p: Persona, sex: 'ona' | 'on'): string => (p.id === 'mistrz' ? t(`foe.mistrz.${sex}` as Key) : t(`foe.${p.id}` as Key));

/** The words of an option for its button. */
export function optionWords(o: OptSpec): { label: string; sub: string } {
  if (o.kind === 'attack' && o.combo) return { label: t(`cl.${o.combo.id}` as Key), sub: t(`combo.${o.combo.id}` as Key) };
  if (o.kind === 'counter' && o.counter) return { label: t('counter', { d: t(`dshort.${o.defense}` as Key) }), sub: t(`strike.${o.counter}` as Key) };
  return { label: t(`defense.${o.defense}` as Key), sub: t(`dsub.${o.defense}` as Key) };
}

export class BojSim {
  readonly p: BojProgress;
  readonly plan: Plan;
  readonly talk: Talk;
  readonly eeg: boolean;
  readonly style: Style;
  readonly session: number;
  readonly first: boolean;
  started = false;
  stage: Stage = 'intro';
  blockT = 0;
  blockDur = 0;
  t = 0;
  /** the world's clock (slowed in the slow motion) */
  wt = 0;
  timeScale = 1;
  slow = 0;
  rate = 0;
  calm = 0;
  reliable = false;
  crowd: number = RULES.crowdBase;
  readonly player: Body;
  readonly foe: Body;
  /** the fight now: its number, the opponent, its plan, the round and its bell */
  fightNo = 0;
  persona: Persona;
  ladderNow: number;
  fight: FightPlan = { rounds: 1, len: 1, bell: 1, last: true };
  round = 0;
  roundEnd = 0;
  /** the exchange in play (sequence → slow → resolve), and the window the read leads to (null: the read runs to the bell) */
  ex: Exchange | null = null;
  private nextWindow: number | null = null;
  /** landed strikes this session (the headline), and in the fight now */
  score = 0;
  fightScore = 0;
  counters = 0;
  defenses = 0;
  defensesRight = 0;
  slows = 0;
  slowsFull = 0;
  downs = 0;
  rises = 0;
  readonly fights: { foe: FoeId; how: FightHow }[] = [];
  titlesNow = 0;
  /** the coach's pick shows after this many wrong picks in a row */
  wrongRun = 0;
  card: Card | null = null;
  banner: { text: string; t0: number; dur: number } | null = null;
  readonly impacts: ImpactRun[] = [];
  /** the runner's coach mark is up until this time (the coach waits) */
  hintUntil = 0;
  /** the gauge's pace in a push */
  private pace = 0;
  private script: Step[] = [];
  private scriptT = 0;
  private downAt: number | null = null;
  private downWho: 'player' | 'foe' | null = null;
  private finalCorner = false;
  private after: 'fight' | 'end' = 'end';
  private lastKind: 'in' | 'open' | null = null;
  private kindRun = 0;
  private lastPick = '';
  private exchanges = 0;
  private corners = 0;
  private verseK = 0;
  private roundNotes: RoundNote[] = [];
  private riseVerse = false;
  private lastResult: 'good' | 'hit' | 'wrong' | null = null;
  private lastWhy = '';
  private credited = false;
  private readonly mean = new WindowMean(RULES.meanSec);
  private readonly events: SimEvent[] = [];
  private readonly rng: () => number;
  private readonly bestBefore: number | null;

  constructor(o: SimOpts) {
    this.p = migrate(o.progress);
    this.rng = o.rng;
    this.eeg = o.eeg;
    this.style = this.p.style;
    this.session = this.p.sessions + 1;
    this.first = this.p.sessions === 0;
    this.plan = planFor({ plannedSec: o.plannedSec, eeg: o.eeg, focus: o.rhythm?.focus ?? null, rest: o.rhythm?.rest ?? null, custom: !!o.rhythm?.custom, first: this.first });
    this.talk = new Talk(o.rng);
    this.ladderNow = this.p.ladder;
    this.persona = ladderOf(this.ladderNow);
    this.bestBefore = bestOf(this.p);
    this.player = { hp: RULES.hp, lives: RULES.lives, act: GUARD, at: 0, dur: 1.2, fix: null };
    this.foe = { hp: RULES.hp, lives: RULES.lives, act: GUARD, at: 0, dur: 1.2, fix: null };
  }

  // ── the clock ─────────────────────────────────────────────────

  get T(): number { return this.plan.T; }
  get lead(): number { return this.plan.lead; }
  get kind(): BlockKind { return KIND[this.stage]; }
  /** the view's phase of the stage now */
  get phase(): Phase { return PHASE[this.stage]; }
  get pushBlock(): boolean { return this.kind === 'push'; }
  get restBlock(): boolean { return this.kind === 'rest'; }
  get sighted(): boolean { return this.pushBlock && this.blockT >= this.lead; }
  get left(): number { return Math.max(0, this.blockDur - this.blockT); }
  /** the coach's pick glows: the first sessions, or after two wrong picks in a row */
  get hintOn(): boolean { return this.session <= RULES.hint.sessions || this.wrongRun >= RULES.hint.wrongRun; }
  /** the opponent's power and chin with the ladder */
  get foePow(): number { return this.persona.power * (1 + RULES.ladderPow * this.ladderNow); }
  get foeChin(): number { return this.persona.chin * (1 - RULES.ladderChin * this.ladderNow); }
  /** the story card (a first-ever session's walk-in; the read's breath pacer stands where it was) */
  get story(): boolean { return this.first && this.fightNo === 1 && this.exchanges === 0 && this.stage === 'intro'; }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.p.lastLen = this.T;
    this.beginFight(true);
  }

  take(): SimEvent[] { return this.events.splice(0); }
  private emit(e: SimEvent): void { this.events.push(e); }
  private cue(cue: RingCue, strength = 1): void { this.emit({ type: 'cue', cue, strength: clamp(strength) }); }

  private coach(what: CoachMark): void {
    const id = `c.${what}`;
    if (this.p.seen.includes(id)) return;
    this.p.seen.push(id);
    this.emit({ type: 'coach', what });
  }

  private setStage(s: Stage, dur: number): void {
    this.stage = s;
    this.blockT = 0;
    this.blockDur = Math.max(0, dur);
    this.emit({ type: 'stage', stage: s });
  }

  private act(b: Body, act: Act, dur: number): void {
    b.act = act;
    b.at = this.wt;
    b.dur = Math.max(0.05, dur);
    b.fix = null;
  }

  private bannerOf(text: string, dur: number = RULES.bannerSec): void {
    this.banner = { text, t0: this.t, dur };
  }

  private impact(on: 'player' | 'foe', target: Impact['target'], force: number, text: string): void {
    this.impacts.push({ on, target, force: clamp(force), text, t: this.t });
    if (this.impacts.length > 8) this.impacts.shift();
  }

  private showVerse(id: PassageId, dur?: number): void {
    this.card = { id, t0: this.t, dur: dur ?? Math.max(6, readTime(passage(id).text)) };
  }

  private runScript(steps: [number, () => void][]): void {
    this.script = steps.map(([at, run]) => ({ at, run, done: false })).sort((a, b) => a.at - b.at);
    this.scriptT = 0;
  }

  private stepScript(dt: number): void {
    this.scriptT += dt;
    for (const s of this.script) {
      if (s.done || s.at > this.scriptT) continue;
      s.done = true;
      s.run();
    }
  }

  update(dt: number, f: FocusFrame, now: number): void {
    if (!this.started) return;
    const step = Math.max(0, Math.min(0.25, dt));
    this.t = now;
    this.blockT += step;
    this.reliable = f.reliable;
    if (f.reliable) this.mean.push(f.level, step);
    this.rate = this.sighted && f.reliable ? focusRate(this.mean.value ?? f.level, f.focused, f.hold) : 0;
    this.calm = approach(this.calm, f.reliable ? f.calm : 0, step, 1.5);
    // the slow motion's look: the world slows in, snaps back at the release
    const inSlow = this.stage === 'slow';
    this.timeScale = inSlow ? approach(this.timeScale, RULES.slowScale, step, RULES.slowEase / 3) : 1;
    this.slow = approach(this.slow, inSlow ? 1 : 0, step, RULES.slowEase / 3);
    this.wt += step * this.timeScale;
    this.crowd = approach(this.crowd, RULES.crowdBase, step, RULES.crowdTau);
    for (const b of [this.player, this.foe]) if (TRANSIENT.has(b.act.kind) && b.fix === null && this.wt - b.at >= b.dur) this.act(b, GUARD, 1.2);
    switch (this.stage) {
      case 'intro': this.updateIntro(step); break;
      case 'read': this.updateRead(step); break;
      case 'sequence': this.updateSequence(step); break;
      case 'slow': this.updateSlow(step); break;
      case 'resolve': this.updateResolve(step); break;
      case 'corner': this.updateCorner(step); break;
      case 'count': this.updateCount(step); break;
      case 'foeCount': this.updateFoeCount(step); break;
      case 'fightEnd': this.updateFightEnd(step); break;
      case 'end': this.stepScript(step); break;
    }
    if (this.card && this.t > this.card.t0 + this.card.dur) this.card = null;
    if (this.banner && this.t > this.banner.t0 + this.banner.dur) this.banner = null;
    while (this.impacts.length && this.t - this.impacts[0].t > RULES.impactSec) this.impacts.shift();
    const quiet = this.stage === 'sequence' || this.stage === 'slow' || this.stage === 'count';
    this.talk.update(step, this.t, quiet || this.t < this.hintUntil);
  }

  // ── a fight: the walk-in, the rounds, the bell ────────────────

  private beginFight(firstOfSession: boolean): void {
    this.fightNo++;
    this.fightScore = 0;
    this.persona = ladderOf(this.ladderNow);
    this.player.hp = RULES.hp;
    this.player.lives = RULES.lives;
    this.foe.hp = RULES.hp;
    this.foe.lives = RULES.lives;
    this.act(this.player, GUARD, 1.2);
    this.act(this.foe, GUARD, 1.2);
    const dur = firstOfSession ? this.plan.intro : this.plan.walk;
    this.setStage('intro', dur);
    this.talk.hush();
    if (firstOfSession) this.talk.ask('intro', 2, dur);
    else {
      const prev = this.fights[this.fights.length - 1];
      this.talk.ask(prev && prev.foe === this.persona.id ? 'rematch' : 'next', 2, dur);
    }
    const touch = Math.min(dur * 0.35, 2.4);
    this.runScript([
      [touch, () => { this.act(this.player, { kind: 'touch' }, 1.2); this.act(this.foe, { kind: 'touch' }, 1.2); this.cue('touch', 0.6); }],
      [Math.max(touch + 1.2, dur - 0.6), () => { this.cue('bell'); this.bannerOf(t('ban.round', { n: 1 })); }],
    ]);
  }

  private updateIntro(dt: number): void {
    this.stepScript(dt);
    if (this.blockT < this.blockDur) return;
    this.fight = fightPlan(this.plan, this.t);
    this.round = 1;
    this.roundEnd = this.roundBell();
    this.roundNotes = [];
    this.enterRead();
  }

  /** The current round's bell: the round's length from now, the fight's last bell for its last round. */
  private roundBell(): number {
    const F = this.fight;
    if (F.last) {
      const k = Math.max(1, F.rounds - this.round + 1);
      const len = (F.bell - this.t - (k - 1) * this.plan.corner) / k;
      return Math.min(this.plan.lastBell, this.t + Math.max(1, len));
    }
    return Math.min(this.plan.lastBell, this.t + F.len);
  }

  /** The bell: the corner and the next round, or the fight's end on the feet. */
  private bell(): void {
    this.cue('bell');
    if (this.round < this.fight.rounds && this.t + this.plan.corner < this.plan.lastBell - 1) {
      this.enterCorner(false);
      return;
    }
    this.endFight('bell');
  }

  // ── the read (a rest) ─────────────────────────────────────────

  private enterRead(): void {
    if (this.t >= this.T) { this.enterEnd(); return; }
    this.nextWindow = windowFits(this.plan, this.t, this.roundEnd);
    const dur = this.nextWindow === null ? Math.max(0.3, this.roundEnd - this.t) : this.plan.read;
    this.setStage('read', dur);
    this.act(this.player, this.player.act.kind === 'rise' ? this.player.act : GUARD, this.player.act.kind === 'rise' ? this.player.dur : 1.2);
    if (this.foe.act.kind !== 'rise') this.act(this.foe, GUARD, 1.2);
    // the coach: the lesson of a wrong pick, a word after a hit or a counter, else now and then the basics
    if (this.lastResult === 'wrong' && this.lastWhy) this.talk.say(this.lastWhy, 3, 4);
    else if (this.lastResult === 'hit') this.talk.ask('readHit', 2, 4);
    else if (this.lastResult === 'good') this.talk.ask('readGood', 2, 4);
    else if (this.rng() < 0.5) this.talk.ask('read', 1, 4);
    this.lastResult = null;
    if (this.riseVerse) {
      this.riseVerse = false;
      this.showVerse(verseFor('loss', this.session, this.downs - 1), Math.max(4, dur - 0.5));
    }
    this.coach('read');
  }

  private updateRead(dt: number): void {
    if (this.reliable) this.heal(this.player, RULES.readHp * this.calm * dt);
    if (this.t >= this.roundEnd - 1e-6) { this.bell(); return; }
    if (this.blockT < this.blockDur) return;
    if (this.nextWindow === null) { this.bell(); return; }
    this.beginExchange(this.nextWindow);
  }

  private heal(b: Body, hp: number): void {
    if (hp > 0) b.hp = Math.min(RULES.hp, b.hp + hp);
  }

  // ── an exchange: the sequence ─────────────────────────────────

  private pickKind(): 'in' | 'open' {
    if (this.exchanges === 0) return 'open';
    let k: 'in' | 'open' = this.rng() < this.persona.aggr ? 'in' : 'open';
    if (this.lastKind === k && this.kindRun >= RULES.sameKindMax) k = k === 'in' ? 'open' : 'in';
    return k;
  }

  private pickFrom(ids: readonly string[]): string {
    const pool = ids.length > 1 ? ids.filter(x => x !== this.lastPick) : ids;
    const id = pool[Math.floor(this.rng() * pool.length) % pool.length];
    this.lastPick = id;
    return id;
  }

  private beginExchange(window: number): void {
    const kind = this.pickKind();
    this.kindRun = this.lastKind === kind ? this.kindRun + 1 : 1;
    this.lastKind = kind;
    const st = this.style, P = this.persona;
    const firstWindow = this.first && this.exchanges === 0;
    this.exchanges++;
    const need = needFor(window, this.lead) * (firstWindow ? RULES.firstNeed : 1);
    const base = { chosen: null, hint: this.hintOn, window, need, charge: 0, energy: 0, readyAt: null, e: 0, pick: 0, released: false };
    const sp = P.speed;
    const steps: [number, () => void][] = [];
    let at = RULES.seqStep;
    if (kind === 'in') {
      const cid = this.pickFrom(P.combos[st]);
      const combo = COMBOS.find(c => c.id === cid)!;
      const key = combo.strikes[combo.key];
      const o = incomingOptions(key, st, this.rng);
      this.ex = { kind, combo, key, opening: null, ...o, ...base };
      steps.push([at, () => this.act(this.foe, { kind: 'tell', strike: combo.strikes[0] }, RULES.seqTell)]);
      at += RULES.seqTell;
      for (let i = 0; i < combo.key; i++) {
        const s = combo.strikes[i];
        const land = at + landSec(s, sp);
        steps.push([at, () => { this.act(this.foe, { kind: 'strike', strike: s, power: 0.6 }, strikeSec(s, sp)); this.cue('whoosh', 0.3); }]);
        steps.push([land, () => {
          this.act(this.player, { kind: 'defend', defense: 'block', ok: 1 }, defenseSec('block'));
          this.impact('player', STRIKES[s].target, 0, '');
          this.cue('blocked', 0.5);
        }]);
        at = land + (STRIKES[s].back * RULES.tempo * 0.5) / sp;
      }
      const S = STRIKES[key];
      steps.push([at, () => this.act(this.foe, { kind: 'tell', strike: key }, (S.load * RULES.tempo) / sp)]);
      at += ((S.load + S.travel * RULES.travel0) * RULES.tempo) / sp;
    } else {
      const oid = this.pickFrom(P.openings[st]);
      const opening = OPENINGS.find(x => x.id === oid)!;
      const o = openingOptions(opening, st, this.rng);
      this.ex = { kind, combo: null, key: null, opening, ...o, ...base };
      if (opening.tell !== 'tired' && opening.tell !== 'square') {
        const s: StrikeId = opening.tell === 'heavyLeg' ? 'teep' : 'jab';
        const s2 = STRIKES[s].styles.includes(st) ? s : 'jab';
        steps.push([at, () => { this.act(this.foe, { kind: 'strike', strike: s2, power: 0.5 }, strikeSec(s2, sp)); }]);
        steps.push([at + landSec(s2, sp), () => {
          this.act(this.player, { kind: 'defend', defense: 'block', ok: 1 }, defenseSec('block'));
          this.impact('player', STRIKES[s2].target, 0, '');
          this.cue('blocked', 0.4);
        }]);
        at += strikeSec(s2, sp) * 0.8;
      }
      steps.push([at, () => this.act(this.foe, { kind: 'open', tell: opening.tell }, RULES.openHold)]);
      at += RULES.openHold;
    }
    this.setStage('sequence', at);
    this.runScript(steps);
    this.talk.hush();
  }

  private updateSequence(dt: number): void {
    this.stepScript(dt);
    if (this.blockT < this.blockDur) return;
    this.enterSlow();
  }

  // ── the slow motion (a push) ──────────────────────────────────

  private enterSlow(): void {
    const ex = this.ex!;
    this.setStage('slow', ex.window);
    this.slows++;
    this.pace = 0;
    this.cue('slowIn');
    if (ex.kind === 'in' && ex.key) {
      // the key strike hangs in the air: its act is fixed by the travel (view())
      const S = STRIKES[ex.key];
      this.act(this.foe, { kind: 'strike', strike: ex.key, power: 1 }, strikeSec(ex.key, this.persona.speed));
      this.foe.fix = (S.load + S.travel * RULES.travel0) / (S.load + S.travel + S.back);
    }
    // the first slow motion explains itself and the choice in one mark; a first of the other kind explains its choice
    const choose: CoachMark = ex.kind === 'in' ? 'chooseIn' : 'chooseOpen';
    if (!this.p.seen.includes('c.slow')) {
      this.firstSlowKind = choose;
      this.coach('slow');
      if (!this.p.seen.includes(`c.${choose}`)) this.p.seen.push(`c.${choose}`);
    } else this.coach(choose);
  }

  /** How far the incoming strike has travelled (0..1) in the slow motion. */
  get travel(): number {
    const ex = this.ex;
    if (!ex) return 0;
    return RULES.travel0 + (RULES.travel1 - RULES.travel0) * clamp(this.blockT / Math.max(0.1, ex.window));
  }

  private updateSlow(dt: number): void {
    const ex = this.ex!;
    if (this.rate > 0 && ex.energy < 1) {
      ex.charge = Math.min(ex.need, ex.charge + this.rate * dt);
      ex.energy = clamp(ex.charge / ex.need);
    }
    const sighted = Math.max(0.5, ex.window - this.lead);
    if (this.sighted) this.pace = approach(this.pace, this.rate / (ex.need / sighted), dt, RULES.meterTau);
    if (ex.kind === 'in' && ex.key) {
      const S = STRIKES[ex.key];
      this.foe.fix = (S.load + S.travel * this.travel) / (S.load + S.travel + S.back);
    }
    if (ex.energy >= 1 && ex.readyAt === null) {
      ex.readyAt = this.blockT;
      this.cue('ready');
    }
    const go = (ex.readyAt !== null && this.blockT >= ex.readyAt + RULES.readyHold) || this.blockT >= ex.window;
    if (go) this.release();
  }

  /** A tap or a key chooses option `i` (the energy goes into it); false when no option is open. */
  choose(i: number): boolean {
    const ex = this.ex;
    if (this.stage !== 'slow' || !ex || ex.released || !(i >= 0 && i < ex.opts.length)) return false;
    ex.chosen = i;
    this.emit({ type: 'choose', i });
    this.cue('whoosh', 0.35);
    return true;
  }

  /** The option that goes with no choice made: the coach's pick while it shows, else the first. */
  get defaultPick(): number {
    const ex = this.ex;
    if (!ex) return 0;
    return ex.chosen ?? (ex.hint ? ex.right : 0);
  }

  private release(): void {
    const ex = this.ex!;
    ex.released = true;
    ex.pick = this.defaultPick;
    ex.e = ex.energy;
    if (ex.energy >= 1) this.slowsFull++;
    const o = ex.opts[ex.pick];
    const right = !!o?.right;
    this.wrongRun = right ? 0 : this.wrongRun + 1;
    this.lastWhy = this.whyOf(ex);
    this.roundNotes.push({ key: ex.key, opening: ex.opening?.id ?? null, right, e: ex.e });
    this.timeScale = 1;
    this.foe.fix = null;
    this.cue('release', ex.e);
    this.cue('slowOut');
    this.setStage('resolve', RULES.resolveMax);
    this.lastResult = right ? null : 'wrong';
    if (ex.kind === 'in') this.resolveIncoming(ex, o);
    else this.resolveAttack(ex, o);
  }

  /** The "why" of the right answer: why.<defence>.<strike>, or why.open.<opening>. */
  whyOf(ex: Exchange): string {
    const r = ex.opts[ex.right];
    if (ex.kind === 'open' && ex.opening) return t(`why.open.${ex.opening.id}` as Key);
    if (r?.defense && ex.key) return t(`why.${r.defense}.${ex.key}` as Key);
    return '';
  }

  // ── the resolve (real time) ───────────────────────────────────

  private resolveIncoming(ex: Exchange, o: OptSpec): void {
    const s = ex.key!, S = STRIKES[s], sp = this.persona.speed, pow = this.foePow;
    const d = o.defense!;
    const out = defend(d, s, ex.e, o.kind === 'counter');
    const keyLand = ((1 - this.travel) * S.travel * RULES.tempo) / sp;
    // the key strike goes on from where it hung
    const steps: [number, () => void][] = [];
    this.act(this.player, { kind: 'defend', defense: d, ok: out.save }, defenseSec(d));
    const done = (S.load + S.travel * this.travel) * RULES.tempo / sp;
    this.foe.act = { kind: 'strike', strike: s, power: 1 };
    this.foe.dur = strikeSec(s, sp);
    this.foe.at = this.wt - done;
    this.defenses++;
    if (answer(d, s) >= 1) this.defensesRight++;
    steps.push([keyLand, () => {
      const dmg = strikeDamage(s, pow, out.save);
      if (dmg >= 1) this.hurt('player', s, dmg, 1 - out.save);
      else {
        this.impact('player', S.target, 0, t('fl.def', { d: t(`defense.${d}` as Key) }));
        this.cue(d === 'slip' || d === 'roll' || d === 'step' || d === 'sprawl' ? 'slip' : 'blocked', 0.8);
        this.crowd = Math.min(1, this.crowd + 0.08);
      }
    }]);
    let end = keyLand + 0.6;
    if (out.counter && o.counter) {
      const c = o.counter, at = keyLand + 0.12, land = at + landSec(c);
      steps.push([at, () => this.act(this.player, { kind: 'strike', strike: c, power: 1 }, strikeSec(c))]);
      steps.push([land, () => {
        const dmg = counterDamage(c, this.foeChin);
        this.foe.hp = Math.max(0, this.foe.hp - dmg);
        this.act(this.foe, { kind: 'hit', target: STRIKES[c].target, force: 0.9 }, 0.5);
        this.impact('foe', STRIKES[c].target, 0.9, t('fl.counter'));
        this.score++;
        this.fightScore++;
        this.counters++;
        this.crowd = Math.min(1, this.crowd + 0.25);
        this.cue(cueOf(c), 0.9);
        this.cue('crowd', 0.7);
        this.emit({ type: 'counter' });
        this.emit({ type: 'hit', on: 'foe', force: 0.9 });
        this.lastResult = 'good';
        if (this.foe.hp <= 0) this.markDown('foe', land);
      }]);
      end = land + 0.7;
    } else {
      let at = keyLand + 0.2;
      for (const f of ex.combo!.strikes.slice(ex.combo!.key + 1)) {
        const land = at + landSec(f, sp);
        steps.push([at, () => this.act(this.foe, { kind: 'strike', strike: f, power: 0.7 }, strikeSec(f, sp))]);
        steps.push([land, () => {
          const dmg = strikeDamage(f, pow, out.save, RULES.followShare);
          if (dmg >= 1) this.hurt('player', f, dmg, 0.5 * (1 - out.save));
          else {
            this.act(this.player, { kind: 'defend', defense: 'block', ok: 1 }, defenseSec('block'));
            this.impact('player', STRIKES[f].target, 0, '');
            this.cue('blocked', 0.4);
          }
        }]);
        at = land + (STRIKES[f].back * RULES.tempo * 0.6) / sp;
        end = land + 0.6;
      }
    }
    this.blockDur = Math.min(RULES.resolveMax, Math.max(1.4, end));
    this.runScript(steps);
  }

  private resolveAttack(ex: Exchange, o: OptSpec): void {
    const c = o.combo!, e = ex.e, chin = this.foeChin;
    const lands = attackLands(c.strikes.length, o.value, e);
    const steps: [number, () => void][] = [];
    let at = 0.1, end = 0.8;
    c.strikes.forEach((s, i) => {
      const land = at + landSec(s);
      steps.push([at, () => this.act(this.player, { kind: 'strike', strike: s, power: e }, strikeSec(s))]);
      steps.push([land, () => {
        if (this.downWho) return;
        if (lands[i]) {
          const dmg = attackDamage(s, o.value, e, chin);
          this.foe.hp = Math.max(0, this.foe.hp - dmg);
          const force = 0.35 + 0.55 * e;
          this.act(this.foe, { kind: 'hit', target: STRIKES[s].target, force }, 0.45);
          this.impact('foe', STRIKES[s].target, force, t('fl.dmg', { n: dmg }));
          this.score++;
          this.fightScore++;
          this.crowd = Math.min(1, this.crowd + 0.07);
          this.cue(cueOf(s), force);
          this.emit({ type: 'hit', on: 'foe', force });
          if (i >= 2 && this.lastResult === null) this.lastResult = 'good';
          if (this.foe.hp <= 0) this.markDown('foe', land);
        } else {
          this.act(this.foe, { kind: 'defend', defense: 'block', ok: 1 }, defenseSec('block'));
          this.impact('foe', STRIKES[s].target, 0, '');
          this.cue('blocked', 0.5);
        }
      }]);
      at = land + (STRIKES[s].back * RULES.tempo) * 0.55;
      end = land + 0.55;
    });
    if (!lands.some(Boolean)) {
      // nothing landed: the guard took it all, and a soft counter comes back
      const s: StrikeId = 'cross', sp = this.persona.speed;
      const land = end + landSec(s, sp);
      steps.push([end, () => this.act(this.foe, { kind: 'strike', strike: s, power: 0.6 }, strikeSec(s, sp))]);
      steps.push([land, () => this.hurt('player', s, weakBackDamage(this.foePow, e), 0.4)]);
      end = land + 0.5;
    }
    this.blockDur = Math.min(RULES.resolveMax, Math.max(1.4, end));
    this.runScript(steps);
  }

  /** The player takes a hit of `dmg` from strike `s`. */
  private hurt(on: 'player', s: StrikeId, dmg: number, force: number): void {
    const b = this.player;
    b.hp = Math.max(0, b.hp - dmg);
    this.act(b, { kind: 'hit', target: STRIKES[s].target, force: clamp(force) }, 0.45);
    this.impact(on, STRIKES[s].target, clamp(force), t('fl.dmg', { n: dmg }));
    this.cue(cueOf(s), clamp(force));
    this.emit({ type: 'hit', on, force: clamp(force) });
    if (this.lastResult !== 'wrong') this.lastResult = 'hit';
    if (b.hp <= 0) this.markDown('player', this.scriptT);
  }

  private markDown(who: 'player' | 'foe', at: number): void {
    if (this.downWho) return;
    this.downWho = who;
    this.downAt = at + 0.35;
    // what was left of the script does not come
    for (const s of this.script) if (s.at > at + 1e-6) s.done = true;
  }

  private updateResolve(dt: number): void {
    this.stepScript(dt);
    if (this.downWho && this.downAt !== null && this.scriptT >= this.downAt) {
      const who = this.downWho;
      this.downWho = null;
      this.downAt = null;
      this.ex = null;
      if (who === 'player') this.knockdown();
      else this.foeKnockdown();
      return;
    }
    if (this.blockT < this.blockDur) return;
    this.ex = null;
    if (this.t >= this.roundEnd - 0.5) this.bell();
    else this.enterRead();
  }

  // ── knockdowns and the count ──────────────────────────────────

  private knockdown(): void {
    this.player.lives = Math.max(0, this.player.lives - 1);
    this.downs++;
    this.act(this.player, { kind: 'down' }, 1);
    this.act(this.foe, GUARD, 1.2);
    this.cue('down');
    this.emit({ type: 'knockdown', who: 'player' });
    if (this.player.lives <= 0) {
      this.endFight('out');
      return;
    }
    this.setStage('count', this.plan.count);
    this.ex = {
      kind: 'in', combo: null, key: null, opening: null, opts: [], right: 0, chosen: null, hint: false, window: this.plan.count,
      need: needFor(this.plan.count, this.lead) * RULES.count.need, charge: 0, energy: 0, readyAt: null, e: 0, pick: 0, released: false,
    };
    this.pace = 0;
    this.talk.hush();
    this.talk.ask('down', 3, 4);
    this.coach('count');
  }

  /** The referee's count now (1..10 for the player, 1..8 for the opponent), or null. */
  get countNow(): number | null {
    if (this.stage === 'count') return Math.min(10, 1 + Math.floor((10 * this.blockT) / Math.max(1, this.blockDur)));
    if (this.stage === 'foeCount') return Math.min(8, 1 + Math.floor((8 * this.blockT) / Math.max(1, this.blockDur)));
    return null;
  }

  private lastCount = 0;
  /** the kind of the first slow motion, whose mark also explains the choice */
  private firstSlowKind: 'chooseIn' | 'chooseOpen' | null = null;

  private updateCount(dt: number): void {
    const ex = this.ex!;
    if (this.rate > 0 && ex.energy < 1) {
      ex.charge = Math.min(ex.need, ex.charge + this.rate * dt);
      ex.energy = clamp(ex.charge / ex.need);
    }
    const sighted = Math.max(0.5, this.blockDur - this.lead);
    if (this.sighted) this.pace = approach(this.pace, this.rate / (ex.need / sighted), dt, RULES.meterTau);
    const n = this.countNow ?? 0;
    if (n !== this.lastCount) {
      this.lastCount = n;
      this.cue('count', 0.6);
    }
    const C = RULES.count;
    if (ex.energy >= 1) this.rise(C.fullHp);
    else if (this.blockT >= this.blockDur) this.rise(C.lowHp + C.plusHp * ex.energy);
  }

  private rise(hp: number): void {
    this.rises++;
    this.player.hp = Math.max(1, Math.round(RULES.hp * clamp(hp)));
    this.act(this.player, { kind: 'rise' }, 1.2);
    this.impact('player', 'body', 0, t('fl.up'));
    this.cue('rise');
    this.cue('crowd', 0.6);
    this.crowd = Math.min(1, this.crowd + 0.2);
    this.ex = null;
    this.lastCount = 0;
    this.talk.ask('rise', 2, 4);
    this.riseVerse = true;
    this.lastResult = null;
    if (this.t >= this.roundEnd - 0.5) this.bell();
    else this.enterRead();
  }

  private foeKnockdown(): void {
    this.foe.lives = Math.max(0, this.foe.lives - 1);
    this.act(this.foe, { kind: 'down' }, 1);
    this.act(this.player, GUARD, 1.2);
    this.cue('down');
    this.cue('crowd', 1);
    this.crowd = 1;
    this.emit({ type: 'knockdown', who: 'foe' });
    if (this.foe.lives <= 0) {
      this.endFight('ko');
      return;
    }
    this.bannerOf(t('ban.knockdown'));
    this.setStage('foeCount', this.plan.foeCount);
    this.talk.hush();
    this.talk.ask('foeDown', 2, 4);
  }

  private updateFoeCount(_dt: number): void {
    const n = this.countNow ?? 0;
    if (n !== this.lastCount) {
      this.lastCount = n;
      this.cue('count', 0.5);
    }
    if (this.blockT < this.blockDur) return;
    this.lastCount = 0;
    this.foe.hp = Math.round(RULES.hp * RULES.foeCount.hp);
    this.act(this.foe, { kind: 'rise' }, 1.2);
    this.cue('rise', 0.6);
    if (this.t >= this.roundEnd - 0.5) this.bell();
    else this.enterRead();
  }

  // ── the corner ────────────────────────────────────────────────

  /** The corner between rounds, or (`final`) the rest before the session's end. */
  private enterCorner(final: boolean, dur = this.plan.corner): void {
    this.finalCorner = final;
    this.setStage('corner', dur);
    this.act(this.player, { kind: 'corner' }, 2.4);
    this.act(this.foe, { kind: 'corner' }, 2.4);
    this.talk.hush();
    if (!final) {
      this.corners++;
      this.talk.ask(this.cornerNote(), 2, Math.max(4, dur - 2));
      if (this.corners % 2 === 1 || this.plan.cornerBreaths >= 4) this.showVerse(verseFor('corner', this.session, this.verseK++), Math.max(5, dur * 0.55));
    }
    this.coach('corner');
  }

  /** The coach's one technical note from the round: what was answered wrong most, a low charge, or praise. */
  cornerNote(): Moment {
    const notes = this.roundNotes;
    this.roundNotes = [];
    if (!notes.length) return 'corner';
    const wrong = notes.filter(n => !n.right);
    const lowE = notes.reduce((a, n) => a + n.e, 0) / notes.length < 0.6;
    if (!wrong.length) return lowE ? 'cornerFocus' : this.rng() < 0.5 ? 'cornerGood' : 'corner';
    const tally = new Map<Moment, number>();
    for (const n of wrong) {
      const m: Moment = n.opening ? 'cornerOpen'
        : n.key === 'hookL' || n.key === 'hookR' || n.key === 'overhand' ? 'cornerHooks'
        : n.key === 'upperL' || n.key === 'upperR' ? 'cornerUpper'
        : n.key === 'takedown' ? 'cornerShot'
        : n.key === 'lowKick' || n.key === 'bodyKick' || n.key === 'headKick' || n.key === 'knee' || n.key === 'teep' ? 'cornerKicks'
        : 'cornerStraight';
      tally.set(m, (tally.get(m) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  private updateCorner(dt: number): void {
    const R = RULES;
    this.heal(this.player, R.cornerHp * (R.cornerBase + (1 - R.cornerBase) * (this.reliable ? this.calm : 0)) * dt);
    if (this.plan.corner > 0) this.heal(this.foe, (R.foeCornerHp * dt) / this.plan.corner);
    if (this.blockT < this.blockDur) return;
    if (this.finalCorner) { this.enterEnd(); return; }
    if (this.after === 'fight' && this.stage === 'corner' && this.round === 0) { this.beginFight(false); return; }
    // the next round
    this.round++;
    this.roundEnd = this.roundBell();
    this.cue('bell');
    const last = this.round === this.fight.rounds;
    this.bannerOf(last && this.fight.rounds > 1 ? t('ban.final') : t('ban.round', { n: this.round }));
    this.talk.ask(last && this.fight.rounds > 1 ? 'final' : 'round', 2, 5);
    this.enterRead();
  }

  // ── the end of a fight, of the session ────────────────────────

  private endFight(how: FightHow): void {
    const won = how !== 'out';
    const P = this.persona;
    this.fights.push({ foe: P.id, how });
    // the ladder moves on after a knockout, or a win at the bell with strikes of the player's own
    const earned = how === 'ko' || (how === 'bell' && this.fightScore >= RULES.ladderBellMin);
    if (earned && P.id === LADDER[LADDER.length - 1].id) this.titlesNow++;
    this.ladderNow = ladderAfter(this.ladderNow, earned);
    this.emit({ type: 'fight', how });
    this.ex = null;
    this.downWho = null;
    this.downAt = null;
    this.talk.hush();
    this.talk.ask(how === 'ko' ? 'winKo' : won ? 'win' : 'loss', 3, 8);
    const ban = how === 'ko' ? t('ban.ko') : how === 'bell' ? t('ban.survive') : t('ban.loss');
    this.cue(how === 'ko' ? 'ko' : won ? 'win' : 'lose');
    if (won) this.cue('crowd', 1);
    this.crowd = won ? 1 : 0.4;
    const steps: [number, () => void][] = [];
    if (how === 'ko') {
      this.act(this.foe, { kind: 'out' }, 1.6);
      steps.push([0.4, () => this.act(this.player, { kind: 'cheer' }, 1.5)]);
      steps.push([2.6, () => { this.act(this.player, { kind: 'embrace' }, 2); this.act(this.foe, { kind: 'embrace' }, 2); }]);
    } else if (how === 'bell') {
      this.act(this.player, { kind: 'embrace' }, 2);
      this.act(this.foe, { kind: 'embrace' }, 2);
      steps.push([2.4, () => this.act(this.player, { kind: 'cheer' }, 1.5)]);
      steps.push([2.4, () => this.act(this.foe, GUARD, 1.2)]);
    } else {
      this.act(this.player, { kind: 'out' }, 1.6);
      steps.push([2.6, () => { this.act(this.player, { kind: 'embrace' }, 2); this.act(this.foe, { kind: 'embrace' }, 2); }]);
    }
    const verse = verseFor(won ? 'win' : 'loss', this.session, this.fights.length - 1);
    const P2 = this.plan, left = P2.lastBell - this.t;
    const another = !P2.test && left >= P2.fightEnd + P2.corner + P2.walk + RULES.nextFightMin;
    if (another) {
      this.after = 'fight';
      this.bannerOf(ban, P2.fightEnd);
      this.setStage('fightEnd', P2.fightEnd);
      this.showVerse(verse, P2.fightEnd);
    } else if (left > P2.fightEnd + 1) {
      // an early end near the session's end: the result, the corner in whole breaths, the end
      this.after = 'end';
      this.bannerOf(ban, P2.fightEnd);
      this.setStage('fightEnd', P2.fightEnd);
      this.showVerse(verse, P2.fightEnd);
    } else {
      this.after = 'end';
      this.bannerOf(ban, Math.max(3, this.T - this.t));
      this.setStage('end', Math.max(0, this.T - this.t));
      this.showVerse(verse, Math.max(4, this.T - this.t));
    }
    this.runScript(steps);
  }

  private updateFightEnd(dt: number): void {
    this.stepScript(dt);
    if (this.blockT < this.blockDur) return;
    if (this.after === 'fight') {
      // the corner, then the walk-in of the next fight
      this.round = 0;
      this.enterCorner(false, this.plan.corner);
      return;
    }
    const breaths = Math.floor(Math.max(0, this.plan.lastBell - this.t) / this.plan.cyc);
    if (breaths >= 1) this.enterCorner(true, breaths * this.plan.cyc);
    else this.enterEnd();
  }

  private enterEnd(): void {
    if (this.stage === 'end') return;
    const dur = Math.max(0, this.T - this.t);
    this.setStage('end', dur);
    this.act(this.player, GUARD, 1.2);
    this.act(this.foe, GUARD, 1.2);
    const last = this.fights[this.fights.length - 1];
    if (last) this.showVerse(verseFor(last.how === 'out' ? 'loss' : 'win', this.session, this.fights.length), Math.max(4, dur));
    else this.showVerse(ROOT, Math.max(4, dur));
  }

  // ── input ─────────────────────────────────────────────────────

  /** Keys: 1/2/3 and ←/↓/→ choose; Space and Enter the coach's pick (or the first). */
  key(key: string, down: boolean): boolean {
    if (!down || this.stage !== 'slow' || !this.ex) return false;
    const map: Record<string, number> = { '1': 0, '2': 1, '3': 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2 };
    if (key in map) return this.choose(map[key]);
    if (key === ' ' || key === 'Enter') return this.choose(this.ex.hint ? this.ex.right : this.ex.chosen ?? 0);
    return false;
  }

  // ── what the runner reads ─────────────────────────────────────

  canStop(): boolean {
    if (this.t < this.T) return false;
    return this.stage === 'end' || this.stage === 'read' || this.stage === 'corner' || this.stage === 'fightEnd' || this.stage === 'intro';
  }

  /** The runner's gauge: the pace of the charge in a push (0.5 = on course to fill at the window's end), calm in a rest. */
  meter(): number | null {
    if (this.pushBlock) return this.reliable && this.sighted ? clamp(0.5 * this.pace) : null;
    if (this.restBlock) return this.reliable ? clamp(this.calm) : null;
    return null;
  }

  /** The next block during its telegraph: the read's last seconds and the sequence lead to the slow motion. */
  get nextKind(): BlockKind | null {
    if (this.stage === 'sequence') return 'push';
    if (this.stage === 'read' && this.nextWindow !== null && this.left <= RULES.telegraph) return 'push';
    return null;
  }

  /** What the band asks now, in the panel's words. */
  get tip(): string {
    const ex = this.ex;
    if (this.stage === 'slow' && ex) {
      if (ex.readyAt !== null) return t('task.ready');
      // what comes, or what opens: the slow motion names it (the strike as the coach calls it)
      if (this.blockT < this.lead && ex.key) return t('task.slowIn', { s: t(`strike.${ex.key}` as Key) });
      if (this.blockT < this.lead && ex.opening) return t('task.slowOpen', { o: t(`opening.${ex.opening.id}` as Key) });
    }
    if (this.stage === 'fightEnd') return t('task.end');
    return t(`task.${this.stage}` as Key);
  }

  /** The headline's second line. */
  get subLine(): string {
    if (this.stage === 'corner') return t('sub.corner');
    if (this.stage === 'count' || this.stage === 'foeCount') return t('sub.count');
    if (this.stage === 'fightEnd' || this.stage === 'end') return t('sub.end');
    if (this.stage === 'intro' || this.round === 0) return t('sub.intro');
    const n = this.fight.rounds;
    return this.fightNo > 1 ? t('sub.fightRound', { f: this.fightNo, r: this.round, n }) : t('sub.round', { r: this.round, n });
  }

  coachWords(what: CoachMark, touch: boolean): string {
    const hand = touch ? 'tap' : 'click';
    if (what === 'chooseIn' || what === 'chooseOpen') return t(`c.${what}.${hand}` as Key);
    if (what === 'slow' && this.firstSlowKind) return `${t('c.slow')} ${t(`c.${this.firstSlowKind}.${hand}` as Key)}`;
    return t(`c.${what}` as Key);
  }

  /** The breath of a rest (from its start), else null. */
  get breath() { return this.restBlock ? breathAt(BREATH, this.blockT) : null; }

  // ── the view ──────────────────────────────────────────────────

  private fighter(b: Body, look: FighterView['look'], name: string): FighterView {
    const span = Math.max(0.05, b.dur);
    const raw = (this.wt - b.at) / span;
    const t0 = b.fix !== null ? b.fix : LOOPS.has(b.act.kind) ? ((raw % 1) + 1) % 1 : clamp(raw);
    return { look, act: b.act, t: t0, dur: b.dur, hp: clamp(b.hp / RULES.hp), lives: b.lives, maxLives: RULES.lives, name };
  }

  /** The `FightView` of this frame (view.ts): everything the ring draws, in the page's language. */
  view(reduced: boolean): FightView {
    const ex = this.ex, sex = this.p.sex;
    const inSlow = this.stage === 'slow' && !!ex && !ex.released;
    const options: Option[] = inSlow ? ex!.opts.map((o, i) => {
      const w = optionWords(o);
      return { id: o.id, kind: o.kind, label: w.label, sub: w.sub, chosen: ex!.chosen === i, hint: ex!.hint && i === ex!.right };
    }) : [];
    let why: string | null = null;
    if (inSlow && ex!.hint) why = this.whyOf(ex!) || null;
    else if (this.stage === 'resolve' && ex && ex.released && !ex.opts[ex.pick]?.right) why = this.lastWhy || null;
    const charging = this.stage === 'slow' || this.stage === 'count';
    const energy = charging && ex ? ex.energy : 0;
    const showCoach = this.stage === 'intro' || this.stage === 'read' || this.stage === 'corner' || this.stage === 'foeCount' || this.stage === 'fightEnd' || this.stage === 'end' || this.stage === 'resolve';
    return {
      style: this.style,
      phase: PHASE[this.stage],
      timeScale: this.timeScale,
      slow: this.slow,
      player: this.fighter(this.player, playerLook(sex, this.p.skin, this.p.hair), t('you')),
      foe: this.fighter(this.foe, foeLook(this.persona, sex), foeName(this.persona, sex)),
      round: Math.max(1, this.round),
      rounds: this.fight.rounds,
      energy,
      ready: charging && energy >= 1,
      left: inSlow ? Math.max(0, ex!.window - this.blockT) : null,
      incoming: inSlow && ex!.kind === 'in' && ex!.key ? { strike: ex!.key, travel: this.travel } : null,
      options,
      impacts: this.impacts.map(i => ({ on: i.on, target: i.target, force: i.force, text: i.text, age: Math.max(0, this.t - i.t) })),
      count: this.countNow,
      banner: this.banner ? { text: this.banner.text, age: Math.max(0, this.t - this.banner.t0) } : null,
      coach: showCoach ? this.talk.line?.text ?? null : null,
      why,
      crowd: clamp(this.crowd),
      breath: this.breath?.k ?? 0.5,
      reduced,
    };
  }

  // ── the session's end ─────────────────────────────────────────

  /** Fights won and lost, knockouts given, this session. */
  get tally(): { won: number; lost: number; kos: number } {
    let won = 0, lost = 0, kos = 0;
    for (const f of this.fights) {
      if (f.how === 'out') lost++;
      else won++;
      if (f.how === 'ko') kos++;
    }
    return { won, lost, kos };
  }

  /** Settle the session once (the runner's finish()): the records, the ladder. */
  finish(): void {
    if (this.credited || !this.started) return;
    this.credited = true;
    const p = this.p, tl = this.tally;
    p.sessions = this.session;
    p.best = Math.max(p.best, this.score);
    p.strikes += this.score;
    p.counters += this.counters;
    p.fights += tl.won + tl.lost;
    p.wins += tl.won;
    p.kos += tl.kos;
    p.titles += this.titlesNow;
    p.ladder = this.ladderNow;
  }

  /** The closing passage: after a win, after a loss, or the root. */
  get closingVerse(): PassageId {
    const last = this.fights[this.fights.length - 1];
    if (!last) return ROOT;
    return verseFor(last.how === 'out' ? 'loss' : 'win', this.session);
  }

  result(): ArcadeOutcome {
    const tl = this.tally, sex = this.p.sex;
    const stats: [string, string][] = [];
    stats.push([t('stat.record'), t('stat.recordV', { w: tl.won, l: tl.lost })]);
    if (tl.kos > 0) stats.push([t('stat.ko'), String(tl.kos)]);
    stats.push([t('stat.counters'), String(this.counters)]);
    if (this.defenses > 0) stats.push([t('stat.defense'), t('stat.ofV', { ok: this.defensesRight, n: this.defenses })]);
    if (this.slows > 0) stats.push([t('stat.charge'), t('stat.ofV', { ok: this.slowsFull, n: this.slows })]);
    if (this.downs > 0) stats.push([t('stat.down'), `${this.downs} (${this.rises})`]);
    const highlights: string[] = [];
    for (const f of this.fights) {
      const name = foeName(LADDER.find(x => x.id === f.foe) ?? this.persona, sex);
      highlights.push(t(f.how === 'ko' ? 'hl.ko' : f.how === 'bell' ? 'hl.survive' : 'hl.loss', { name }));
    }
    if (this.titlesNow > 0) highlights.push(t('hl.title'));
    if (this.rises > 0) highlights.push(t('hl.rose', { n: this.rises }));
    if (this.counters >= 3) highlights.push(t('hl.counters', { n: this.counters }));
    const record = this.score > 0 && (this.bestBefore === null || this.score > this.bestBefore);
    if (record && this.bestBefore !== null) highlights.push(t('hl.record'));
    if (this.fights.length) highlights.push(t('hl.next', { name: foeName(ladderOf(this.ladderNow), sex) }));
    return { score: this.score, unit: unit(this.score), record, stats, highlights, verse: this.closingVerse };
  }

  /** For tests and the debug view. */
  get debug(): Record<string, unknown> {
    return {
      stage: this.stage, t: Math.round(this.t), blockT: Math.round(this.blockT * 10) / 10, fight: this.fightNo, foe: this.persona.id,
      round: `${this.round}/${this.fight.rounds}`, hp: Math.round(this.player.hp), lives: this.player.lives, foeHp: Math.round(this.foe.hp),
      foeLives: this.foe.lives, score: this.score, energy: Math.round((this.ex?.energy ?? 0) * 100), fights: this.fights.map(f => f.how).join(','),
    };
  }
}

/** The ring's sound for a strike that lands. */
function cueOf(s: StrikeId): RingCue {
  if (s === 'takedown') return 'takedown';
  if (s === 'jab') return 'jab';
  const S = STRIKES[s];
  if (S.limb === 'leadLeg' || S.limb === 'rearLeg') return 'kick';
  return S.target === 'body' ? 'body' : 'punch';
}
