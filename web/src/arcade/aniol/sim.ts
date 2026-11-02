/**
 * Anioł Stróż's night, without the DOM or the canvas (so every rule is unit-tested): the Zmory on
 * the line across the room, the strikes, the aura, the Płomień, Sen and the lullaby, the levels and
 * the gifts of the night, the blocks, Koszmar at the end, the meta (meta.ts) and the session's
 * numbers.  All numbers are in rules.ts (re-exported here).
 *
 * The hands strike: a tap on the left or right half (←/→, A/D) sweeps that side with light and hits
 * the nearest Zmora in reach; a tap in the middle third and Space strike the side whose Zmora is
 * nearer.  A strike with nothing in reach is a whiff (a short recovery, the combo resets; in the
 * lullaby it is a note of the harp instead).  The band only adds:
 *   Czuwanie (push)    after a lead-in the aura's radius is auraMin + level × auraExtra: inside it
 *                      the Zmory slow down, take light in proportion to how far the level stands
 *                      above the threshold, and their armour cracks while it stands above; a held
 *                      focus (5 s Mendi / 3 s HALO) fills the Płomień, which banishes every Zmora.
 *   Kołysanka (rest)   the Zmory draw back into the dark (a slow trickle stays); calm lights stars
 *                      in the child's dream: Sen comes back and feathers fall; a passed one pays more.
 *   Mgła snu (blind)   every 4th Czuwanie from the 3rd session: no aura, the trace veiled; at its end
 *                      the block's last 15 s become a dawn burst of the aura's strength, all at once.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the aura rests at its smallest and the stars wait; the block clock runs on.
 *
 * Grace: a Zmora that reaches the bed only dims Sen; when Sen runs out the child stirs, the angel
 * comforts it, the Zmory near the bed scatter and Sen comes back to half — only the combo is lost.
 * The child is never harmed and nothing ends the night early.  A level-up offers three gifts while
 * the night goes on in slow motion; after 5 s the first is taken by itself.
 *
 * The headline is the Zmory banished this session, counted live.
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome } from '../kit/types';
import { RANKS, TIPS, ZMORY, giftById, type GiftId, type ZKind } from './content';
import { feathers as feathersText, t, unit, zmory as zmoryText } from './i18n';
import { bestFor, giftPool, lenKey, rankOf, type AniolProgress } from './meta';
import { RULES, span } from './rules';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';
export type Side = -1 | 1;
/** How the aura looks: the faint candle, live, waiting out the band's delay, grey without signal, the blind fog, the lamp's. */
export type AuraLook = 'candle' | 'live' | 'wait' | 'grey' | 'blind' | 'lamp';
/** How a Zmora left the night. */
export type Via = 'strike' | 'aura' | 'flame' | 'burst' | 'shield' | 'dawn';

export interface Zmora {
  id: number;
  kind: ZKind;
  side: Side;
  /** distance from the bed's centre (u), height above the floor (u) */
  d: number;
  z: number;
  hp: number;
  maxHp: number;
  r: number;
  /** armour of shadow (the Pancerna) and how far the aura has cracked it (0..1) */
  armoured: boolean;
  crack: number;
  speed: number;
  /** seconds since it stepped out of the dark (world time) */
  age: number;
  state: 'walk' | 'back' | 'gone';
  /** the Skoczek's leap cycle (s) */
  hop: number;
  /** pushed back by a hit (u/s) */
  knockV: number;
  /** a hit's flash (s left), inside the live aura now, the light it has taken from the aura */
  hitT: number;
  inAura: boolean;
  burn: number;
  /** Koszmar: hits in this phase, turning to the other side */
  phaseHits: number;
  turning: boolean;
  turnT: number;
}

export type SimEvent =
  | { type: 'spawn'; id: number; kind: ZKind; side: Side }
  | { type: 'strike'; side: Side; hit: boolean; spear: boolean }
  | { type: 'hit'; id: number; kind: ZKind; side: Side; d: number; z: number; left: number; combo: number }
  | { type: 'bounce'; id: number; side: Side; d: number }
  | { type: 'crack'; id: number; side: Side; d: number }
  | { type: 'banish'; id: number; kind: ZKind; side: Side; d: number; z: number; via: Via; feathers: number; n: number }
  | { type: 'split'; id: number; side: Side; d: number }
  | { type: 'whiff'; side: Side }
  | { type: 'harp'; side: Side; n: number }
  | { type: 'combo'; n: number; mult: number }
  | { type: 'touch'; id: number; kind: ZKind; side: Side; sen: number }
  | { type: 'shield'; side: Side }
  | { type: 'stir' }
  | { type: 'flame'; n: number }
  | { type: 'level'; level: number; options: GiftId[] }
  | { type: 'gift'; id: GiftId; auto: boolean }
  | { type: 'star'; n: number }
  | { type: 'restPass'; feathers: number }
  | { type: 'burst'; share: number; r: number; n: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  /** the judged window's share on the asked side and the share it needed; the block's span of play time */
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; t0: number; t1: number; stars: number }
  | { type: 'koszmar'; what: 'come' | 'turn' | 'banished' | 'fled'; side: Side }
  | { type: 'finale' }
  | { type: 'dawn' }
  | { type: 'dayGift'; n: number }
  | { type: 'rank'; rank: number };

