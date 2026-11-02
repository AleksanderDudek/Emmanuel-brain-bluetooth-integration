/**
 * Zastępy's session, without the DOM or the canvas (so every rule is unit-tested): the battles one
 * after another on the road (battle.ts), the short card between them, the blocks, what the band
 * changes, the meta (meta.ts) and the session's numbers.  All numbers are in rules.ts.
 *
 * The hands send the host: a tap on a card (or 1–6, Space = the cheapest ready card) sends that unit
 * out of the gate of light; the trumpet sounds with a tap on it or T.  The band only adds:
 *   Natarcie (push)   after a lead-in, `level` above the threshold speeds the flow of light (up to
 *                     ×2.2 at the top, never below the base flow); a held focus (5 s Mendi / 3 s HALO)
 *                     charges the trumpet, which waits, full, for a tap.
 *   Cisza (rest)      the demons' waves come slower and walk slower (for everyone); after a lead-in
 *                     calm mends the walls and lays shields of light on the front line; a passed
 *                     Cisza mends the walls at once and pays gold.
 *   Mgła bitewna      every 4th Natarcie from the 3rd session: the extra light is not shown and not
 *   (blind)           paid while it runs; at its end the block's judged share is paid at once.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the flow stays at its base and calm mends nothing; the block clock runs on.
 *
 * The headline is the demons beaten this session, live: the first wave is a single imp, and the
 * gate's beam strikes too.
 */
import { mulberry32 } from '../../core/random';
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome } from '../kit/types';
import { Battle, type BattleEvent, type Control } from './battle';
import { HOST_NAME, TIPS } from './content';
import { demons as demonsText, gold as goldText, t, unit } from './i18n';
import {
  bestFor, buyGate, buyUnit, cardsAt, circleOf, gateLevel, gatePrice, isSmok, lenKey, unitLevel, unitPrice, type ZastepyProgress,
} from './meta';
import { HOST, HOST_IDS, RULES, type HostId } from './rules';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';
/** Fighting, the gate of ash fallen, the host withdrawing, the short card of upgrades between battles. */
export type Stage = 'battle' | 'won' | 'lost' | 'upgrade';

/** An upgrade on the card between battles: the gate or a unit, its next level and price. */
export interface Offer { what: 'gate' | HostId; level: number; price: number; can: boolean }

export type SimEvent =
  | BattleEvent
  | { type: 'battleStart'; battle: number; smok: boolean; retry: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  /** the judged window's share on the asked side and the share it needed; the block's span of play time; light paid at its end */
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; t0: number; t1: number; light: number }
  | { type: 'trumpetReady' }
  | { type: 'nope'; id: HostId }
  | { type: 'buy'; what: 'gate' | HostId; level: number }
  | { type: 'restPass'; gold: number }
  | { type: 'blindPay'; light: number; share: number }
  | { type: 'winGold'; gold: number }
  | { type: 'gift'; gold: number }
  | { type: 'finale' };

const NO_EVENTS: readonly SimEvent[] = [];
const BATTLE_SALT = 0x5be0cd19;

// ── pure rules ───────────────────────────────────────────────────
/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks.  A first-ever session opens with the warm-up "Pierwszy zastęp" (30 s in 5 and
 * 10 min, 20 s in 3, 6 s in a 40 s test); then Natarcie / Cisza pairs (24 ± 4 s and 23 ± 3 s, scaled
 * to end on time, jittered only when there is room) ending with a Cisza, leaving the last 6 s to the
 * finale.  No block under 12 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * R.minBlock, plannedSec - R.finale);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(2 * R.minBlock, left - warm);
      return [b('warmup', warm), b('push', rest / 2), b('rest', rest / 2)];
    }
    const rest = Math.max(R.minBlock, Math.min(14, left / 2));
    return [b('push', left - rest), b('rest', rest)];
  }
  const plan: Block[] = [];
  let left = plannedSec - R.finale;
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