const NO_EVENTS: readonly SimEvent[] = [];

// ── pure rules ───────────────────────────────────────────────────
/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/** The finale's length: Koszmar needs room in sessions of 2 min and more. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/**
 * The night's blocks.  A first-ever session opens with the warm-up "Pierwsza warta" (30 s in 5 and
 * 10 min, 20 s in 3, 6 s in a 40 s test); then Czuwanie / Kołysanka pairs (24 ± 4 s and 22 ± 3 s,
 * scaled to end on time, jittered only when there is room) ending with a lullaby, leaving the
 * finale's seconds to Koszmar.  No block under 12 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const fin = finaleFor(plannedSec);
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * R.minBlock, plannedSec - fin);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(2 * R.minBlock, left - warm);
      return [b('warmup', warm), b('push', rest / 2), b('rest', rest / 2)];
    }
    const rest = Math.max(R.minBlock, Math.min(14, left / 2));
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

/** The aura's radius for a level (u): the band can only add. */
export const auraFor = (level: number, wide = 1): number => RULES.auraMin + clamp(level) * RULES.auraExtra * wide;
/** The radius at the threshold (level 0.5): the dotted circle. */
export const AURA_MARK = auraFor(0.5);

/** Light the aura gives a Zmora per second at a level: nothing at or below the threshold. */
export const auraDps = (level: number): number => RULES.auraDps * clamp((level - 0.5) / 0.5);

/** Feathers to the next level from `level` (0-based). */
export const levelNeed = (level: number): number => RULES.levelBase + RULES.levelStep * level;

/** The combo's multiplier of feathers: ×2 from 10 hits, ×3 from 25. */
export const comboMult = (combo: number): number => 1 + RULES.comboAt.filter(n => combo >= n).length;

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: AniolProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

export interface Choice { options: GiftId[]; t: number }

export class AniolSim {
  readonly p: AniolProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  /** the band's last 40 s, drawn as the stars on the window sill and the curve in the window */
  readonly trace = new SignalTrace(40, 0.1);
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly flameBase: number;
  private readonly starLead: number;
  readonly finaleSec: number;

  started = false;
  readonly session: number;
  /** the angel's rank when the night began: the gifts' pool and the room's cosy things */
  readonly rank: number;
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  t = 0;
  tip = '';
  hint = false;
  private lastInput = 0;

  // the room
  readonly zmory: Zmora[] = [];
  private nextId = 1;
  private spawnT: number = RULES.firstDelay;
  private firstDone = false;
  private lastSide: Side = 1;
  private sideRun = 0;
  /** the side the angel faces (the last strike) */
  facing: Side = 1;
  /** whiff recovery (s left) and a tap waiting for it */
  recover = 0;
  private buffered: { side: Side | 0 } | null = null;
  /** hit-stop (s left): the world holds its breath */
  stop = 0;
  /** world time this frame / real time (slow motion while gifts are chosen, 0 in a hit-stop) */
  timeScale = 1;
  combo = 0;
  harpN = 0;

  // the band
  reliable = false;
  level = 0;
  calm = 0;
  /** the aura's radius now (u) and how it looks; the Płomień's charge (0..1) */
  auraR: number = RULES.candle;
  auraLook: AuraLook = 'candle';
  flameCharge = 0;
  private flameBlock = 0;
  private nextFlame = 0;
  private lastHold = 0;
  maxHold = 0;
  /** the blind block's dawn burst (s left) and its radius */
  burstT = 0;
  burstR = 0;
  private relSec = 0;

  // Sen and the lullaby
  sen = 1;
  stars = 0;
  private starP = 0;

  // the night's levels and gifts
  nightLevel = 0;
  xp = 0;
  choice: Choice | null = null;
  private pending = 0;
  readonly taken: Partial<Record<GiftId, number>> = {};
  readonly gifts: GiftId[] = [];
  shieldReady = false;
  shieldT = 0;