/** The flow's multiplier for a level: ×1 up to the threshold (never below), rising to ×flowTop at the top. */
export const flowMult = (level: number): number => 1 + (RULES.flowTop - 1) * clamp((level - 0.5) / 0.5);

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: ZastepyProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

export class ZastepySim {
  readonly p: ZastepyProgress;
  readonly plannedSec: number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  /** the band's last 40 s, drawn as the banners along the road */
  readonly trace = new SignalTrace(40, 0.1);
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly trumpetNeed: number;
  private readonly calmLead: number;

  started = false;
  readonly session: number;
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  t = 0;
  tip = '';
  hint = false;
  private lastSend = 0;

  // the battle
  battle: Battle;
  stage: Stage = 'battle';
  stageT = 0;
  /** withdrawals in this battle so far (each makes the walls stronger for the next try) */
  retreats = 0;
  private readonly seedBase: number;
  offers: Offer[] = [];
  private extended = false;

  // the band
  reliable = false;
  /** the latest level and calm (for the gauge) */
  level = 0;
  calm = 0;
  /** the flow's multiplier now (shown and paid), and the one the level asks for (hidden in a blind block) */
  mult = 1;
  wantMult = 1;
  /** calm working on the walls now (0 outside a sighted Cisza past its lead-in) */
  calmNow = 0;
  /** the trumpet's charge 0..1 (full: ready for a tap) */
  charge = 0;
  private relSec = 0;

  // the session's numbers
  score = 0;
  goldNow = 0;
  wonNow = 0;
  lostNow = 0;
  smokNow = 0;
  trumpetsNow = 0;
  comeback = false;
  passedRests = 0;
  gateBought = 0;
  unitsBought = 0;
  blindShare = -1;
  sentNow = 0;
  private giftNow = 0;
  private settled = false;
  private readonly callsBase: number;
  private callsBegun = 0;
  private readonly bestBefore: number | null;

  constructor(private readonly init: SimInit) {
    const p = (this.p = init.progress);
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.trumpetNeed = RULES.trumpetHold[band];
    this.calmLead = RULES.calmLead[band];
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.callsBase = p.calls;
    this.seedBase = Math.floor(init.rng() * 2 ** 32) >>> 0;
    this.plan = planBlocks(init.plannedSec, this.session === 1, mulberry32((init.daySeed ^ BATTLE_SALT) >>> 0));
    this.battle = this.newBattle();
  }

  private newBattle(): Battle {
    return new Battle({ battle: this.p.battle, gate: gateLevel(this.p), units: this.levels(), retreats: this.retreats, seed: (this.seedBase + this.retreats * 7919) >>> 0 });
  }

  private levels(): Record<HostId, number> {
    return Object.fromEntries(HOST_IDS.map(id => [id, unitLevel(this.p, id)])) as Record<HostId, number>;
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.phase === 'play'; }
  /** a sighted Natarcie past its lead-in: the flow answers the band */
  get sighted(): boolean { return this.block?.kind === 'push' && !this.block.blind && this.blockT >= this.lead && this.phase === 'play'; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.phase === 'play'; }
  get leadIn(): number { return this.lead; }
  get trumpetSec(): number { return this.trumpetNeed; }
  get ready(): boolean { return this.charge >= 1; }
  get cards(): HostId[] { return cardsAt(gateLevel(this.p)); }
  get circle(): number { return circleOf(this.p.battle).circle; }
  get local(): number { return circleOf(this.p.battle).local; }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startBlock(0);
    this.emit({ type: 'battleStart', battle: this.p.battle, smok: isSmok(this.p.battle), retry: 0 });
  }

  // ── the hands ───────────────────────────────────────────────────
  /** Send a unit out of the gate (a card's tap, keys 1–6); a card not ready answers with a shake. */
  send(id: HostId): boolean {
    if (!this.started || this.phase === 'done' || this.stage !== 'battle') return false;
    if (!this.battle.send(id)) {
      this.emit({ type: 'nope', id });
      return false;
    }
    this.sentNow++;
    this.lastSend = this.t;
    this.drainBattle();
    return true;
  }

  /** Space: the cheapest ready card (between battles: go on at once). */
  quick(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.stage === 'upgrade') {
      this.skip();
      return true;
    }
    const id = this.battle.cheapestReady();
    return id ? this.send(id) : false;
  }

  /** The trumpet (a tap on it, T): its shockwave, when charged. */
  sound(): boolean {
    if (!this.started || this.phase === 'done' || this.stage !== 'battle' || this.charge < 1) return false;
    this.charge = 0;
    this.trumpetsNow++;
    this.battle.trumpet();
    this.drainBattle();
    return true;
  }

  /** Buy the i-th offer of the card between battles. */
  buy(i: number): boolean {
    if (this.stage !== 'upgrade') return false;
    const o = this.offers[i];
    if (!o) return false;
    const ok = o.what === 'gate' ? buyGate(this.p) : buyUnit(this.p, o.what);
    if (!ok) return false;
    if (o.what === 'gate') this.gateBought++;
    else this.unitsBought++;
    this.emit({ type: 'buy', what: o.what, level: o.level });
    this.offers = this.makeOffers();
    // the first purchase gives a moment more to look (once: the card never holds the session for long)
    if (!this.extended) {
      this.extended = true;
      this.stageT = Math.min(this.stageT, RULES.upgradeSec - 2.5);
    }
    return true;
  }

  /** Go on to the next battle now. */
  skip(): void {
    if (this.stage === 'upgrade') this.stageT = RULES.upgradeSec;
  }

  /** Keys: 1–6 the cards (between battles: 1–3 the offers), Space the cheapest, T the trumpet, Enter goes on. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (/^[1-6]$/.test(k)) {
      if (!down) return true;
      const i = Number(k) - 1;
      if (this.stage === 'upgrade') this.buy(i);
      else {
        const id = this.cards[i];
        if (id) this.send(id);
      }
      return true;
    }
    if (k === ' ') {
      if (down) this.quick();
      return true;
    }
    if (k === 't') {
      if (down) this.sound();
      return true;
    }
    if (k === 'Enter') {
      if (down) this.skip();
      return true;
    }
    return false;
  }

  /** The offers of the card between battles: the gate's next level and the two cheapest unit levels. */
  makeOffers(): Offer[] {
    const p = this.p, out: Offer[] = [];
    const gl = gateLevel(p), gp = gatePrice(gl);
    if (gp !== null) out.push({ what: 'gate', level: gl + 1, price: gp, can: p.gold >= gp });
    const units = cardsAt(gl)
      .map(id => ({ id, lv: unitLevel(p, id), price: unitPrice(id, unitLevel(p, id)) }))
      .filter((u): u is { id: HostId; lv: number; price: number } => u.price !== null)
      .sort((a, b) => a.price - b.price || HOST[a.id].cost - HOST[b.id].cost)
      .slice(0, 2);
    for (const u of units) out.push({ what: u.id, level: u.lv + 1, price: u.price, can: p.gold >= u.price });
    return out;
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.phaseT += dt;
    this.brain(dt, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    if (this.phase !== 'done') this.battleTick(dt);
    if (this.phase === 'finale' && this.phaseT >= RULES.finale) {
      this.phase = 'done';
      this.settle();
    }
    this.hint = this.phase === 'play' && this.stage === 'battle' && this.block.kind === 'warmup' && t - this.lastSend >= RULES.idleHint;
  }

  /**
   * The band's slow quantities: the flow in a sighted Natarcie past its lead-in, the trumpet's charge
   * from the hold, the calm that mends in a Cisza past its lead-in; the trace.
   */
  private brain(dt: number, f: FocusFrame): void {
    const b = this.block, play = this.phase === 'play';
    this.reliable = f.reliable;
    this.level = f.reliable ? clamp(f.level) : 0;
    this.calm = f.reliable ? clamp(f.calm) : 0;
    if (play && f.reliable) this.relSec += dt;
    const push = play && b.kind === 'push' && this.blockT >= this.lead && f.reliable;
    this.wantMult = push ? flowMult(f.level) : 1;
    this.mult = push && !b.blind ? this.wantMult : 1;
    this.calmNow = play && b.kind === 'rest' && this.blockT >= this.calmLead && f.reliable ? clamp(f.calm) : 0;
    // the trumpet: a held focus fills it; a broken hold empties a charge not yet full
    if (this.charge < 1) {
      if (this.sighted && f.reliable && f.focused) {
        this.charge = Math.min(1, this.charge + dt / this.trumpetNeed);
        if (this.charge >= 1) this.emit({ type: 'trumpetReady' });
      } else if (!f.focused || !f.reliable) this.charge = 0;
    }
    const phase: TracePhase = !play ? 'free' : b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
  }

  // ── the battles ─────────────────────────────────────────────────
  private battleTick(dt: number): void {
    this.stageT += dt;
    if (this.stage === 'battle') {
      const ctl: Control = { flow: this.mult, rest: this.restBlock, calm: this.calmNow };
      this.battle.step(dt, ctl);
      this.drainBattle();
      return;
    }
    // between battles the road still settles (the ash, the light), but nobody fights
    this.battle.step(dt, { flow: 1, rest: false, calm: 0 });
    this.drainBattle();
    const R = RULES;
    if ((this.stage === 'won' && this.stageT >= R.wonHold) || (this.stage === 'lost' && this.stageT >= R.lostHold)) {
      if (this.phase !== 'play') return;
      this.stage = 'upgrade';
      this.stageT = 0;
      this.extended = false;
      this.offers = this.makeOffers();
    } else if (this.stage === 'upgrade' && this.stageT >= R.upgradeSec) {
      this.battle = this.newBattle();
      this.stage = 'battle';
      this.stageT = 0;
      this.offers = [];
      this.emit({ type: 'battleStart', battle: this.p.battle, smok: isSmok(this.p.battle), retry: this.retreats });
    }
  }

  /** The battle's events become the session's: the score, the gold, the end of a battle. */
  private drainBattle(): void {
    for (const e of this.battle.take()) {
      switch (e.type) {
        case 'beaten':
          this.score++;
          this.addGold(e.gold);
          break;
        case 'won': {
          const R = RULES, smok = this.battle.smokBattle;
          const pay = R.winGold + R.winGoldPerBattle * this.battle.local;
          this.addGold(pay);
          this.wonNow++;
          if (this.retreats > 0) this.comeback = true;
          if (smok) {
            this.smokNow++;
            this.p.smoks++;
          }
          this.p.won++;
          this.p.battle++;
          this.retreats = 0;
          this.stage = 'won';
          this.stageT = 0;
          this.events.push(e);
          this.emit({ type: 'winGold', gold: pay });
          continue;
        }
        case 'lost':
          this.lostNow++;
          this.retreats++;
          this.stage = 'lost';
          this.stageT = 0;
          break;
        default:
          break;
      }
      this.events.push(e);
    }
  }

  private addGold(n: number): void {
    if (!(n > 0)) return;
    this.goldNow += n;
    this.p.gold += n;
    this.p.goldAll += n;
  }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: last ? null : this.plan[this.blockIndex + 1] });
    }
    if ((last && this.blockT >= b.dur) || t >= this.plannedSec - R.finale) {
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
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.callsBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.callsBase + this.callsBegun) % RULES.blindEvery === 0;
    }
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup[0];
    if (b.kind === 'push') {
      if (b.blind) return TIPS.blind[(this.session + i) % TIPS.blind.length];
      if (first && this.callsBase === 0) return TIPS.firstPush;
      return TIPS.push[(this.session - 1 + i) % TIPS.push.length];
    }
    if (first && this.session === 1) return TIPS.firstRest;
    return TIPS.rest[(this.session - 1 + i) % TIPS.rest.length];
  }

  /** The block's end: its verdict and what it pays — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block, R = RULES;
    let verdict: boolean | null = null, share = 0, need = 0, light = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= R.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'rest' && verdict) {
        this.passedRests++;
        if (this.stage === 'battle') this.battle.mendWalls(R.restWalls);
        this.addGold(R.restGold);
        this.emit({ type: 'restPass', gold: R.restGold });
      }
      if (b.blind) {
        this.trace.unveil(this.t);
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        // the light the last 15 s of focus would have brought, paid at once
        light = Math.round(s * this.judge.windowSec * this.battle.flowBase * (R.flowTop - 1));
        if (light > 0 && this.stage === 'battle') this.battle.addLight(light);
        this.emit({ type: 'blindPay', light, share: s });
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need, t0: this.t - this.blockT, t1: this.t, light });
  }

  // ── the finale ──────────────────────────────────────────────────
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.phaseT = 0;
    this.emit({ type: 'finale' });
  }

  /**
   * The session is settled once — at the end of the finale, or when it ends early: the day's gift,
   * the counters into the progress.  The gold, the battles won and the battle reached went in live.
   */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p, day = this.init.day;
    if (p.giftDay !== day) {
      p.giftDay = day;
      this.giftNow = RULES.giftGold;
      this.addGold(RULES.giftGold);
      this.emit({ type: 'gift', gold: RULES.giftGold });
    }
    p.sessions = Math.max(p.sessions, this.session);
    p.calls = Math.max(p.calls, this.callsBase + this.callsBegun);
    p.total += this.score;
    p.trumpets += this.trumpetsNow;
    p.lastLen = this.plannedSec;
  }

  /** The session ends before its own finale: settle as the finale would. */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') this.endBlock();
    this.settle();
    this.phase = 'done';
  }

  // ── output ──────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The pad follows the flow in a sighted Natarcie, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    const b = this.block;
    if (b.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(f.level);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The session's numbers, idempotent: the record with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.won'), String(this.wonNow)],
      [t('stat.battle'), t('stat.battleOf', { n: circleOf(p.battle).local + 1, circle: circleOf(p.battle).circle + 1 })],
      [t('stat.gold'), `+${fmtNum(this.goldNow)}`],
      [t('stat.gate'), String(gateLevel(p))],
      [t('stat.trumpets'), String(this.trumpetsNow)],
      [t('stat.sent'), String(this.sentNow)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: the Smok
   * beaten, a comeback after a withdrawal, a battle won, a new gate level, the trumpet, a passed
   * Cisza; else Revelation 12:7-8.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.smokNow > 0) fit.push('1jn4.4');
    if (this.comeback) fit.push('rom12.21');
    if (this.wonNow > 0) fit.push('eph6.10-11');
    if (this.gateBought > 0) fit.push('2co10.4');
    if (this.trumpetsNow > 0) fit.push('jas4.7');
    if (this.passedRests > 0) fit.push('exo14.14');
    fit.push('rev12.7-8');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.smokNow) add(0, t('hl.smok'));
    if (this.wonNow) add(1, t('hl.won', { n: this.wonNow }));
    if (this.comeback) add(2, t('hl.comeback'));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(3, t('hl.record', { demons: demonsText(this.score) }));
    if (this.gateBought) add(4, t('hl.gate', { n: gateLevel(this.p) }));
    if (this.trumpetsNow) add(5, t('hl.trumpet', { n: this.trumpetsNow }));
    if (this.blindShare >= 0) add(6, t('hl.blind', { n: this.blindShare }));
    if (this.giftNow) add(7, t('hl.gift', { gold: goldText(this.giftNow) }));
    if (this.unitsBought) add(8, t('hl.units', { n: this.unitsBought }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }

  /** A unit's name (for the view's cards and toasts). */
  static nameOf(id: HostId): string { return HOST_NAME[id]; }
}