  // the session's numbers
  score = 0;
  feathers = 0;
  bestCombo = 0;
  flames = 0;
  stirs = 0;
  touches = 0;
  passedRests = 0;
  blindShare = -1;
  koszmar: 'none' | 'come' | 'banished' | 'fled' = 'none';
  koszmarId = -1;
  readonly byKind: Partial<Record<ZKind, number>> = {};
  private dayGiftNow = 0;
  private rankUp = -1;
  private settled = false;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  private readonly bestBefore: number | null;

  constructor(private readonly init: SimInit) {
    const p = (this.p = init.progress);
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.flameBase = RULES.flameHold[band];
    this.starLead = RULES.starLead[band];
    this.finaleSec = finaleFor(init.plannedSec);
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.rank = rankOf(p.feathers);
    this.pushesBase = p.pushes;
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng);
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.phase === 'play'; }
  get pushBlock(): boolean { return this.block?.kind === 'push' && this.phase === 'play'; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.phase === 'play'; }
  /** a sighted Czuwanie past its lead-in: the aura answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get leadIn(): number { return this.lead; }
  get starLeadIn(): number { return this.starLead; }
  /** the Płomień's hold, with the gift of a faster one */
  get flameNeed(): number { return this.flameBase * (this.taken.flame ? RULES.flameFast ** this.taken.flame : 1); }
  /** the sweep's reach (u), with the gifts */
  get reach(): number { return RULES.reach + RULES.reachStep * (this.taken.reach ?? 0); }
  get auraWide(): number { return this.taken.aura ? RULES.auraWide ** this.taken.aura : 1; }
  get mult(): number { return comboMult(this.combo); }
  get levelProgress(): number { return clamp(this.xp / levelNeed(this.nightLevel)); }
  /** the share of the night gone (the Zmory grow quicker) */
  get nightShare(): number { return clamp(this.t / Math.max(1, this.plannedSec - this.finaleSec)); }
  get walking(): Zmora[] { return this.zmory.filter(z => z.state === 'walk'); }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startBlock(0);
  }

  // ── the hands ───────────────────────────────────────────────────
  /** A strike: −1 the left, +1 the right, 0 the side whose Zmora is nearer. */
  strike(side: Side | 0): void {
    if (!this.started || this.phase === 'done') return;
    this.lastInput = this.t;
    if (this.recover > 0) {
      this.buffered = { side };
      return;
    }
    const s: Side = side === 0 ? this.nearerSide() : side;
    this.facing = s;
    const spear = !!this.taken.spear;
    const reach = this.reach + (spear ? RULES.spearReach : 0);
    const inReach = this.zmory
      .filter(z => z.state === 'walk' && z.side === s && !z.turning && z.d - z.r <= reach && z.z <= RULES.airHit)
      .sort((a, b) => a.d - b.d);
    if (!inReach.length) {
      this.emit({ type: 'strike', side: s, hit: false, spear });
      if (this.restBlock) {
        this.emit({ type: 'harp', side: s, n: this.harpN++ });
        return;
      }
      this.recover = RULES.whiff;
      this.combo = 0;
      this.emit({ type: 'whiff', side: s });
      return;
    }
    // without the spear only the nearest, and only inside the plain reach
    const targets = spear ? inReach : inReach.filter(z => z.d - z.r <= this.reach).slice(0, 1);
    if (!targets.length) {
      this.emit({ type: 'strike', side: s, hit: false, spear });
      this.recover = RULES.whiff;
      this.combo = 0;
      this.emit({ type: 'whiff', side: s });
      return;
    }
    this.emit({ type: 'strike', side: s, hit: true, spear });
    const dmg = this.taken.double ? 2 : 1;
    for (const z of targets) this.hitZ(z, dmg);
  }

  /** The side whose Zmora is nearest the bed (the facing side when the room is empty). */
  nearerSide(): Side {
    let best: Zmora | null = null;
    for (const z of this.zmory) {
      if (z.state !== 'walk' || z.turning) continue;
      if (!best || z.d - z.r < best.d - best.r) best = z;
    }
    return best ? best.side : this.facing;
  }

  /** Choose a gift (0..2) while the choice is open. */
  pick(i: number, auto = false): boolean {
    const c = this.choice;
    if (!c || i < 0 || i >= c.options.length) return false;
    const id = c.options[i];
    this.choice = null;
    this.taken[id] = (this.taken[id] ?? 0) + 1;
    this.gifts.push(id);
    if (id === 'shield') {
      this.shieldReady = true;
      this.shieldT = 0;
    } else if (id === 'sen') this.sen = 1;
    this.emit({ type: 'gift', id, auto });
    if (this.pending > 0) {
      this.pending--;
      this.openChoice();
    }
    return true;
  }

  /** Arrows and A/D strike a side; Space, Enter, ↑ and W the nearer side; 1–3 choose a gift. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const side: Record<string, Side | 0> = { ArrowLeft: -1, a: -1, ArrowRight: 1, d: 1, ' ': 0, Enter: 0, ArrowUp: 0, w: 0 };
    if (k in side) {
      if (down && !this.held.has(k)) this.strike(side[k]);
      if (down) this.held.add(k);
      else this.held.delete(k);
      return true;
    }
    if (k === '1' || k === '2' || k === '3') {
      if (down) this.pick(Number(k) - 1);
      return true;
    }
    return false;
  }

  private readonly held = new Set<string>();

  /** Every held key lets go (the runner's pause). */
  release(): void { this.held.clear(); }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.phaseT += dt;
    // the world's clock: slow while the gifts are chosen, still in a hit-stop
    this.timeScale = this.stop > 0 ? 0 : this.choice ? RULES.choiceSlow : 1;
    this.stop = Math.max(0, this.stop - dt);
    const w = dt * this.timeScale;
    this.recover = Math.max(0, this.recover - dt);
    // a tap during the recovery lands the moment it ends (it never waits longer than the recovery)
    if (this.buffered && this.recover <= 0) {
      const b = this.buffered;
      this.buffered = null;
      this.strike(b.side);
    }
    if (this.choice) {
      this.choice.t += dt;
      if (this.choice.t >= RULES.choiceSec) this.pick(0, true);
    }
    this.brain(dt, w, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.dawn(false);
    this.spawner(w);
    this.walk(w);
    if (this.taken.shield && !this.shieldReady) {
      this.shieldT += w;
      if (this.shieldT >= RULES.shieldSec) this.shieldReady = true;
    }
    this.hint = this.phase === 'play' && this.block.kind === 'warmup' && t - this.lastInput >= RULES.idleHint;
  }

  /**
   * The band's slow quantities: the aura in a sighted Czuwanie past its lead-in, the Płomień from
   * the hold, the stars and Sen from calm in a lullaby past its lead-in; the trace.
   */
  private brain(dt: number, w: number, f: FocusFrame): void {
    const R = RULES, b = this.block;
    const play = this.phase === 'play';
    this.reliable = f.reliable;
    this.level = f.reliable ? f.level : 0;
    this.calm = f.reliable ? f.calm : 0;
    if (play && f.reliable) this.relSec += dt;
    const live = this.sighted && f.reliable;
    const lamp = !!this.taken.lamp && !this.pushBlock;
    const want = live ? auraFor(f.level, this.auraWide) : lamp ? R.lampR : this.pushBlock && !b.blind ? R.auraMin : R.candle;
    this.auraR = approach(this.auraR, want, dt, R.auraTau);
    this.auraLook = !play || b.kind !== 'push' ? (lamp ? 'lamp' : 'candle') : b.blind ? 'blind' : this.blockT < this.lead ? 'wait' : f.reliable ? 'live' : 'grey';
    this.burstT = Math.max(0, this.burstT - dt);
    const phase: TracePhase = !play ? 'free' : b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
    // the aura's light on the Zmory inside it
    for (const z of this.zmory) {
      z.inAura = false;
      if (z.state !== 'walk' || z.kind === 'koszmar') continue;
      const inside = z.d - z.r <= this.auraR;
      if (live && inside) {
        z.inAura = true;
        if (z.armoured) {
          if (f.level > 0.5) {
            z.crack += R.crackRate * w;
            if (z.crack >= 1) {
              z.armoured = false;
              this.emit({ type: 'crack', id: z.id, side: z.side, d: z.d });
            }
          }
          continue;
        }
        const light = auraDps(f.level) * w;
        z.hp -= light;
        z.burn += light;
        if (z.hp <= 1e-6) this.banish(z, 'aura');
      } else if (lamp && inside) {
        z.inAura = true;
        if (z.armoured) continue;
        z.hp -= R.lampDps * w;
        z.burn += R.lampDps * w;
        if (z.hp <= 1e-6) this.banish(z, 'aura');
      }
    }
    // the Płomień: a held focus fills it
    if (f.hold < this.lastHold - 0.5) this.nextFlame = this.flameNeed;
    this.lastHold = f.hold;
    if (live) this.maxHold = Math.max(this.maxHold, f.hold);
    const need = this.flameNeed;
    this.flameCharge = live && this.flameBlock < R.flameMax ? clamp((f.hold - (this.nextFlame - need)) / need) : approach(this.flameCharge, 0, dt, 0.6);
    if (live && f.hold >= this.nextFlame && this.flameBlock < R.flameMax) {
      this.flameBlock++;
      this.nextFlame = f.hold + need;
      this.flame();
    }
    // the lullaby: calm lights stars in the dream and brings Sen back
    if (play && b.kind === 'rest' && this.blockT >= this.starLead && f.reliable) {
      this.sen = Math.min(1, this.sen + R.senGain * f.calm * dt);
      this.starP = Math.min(R.starMax, this.starP + R.starGain * f.calm * dt);
      while (Math.floor(this.starP) > this.stars) {
        this.stars++;
        this.sen = Math.min(1, this.sen + R.starSen);
        this.gain(R.starFeathers);
        this.emit({ type: 'star', n: this.stars });
      }
    }
  }

  /** The Płomień: every Zmora in the room is banished at once. */
  private flame(): void {
    let n = 0;
    for (const z of this.zmory) {
      if (z.state !== 'walk' || z.kind === 'koszmar') continue;
      n += this.banish(z, 'flame');
    }
    this.flames++;
    this.stop = Math.max(this.stop, RULES.stopFlame);
    this.emit({ type: 'flame', n });
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
    if ((last && this.blockT >= b.dur) || t >= this.plannedSec - this.finaleSec) {
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
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.flameBlock = 0;
      this.nextFlame = this.flameNeed;
      this.lastHold = 0;
    } else if (b.kind === 'rest') {
      this.starP = 0;
      this.stars = 0;
      // the lullaby: the Zmory draw back into the dark
      for (const z of this.zmory) if (z.state === 'walk' && z.kind !== 'koszmar') z.state = 'back';
      this.spawnT = Math.max(this.spawnT, RULES.spawnRest * 0.6);
    }
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup[0];
    if (b.kind === 'push') {
      if (b.blind) return TIPS.blind[(this.session + i) % TIPS.blind.length];
      if (first && this.pushesBase === 0) return TIPS.firstPush;
      return TIPS.push[(this.session - 1 + i) % TIPS.push.length];
    }
    if (first && this.session === 1) return TIPS.firstRest;
    return TIPS.rest[(this.session - 1 + i) % TIPS.rest.length];
  }

  /** The block's end: its verdict and what it pays — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block, R = RULES;
    let verdict: boolean | null = null, share = 0, need = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= R.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'rest' && verdict) {
        this.passedRests++;
        this.gain(R.restBonus);
        this.emit({ type: 'restPass', feathers: R.restBonus });
      }
      if (b.blind) {
        this.trace.unveil(this.t);
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        this.dawnBurst(s);
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need, t0: this.t - this.blockT, t1: this.t, stars: b.kind === 'rest' ? this.stars : 0 });
  }

  /** The blind block's end: its focus as a burst of the aura's strength, all at once. */
  private dawnBurst(share: number): void {
    const r = auraFor(share, this.auraWide);
    let n = 0;
    for (const z of this.zmory) {
      if (z.state !== 'walk' || z.kind === 'koszmar' || z.d - z.r > r) continue;
      if (z.armoured && share < 0.5) continue;
      n += this.banish(z, 'burst');
    }
    this.burstT = RULES.burstSec;
    this.burstR = r;
    this.emit({ type: 'burst', share, r, n });
  }

  // ── the Zmory ───────────────────────────────────────────────────
  /** Which kind steps out next: the night's mix grows with the nights played and the blocks. */
  kindFor(): ZKind {
    const b = this.block;
    if (this.phase !== 'play' || b.kind !== 'push') return 'mara';
    const night = this.session, pushI = this.plan.slice(0, this.blockIndex).filter(x => x.kind === 'push').length;
    const mix: [ZKind, number][] = [['mara', 5], ['skoczek', 2]];
    if (night >= 2) mix.push(['widmo', 2]);
    if (night >= 2 || pushI >= 1) mix.push(['pancerna', 1.3]);
    if (night >= 3) mix.push(['roj', 1.2]);
    let r = this.rng() * mix.reduce((s, m) => s + m[1], 0);
    for (const [k, wgt] of mix) if ((r -= wgt) <= 0) return k;
    return 'mara';
  }

  private sideFor(): Side {
    let s: Side = this.rng() < 0.5 ? -1 : 1;
    if (s === this.lastSide && this.sideRun >= RULES.sameSide) s = -s as Side;
    this.sideRun = s === this.lastSide ? this.sideRun + 1 : 1;
    this.lastSide = s;
    return s;
  }

  /** How quick the Zmory are: the night's share and the nights played. */
  get speedK(): number {
    return (1 + RULES.nightRamp * this.nightShare) * (1 + RULES.nightsRamp * Math.min(RULES.nightsMax, this.session - 1));
  }

  spawn(kind: ZKind, side: Side, d: number = RULES.edge, emerged = false): Zmora {
    const s = ZMORY[kind];
    const z: Zmora = {
      id: this.nextId++, kind, side, d, z: 0, hp: s.hp, maxHp: s.hp, r: s.r, armoured: kind === 'pancerna', crack: 0,
      speed: s.speed * this.speedK, age: emerged ? RULES.emerge : 0, state: 'walk', hop: this.rng() * RULES.hopGround,
      knockV: 0, hitT: 0, inAura: false, burn: 0, phaseHits: 0, turning: false, turnT: 0,
    };
    this.zmory.push(z);
    this.emit({ type: 'spawn', id: z.id, kind, side });
    return z;
  }

  private spawner(w: number): void {
    const R = RULES;
    if (this.phase !== 'play') return;
    this.spawnT -= w;
    if (this.spawnT > 0) return;
    const b = this.block;
    const kind = this.kindFor();
    const side = this.sideFor();
    if (!this.firstDone) {
      this.firstDone = true;
      this.spawn('mara', side, R.firstAt);
    } else this.spawn(kind, side);
    this.spawnT += b.kind === 'warmup' ? R.spawnWarm : b.kind === 'rest' ? R.spawnRest : span(R.spawnPush, this.nightShare);
  }

  private walk(w: number): void {
    const R = RULES, rest = this.restBlock;
    for (const z of this.zmory) {
      if (z.state === 'gone') continue;
      z.age += w;
      z.hitT = Math.max(0, z.hitT - w);
      if (z.state === 'back' || z.turning) {
        z.d += R.backSpeed * w;
        z.z = Math.max(0, z.z - 3 * w);
        if (z.kind === 'koszmar' && z.turning) {
          if (z.d >= R.edge) {
            z.turnT += w;
            if (z.turnT >= R.koszmarTurn) {
              z.turning = false;
              z.turnT = 0;
              z.side = -z.side as Side;
              z.d = R.koszmarBack + 0.8;
              z.age = 0;
              z.phaseHits = 0;
              this.emit({ type: 'koszmar', what: 'turn', side: z.side });
            }
          }
          continue;
        }
        if (z.d >= R.wall) z.state = 'gone';
        continue;
      }
      // a hit's push back
      if (z.knockV > 0.01) {
        z.d = Math.min(R.edge, z.d + z.knockV * w);
        z.knockV = approach(z.knockV, 0, w, R.knockTau);
      }
      const slow = (z.inAura ? R.auraSlow : 1) * (rest ? R.restSlow : 1) * (z.age < R.emerge ? 0.5 : 1);
      if (z.kind === 'skoczek') {
        // a leap: on the ground, then an arc toward the bed
        const cycle = R.hopGround + R.hopAir;
        z.hop += w * slow * (z.speed / ZMORY.skoczek.speed);
        const k = z.hop % cycle;
        if (k > R.hopGround) {
          const a = (k - R.hopGround) / R.hopAir;
          z.z = R.hopHigh * Math.sin(Math.PI * a);
          z.d -= (R.hopFar / R.hopAir) * w * slow * (z.speed / ZMORY.skoczek.speed);
        } else z.z = 0;
      } else z.d -= z.speed * slow * w;
      if (z.d - z.r <= R.bedHalf) this.touch(z);
    }
    // the gone ones leave the list
    let n = 0;
    for (const z of this.zmory) if (z.state !== 'gone') this.zmory[n++] = z;
    this.zmory.length = n;
  }

  private hitZ(z: Zmora, dmg: number): void {
    const R = RULES;
    if (z.armoured) {
      z.knockV = R.bounceKnock;
      z.hitT = 0.12;
      this.stop = Math.max(this.stop, R.stopHit);
      this.emit({ type: 'bounce', id: z.id, side: z.side, d: z.d });
      return;
    }
    z.hp -= dmg;
    z.hitT = 0.16;
    z.knockV = z.kind === 'koszmar' ? R.knock * 0.6 : R.knock;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if ((R.comboAt as readonly number[]).includes(this.combo)) this.emit({ type: 'combo', n: this.combo, mult: comboMult(this.combo) });
    this.stop = Math.max(this.stop, R.stopHit);
    this.emit({ type: 'hit', id: z.id, kind: z.kind, side: z.side, d: z.d, z: z.z, left: Math.max(0, z.hp), combo: this.combo });
    if (z.kind === 'widmo' && z.hp > 1e-6) z.d = Math.min(R.edge, z.d + R.slip);
    if (z.kind === 'koszmar') {
      if (z.hp <= 1e-6) {
        this.banish(z, 'strike');
        return;
      }
      z.phaseHits++;
      if (z.phaseHits >= this.koszmarPhase) {
        z.turning = true;
        z.turnT = 0;
      }
      return;
    }
    if (z.hp <= 1e-6) this.banish(z, 'strike');
  }

  /** A Zmora leaves the night as motes of light; returns how many were banished (a Rój struck splits instead). */
  private banish(z: Zmora, via: Via): number {
    if (z.state === 'gone') return 0;
    const R = RULES;
    z.state = 'gone';
    if (z.kind === 'roj' && (via === 'strike' || via === 'aura')) {
      for (let i = 0; i < R.swarm; i++) {
        const c = this.spawn('cien', z.side, Math.min(R.edge, z.d + (i - 1) * R.swarmSpread + 0.2), true);
        c.knockV = R.knock * (0.5 + i * 0.3);
      }
      this.emit({ type: 'split', id: z.id, side: z.side, d: z.d });
      return 0;
    }
    const n = z.kind === 'roj' ? R.swarm : 1;
    const feathers = ZMORY[z.kind].feathers * n * (via === 'strike' ? this.mult : 1);
    this.score += n;
    this.byKind[z.kind] = (this.byKind[z.kind] ?? 0) + n;
    this.stop = Math.max(this.stop, z.kind === 'koszmar' ? R.stopKoszmar : R.stopBanish);
    this.emit({ type: 'banish', id: z.id, kind: z.kind, side: z.side, d: z.d, z: z.z, via, feathers, n });
    this.gain(feathers);
    if (z.kind === 'koszmar') {
      this.koszmar = 'banished';
      this.emit({ type: 'koszmar', what: 'banished', side: z.side });
      this.dawn(true);
    }
    return n;
  }

  /** A Zmora at the bed: the wing shield takes it, else it dims Sen and fades (Koszmar is thrown back). */
  private touch(z: Zmora): void {
    const R = RULES;
    if (z.kind === 'koszmar') {
      this.sen = Math.max(0, this.sen - ZMORY.koszmar.dim);
      z.d = R.koszmarBack;
      z.knockV = 0;
      this.touches++;
      this.emit({ type: 'touch', id: z.id, kind: z.kind, side: z.side, sen: this.sen });
      if (this.sen <= 0) this.stir();
      return;
    }
    if (this.shieldReady) {
      this.shieldReady = false;
      this.shieldT = 0;
      this.emit({ type: 'shield', side: z.side });
      this.banish(z, 'shield');
      return;
    }
    z.state = 'gone';
    this.sen = Math.max(0, this.sen - ZMORY[z.kind].dim);
    this.touches++;
    this.emit({ type: 'touch', id: z.id, kind: z.kind, side: z.side, sen: this.sen });
    if (this.sen <= 0) this.stir();
  }

  /** Sen ran out: the child stirs, the angel comforts it, the Zmory near scatter, Sen back to half. */
  private stir(): void {
    const R = RULES;
    this.stirs++;
    this.sen = R.senBack;
    this.combo = 0;
    for (const z of this.zmory) {
      if (z.state !== 'walk') continue;
      if (z.kind === 'koszmar') z.d = Math.max(z.d, R.koszmarBack);
      else if (z.d - z.r <= R.scatter) z.state = 'back';
    }
    this.emit({ type: 'stir' });
  }

  // ── levels and gifts ────────────────────────────────────────────
  private gain(feathers: number): void {
    if (!(feathers > 0)) return;
    this.feathers += feathers;
    this.xp += feathers;
    while (this.xp >= levelNeed(this.nightLevel)) {
      this.xp -= levelNeed(this.nightLevel);
      this.nightLevel++;
      if (this.choice) this.pending++;
      else this.openChoice();
    }
  }

  /** Three different gifts from the rank's pool, those not taken to their limit; the dream's refresh fills in. */
  giftOptions(): GiftId[] {
    const pool = giftPool(this.rank).filter(g => g.id !== 'sen' && (this.taken[g.id] ?? 0) < g.max).map(g => g.id);
    const out: GiftId[] = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    while (out.length < 3) out.push('sen');
    return out;
  }

  private openChoice(): void {
    if (this.phase === 'done') return;
    const options = this.giftOptions();
    this.choice = { options, t: 0 };
    this.emit({ type: 'level', level: this.nightLevel, options });
  }

  // ── the finale: Koszmar ─────────────────────────────────────────
  private get long(): boolean { return this.plannedSec >= 120; }
  get koszmarPhase(): number { return this.long ? RULES.koszmarPhase.long : RULES.koszmarPhase.short; }

  /** The last block ended: Koszmar, the great shadow, comes from one side. */
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.phaseT = 0;
    this.flameCharge = 0;
    const side = this.sideFor();
    const k = this.spawn('koszmar', side, RULES.koszmarBack + 0.8);
    k.hp = k.maxHp = this.long ? RULES.koszmarHp.long : RULES.koszmarHp.short;
    this.koszmarId = k.id;
    this.koszmar = 'come';
    this.emit({ type: 'finale' });
    this.emit({ type: 'koszmar', what: 'come', side });
  }

  /** Dawn: Koszmar banished, or the night's time is up (it flees, the next dawn always comes). */
  private dawn(banished: boolean): void {
    if (this.phase === 'done') return;
    for (const z of this.zmory) {
      if (z.state !== 'walk' && z.state !== 'back') continue;
      if (z.kind === 'koszmar') {
        if (!banished) {
          z.state = 'back';
          z.turning = false;
          this.koszmar = 'fled';
          this.emit({ type: 'koszmar', what: 'fled', side: z.side });
        }
        continue;
      }
      if (z.state === 'walk') this.banish(z, 'dawn');
    }
    this.choice = null;
    this.pending = 0;
    this.phase = 'done';
    this.phaseT = 0;
    this.emit({ type: 'dawn' });
    this.settle();
  }

  // ── the meta ────────────────────────────────────────────────────
  /**
   * The night is settled once — at dawn, or when it ends early: the day's gift comes, the
   * feathers reach the angel's rank, the counters reach the progress.
   */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p, day = this.init.day, R = RULES;
    if (p.giftDay !== day) {
      p.giftDay = day;
      this.dayGiftNow = R.dayGift;
      this.emit({ type: 'dayGift', n: R.dayGift });
    }
    const before = rankOf(p.feathers);
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushesBase + this.pushesBegun);
    p.total += this.score;
    p.feathers += this.feathers + this.dayGiftNow;
    p.flames += this.flames;
    if (this.koszmar === 'banished') p.koszmary++;
    if (this.stirs === 0) p.calmNights++;
    p.lastLen = this.plannedSec;
    const after = rankOf(p.feathers);
    if (after > before) {
      this.rankUp = after;
      this.emit({ type: 'rank', rank: after });
    }
  }

  /** The session ends before its own dawn: settle as the dawn would. */
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

  /** The pad follows the aura in a sighted Czuwanie, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp((this.auraR - RULES.auraMin) / (RULES.auraExtra * this.auraWide));
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
      p.bestCombo = Math.max(p.bestCombo, this.bestCombo);
      p.bestLevel = Math.max(p.bestLevel, this.nightLevel);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.level'), String(this.nightLevel + 1)],
      [t('stat.combo'), String(this.bestCombo)],
      [t('stat.flames'), String(this.flames)],
      [t('stat.feathers'), fmtNum(this.feathers)],
      [t('stat.sen'), this.stirs === 0 ? t('stat.senCalm') : t('stat.senStirs', { n: this.stirs })],
      [t('stat.rank'), RANKS[rankOf(p.feathers)]],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the night fits, in turn from session to session: the first
   * night, a Płomień, Koszmar banished, many Zmory, Sen never ran out, a long vigil, a passed
   * lullaby, a new rank; else Psalm 127:2.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('mat18.10');
    if (this.flames > 0) fit.push('psa34.7');
    if (this.koszmar === 'banished') fit.push('jhn1.5');
    if (this.score >= RULES.many) fit.push('psa91.5');
    if (this.started && this.stirs === 0 && this.t >= 30) fit.push('pro3.24');
    if (this.maxHold >= RULES.longHold) fit.push('psa121.4');
    if (this.passedRests > 0) fit.push('psa4.8');
    if (this.rankUp >= 0) fit.push('heb1.14');
    fit.push('psa127.2');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.rankUp >= 0) add(0, t('hl.rank', { name: RANKS[this.rankUp] }));
    if (this.koszmar === 'banished') add(1, t('hl.koszmar'));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(2, t('hl.record', { zmory: zmoryText(this.score) }));
    if (this.stirs === 0 && this.score > 0) add(3, t('hl.calm'));
    if (this.flames) add(4, t('hl.flames', { n: this.flames }));
    if (this.gifts.length) add(5, t('hl.gifts', { list: [...new Set(this.gifts)].map(id => giftById(id).name).join(', ') }));
    if (this.bestCombo >= RULES.comboAt[0]) add(6, t('hl.combo', { n: this.bestCombo }));
    if (this.blindShare >= 0) add(7, t('hl.blind', { n: this.blindShare }));
    if (this.dayGiftNow) add(8, t('hl.dayGift', { feathers: feathersText(this.dayGiftNow) }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
