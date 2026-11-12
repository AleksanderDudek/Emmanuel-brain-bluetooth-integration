/**
 * Anioł Stróż's night, without the DOM or the canvas (so every rule is unit-tested): the Zmory on
 * the line across the room, the strikes, the combo ladder and the perfect window, the ink drops, the
 * aura, the Płomień and its Skrzydła ognia, Sen and the lullaby, the levels and the gifts of the
 * night, the blocks, the dream's great nightmare at the end, Pan Guzik's lines and the coach marks,
 * the meta (meta.ts) and the session's numbers.  All numbers are in rules.ts (re-exported here).
 *
 * The hands strike: a tap on the left or right third (←/→, A/D) sweeps that side with light and hits
 * the nearest thing in reach (a Zmora, or an ink drop, which flies back at its Kleks); the middle
 * third and Space strike the side whose Zmora is nearer.  A strike with nothing in reach is a whiff
 * (a short recovery, the combo resets; in the lullaby it is a note of the harp instead).  A hit whose
 * target has just come into reach — its near edge in the reach's outer band — is perfect: it counts
 * twice on the combo and pays a feather more.  The combo climbs a ladder of ×2…×5 feathers.
 *
 * The band only adds:
 *   Czuwanie (push)    after a lead-in the aura's radius is auraMin + level × auraExtra: inside it
 *                      the Zmory slow down, take light in proportion to how far the level stands
 *                      above the threshold, and their armour cracks while it stands above; a held
 *                      focus (5 s Mendi / 3 s HALO) fills the Płomień, which banishes every Zmora
 *                      and gives 5 s of Skrzydła ognia (every strike pierces its side and hits double).
 *   Kołysanka (rest)   the Zmory draw back into the dark (a slow trickle stays); calm lights stars
 *                      in the child's dream: Sen comes back and feathers fall; a passed one pays more.
 *   Mgła snu (blind)   every 4th Czuwanie from the 3rd session: no aura, the trace veiled; at its end
 *                      the block's last 15 s become a dawn burst of the aura's strength, all at once.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the aura rests at its smallest and the stars wait; the block clock runs on.
 *
 * Grace: a Zmora that reaches the bed only dims Sen (and breaks the combo); when Sen runs out the
 * child stirs, the angel comforts it, the Zmory near the bed scatter and Sen comes back to half.  The
 * child is never harmed and nothing ends the night early.  Armour also breaks after three bounces,
 * so no Zmora needs the band.  A level-up offers three gifts while the night goes on in slow motion.
 *
 * Each session is the next night of the campaign: three nights a dream (the room, the attic, the
 * forest, the sea, the clouds), each dream bringing its own kinds and its own great nightmare at the
 * night's end, with telegraphed moves and a second phase.  The headline is the Zmory banished this
 * session, counted live.
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome, Headline, SignalPhase } from '../kit/types';
import { CHAPTERS, RANKS, TIPS, TOLD, ZMORY, bossName, chapterName, giftById, type BossKind, type Chapter, type GiftId, type ZKind } from './content';
import { feathers as feathersText, t, unit, zmory as zmoryText, type Key } from './i18n';
import { bestFor, chapterOf, giftPool, giveStars, lenKey, nightInChapter, rankOf, type AniolProgress } from './meta';
import { RULES, span } from './rules';
import { LINES, URGENT, WHO, line, type Moment } from './talk';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';
export type Side = -1 | 1;
/** How the aura looks: the faint candle, live, waiting out the band's delay, grey without signal, the blind fog, the lamp's. */
export type AuraLook = 'candle' | 'live' | 'wait' | 'grey' | 'blind' | 'lamp';
/** How a Zmora left the night. */
export type Via = 'strike' | 'aura' | 'flame' | 'burst' | 'shield' | 'dawn' | 'deflect' | 'boss';

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
  /** armour of shadow (the Pancerna) and how far it has cracked (0..1) */
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
  /** the Fikołek's (and a boss's hop) flight over the bed: seconds left, where it began (signed u) and lands */
  flip: number;
  flipFrom: number;
  flipTo: number;
  /** the Kleks's spit clock and wind-up (s left) */
  spitT: number;
  wind: number;
  /** the Ciągutek holds on at the bed */
  grab: boolean;
  /** the dream's great nightmare (its moves are the boss's) */
  boss: boolean;
}

/** An ink drop: flying in at the bed (dir −1) or struck back at its Kleks (dir +1). */
export interface Drop { id: number; side: Side; d: number; z: number; dir: -1 | 1; src: number; t: number }

export type BossMove = 'enter' | 'walk' | 'idle' | 'wind' | 'dash' | 'open' | 'back' | 'hop' | 'sea';
export interface BossStep { m: BossMove; dur: number; act?: 'spit' | 'dash' | 'feint' }
export interface Boss {
  kind: BossKind;
  id: number;
  phase: 0 | 1;
  move: BossMove;
  act: BossStep['act'];
  t: number;
  dur: number;
  q: BossStep[];
  /** the Ośmiornica's next arm (s) and the routines the Burza has run */
  armT: number;
  n: number;
}

/** Where a coach mark points (`mid`: the middle pad, `sheet`: the gift choice's title). */
export type CoachAt = { z: number } | { ui: 'aura' | 'flame' | 'bubble' | 'combo' | 'reachL' | 'reachR' | 'mid' | 'sheet' } | null;

export type SimEvent =
  | { type: 'spawn'; id: number; kind: ZKind; side: Side }
  | { type: 'strike'; side: Side; hit: boolean; spear: boolean }
  | { type: 'hit'; id: number; kind: ZKind; side: Side; d: number; z: number; left: number; combo: number; perfect: boolean }
  | { type: 'bounce'; id: number; side: Side; d: number }
  | { type: 'crack'; id: number; side: Side; d: number }
  | { type: 'banish'; id: number; kind: ZKind; side: Side; d: number; z: number; via: Via; feathers: number; n: number }
  | { type: 'split'; id: number; side: Side; d: number }
  | { type: 'flip'; id: number; side: Side }
  | { type: 'grab'; id: number; side: Side }
  | { type: 'spit'; id: number; side: Side; d: number }
  | { type: 'deflect'; id: number; side: Side; d: number }
  | { type: 'splash'; id: number; side: Side; sen: number }
  | { type: 'whiff'; side: Side }
  | { type: 'harp'; side: Side; n: number }
  | { type: 'combo'; n: number; mult: number }
  | { type: 'close'; side: Side; d: number; n: number }
  | { type: 'touch'; id: number; kind: ZKind; side: Side; sen: number }
  | { type: 'shield'; side: Side }
  | { type: 'stir' }
  | { type: 'flame'; n: number }
  | { type: 'glory'; on: boolean }
  | { type: 'level'; level: number; options: GiftId[] }
  | { type: 'gift'; id: GiftId; auto: boolean }
  | { type: 'star'; n: number }
  | { type: 'restPass'; feathers: number }
  | { type: 'burst'; share: number; r: number; n: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  /** the judged window's share on the asked side and the share it needed */
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; stars: number }
  | { type: 'boss'; what: 'come' | 'wind' | 'dash' | 'counter' | 'hop' | 'turn' | 'phase' | 'hurt' | 'banished' | 'fled'; side: Side; kind: BossKind; feint?: boolean }
  | { type: 'finale' }
  | { type: 'dawn'; stars: number }
  | { type: 'dayGift'; n: number }
  | { type: 'rank'; rank: number }
  | { type: 'story'; kind: 'open' | 'chapter'; chapter: number; night: number }
  | { type: 'say'; who: 'bear' | 'child'; text: string; moment: Moment }
  | { type: 'coach'; key: Key; at: CoachAt };

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

/** The finale's length: the great nightmare needs room in sessions of 2 min and more. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/**
 * The night's blocks.  A first-ever session opens with the warm-up "Pierwsza warta" (30 s in 5 and
 * 10 min, 20 s in 3, 6 s in a 40 s test); then Czuwanie / Kołysanka pairs (24 ± 4 s and 22 ± 3 s,
 * scaled to end on time, jittered only when there is room) ending with a lullaby, leaving the
 * finale's seconds to the great nightmare.  No block under 12 s.
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

/** The combo ladder's multiplier of feathers: ×2 from 8 hits, ×3 from 20, ×4 from 40, ×5 from 70. */
export const comboMult = (combo: number): number => 1 + RULES.comboAt.filter(n => combo >= n).length;

/** The combo's next rung (null at the top) and the share of the way to it from the last one. */
export function comboRung(combo: number): { next: number | null; k: number } {
  const at = RULES.comboAt as readonly number[];
  const i = at.findIndex(n => combo < n);
  if (i < 0) return { next: null, k: 1 };
  const from = i === 0 ? 0 : at[i - 1];
  return { next: at[i], k: clamp((combo - from) / (at[i] - from)) };
}

/** The kinds a night can bring (weights): the dreams bring theirs in, one or two at a time. */
export function kindMix(night: number, pushIndex: number, firstSession: boolean): [ZKind, number][] {
  const ch = chapterOf(night);
  const mix: [ZKind, number][] = [['mara', 5], ['skoczek', 2]];
  if (night >= 1) mix.push(['widmo', 2]);
  if (night >= 2 || pushIndex >= 1) mix.push(['pancerna', firstSession ? 0.8 : 1.2]);
  if (ch >= 1) mix.push(['kleks', night === 3 ? 2.4 : 1.4]);
  if (night >= 4) mix.push(['roj', 1.1]);
  if (ch >= 2) mix.push(['fikolek', night === 6 ? 2.4 : 1.5]);
  if (night >= 7) mix.push(['szept', night === 7 ? 2.2 : 1.3]);
  if (ch >= 3) mix.push(['ciagutek', night === 9 ? 2.2 : 1.2]);
  return mix;
}

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

/** A line on screen: who says it, what, how long it has been up. */
export interface Said { who: 'bear' | 'child'; text: string; t: number; dur: number }

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
  /** the campaign's night this session plays (0-based), its dream */
  readonly night: number;
  readonly chapterIndex: number;
  readonly chapter: Chapter;
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
  private lastInput = 0;
  /** the warm-up's ghost hand: no touch for a while */
  hint = false;

  // the room
  readonly zmory: Zmora[] = [];
  readonly drops: Drop[] = [];
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
  hits = 0;
  perfects = 0;
  private perfectRun = 0;
  closeCalls = 0;
  /** Skrzydła ognia after a Płomień (s left) */
  glory = 0;

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
  private goodT = 0;
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

  // the great nightmare
  boss: Boss | null = null;

  // Pan Guzik and the coach marks
  said: Said | null = null;
  private sayQ: { moment: Moment; at: number } | null = null;
  private lastSay = -99;
  private readonly sayN: Partial<Record<Moment, number>> = {};
  private readonly coachQ: { key: Key; at: CoachAt; t: number }[] = [];
  private lastCoach = -99;

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
  nightStars = 0;
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
    this.night = p.night;
    this.chapterIndex = chapterOf(p.night);
    this.chapter = CHAPTERS[this.chapterIndex];
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
  private up(id: keyof AniolProgress['up']): number { return this.p.up?.[id] ?? 0; }
  /** the Płomień's hold, with the gift of a faster one and the tree */
  get flameNeed(): number { return this.flameBase * (this.taken.flame ? RULES.flameFast ** this.taken.flame : 1) * (1 - RULES.up.flame * this.up('flame')); }
  /** the sweep's reach (u), with the gifts and the tree */
  get reach(): number { return RULES.reach + RULES.reachStep * (this.taken.reach ?? 0) + RULES.up.reach * this.up('reach'); }
  /** the perfect window: the reach's outer band (u) */
  get perfectBand(): number { return RULES.perfect + RULES.up.perfect * this.up('perfect'); }
  get auraWide(): number { return (this.taken.aura ? RULES.auraWide ** this.taken.aura : 1) * (1 + RULES.up.aura * this.up('aura')); }
  /** what a touch at the bed dims, with the tree */
  private get dimK(): number { return 1 - RULES.up.sen * this.up('sen'); }
  get mult(): number { return comboMult(this.combo); }
  get levelProgress(): number { return clamp(this.xp / levelNeed(this.nightLevel)); }
  /** the share of the night gone (the Zmory grow quicker) */
  get nightShare(): number { return clamp(this.t / Math.max(1, this.plannedSec - this.finaleSec)); }
  get walking(): Zmora[] { return this.zmory.filter(z => z.state === 'walk'); }
  get nightNo(): number { return nightInChapter(this.night); }

  start(): void {
    if (this.started) return;
    this.started = true;
    const first = !this.p.seen.includes('story.open');
    if (first) this.p.seen.push('story.open');
    this.emit({ type: 'story', kind: first ? 'open' : 'chapter', chapter: this.chapterIndex, night: this.night });
    this.startBlock(0);
    this.say('open');
  }

  // ── the hands ───────────────────────────────────────────────────
  /** Can this Zmora be struck now (on the floor, not flying over the bed, not a boss out of the fight)? */
  private strikable(z: Zmora): boolean {
    if (z.state !== 'walk' || z.turning || z.flip > 0 || z.z > RULES.airHit) return false;
    if (z.boss && this.boss && (this.boss.move === 'sea' || this.boss.move === 'hop')) return false;
    return true;
  }

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
    const spear = !!this.taken.spear || this.glory > 0;
    const reach = this.reach + (this.glory > 0 ? 99 : spear ? RULES.spearReach : 0);
    // an ink drop flying in, in reach on this side, is struck back first when it is the nearer
    const drop = this.drops.filter(o => o.dir < 0 && o.side === s && o.d <= this.reach + 0.1).sort((a, b) => a.d - b.d)[0];
    const inReach = this.zmory.filter(z => z.side === s && this.strikable(z) && z.d - z.r <= reach).sort((a, b) => a.d - b.d);
    if (drop && (!inReach.length || drop.d <= inReach[0].d - inReach[0].r)) {
      this.emit({ type: 'strike', side: s, hit: true, spear });
      this.deflect(drop);
      return;
    }
    // without the spear only the nearest, and only inside the plain reach
    const targets = spear ? inReach : inReach.filter(z => z.d - z.r <= this.reach).slice(0, 1);
    if (!targets.length) {
      this.emit({ type: 'strike', side: s, hit: false, spear });
      if (this.restBlock) {
        this.emit({ type: 'harp', side: s, n: this.harpN++ });
        return;
      }
      this.recover = RULES.whiff;
      this.combo = 0;
      this.perfectRun = 0;
      this.emit({ type: 'whiff', side: s });
      this.coach('coach.whiff', { ui: s < 0 ? 'reachL' : 'reachR' });
      return;
    }
    this.emit({ type: 'strike', side: s, hit: true, spear });
    const dmg = (this.taken.double ? 2 : 1) * (this.glory > 0 ? 2 : 1);
    for (const z of targets) this.hitZ(z, dmg, true);
  }

  /**
   * What a strike on this side would do now, for the pads' tell: 0 a whiff (nothing in reach), 1 a hit (a
   * Zmora or an ink drop in reach), 2 a perfect hit (the nearest's near edge in the perfect band).  The
   * same reach as strike(): the spear and Skrzydła ognia reach further.
   */
  ready(side: Side): 0 | 1 | 2 {
    if (!this.started || this.phase === 'done') return 0;
    if (this.drops.some(o => o.dir < 0 && o.side === side && o.d <= this.reach + 0.1)) return 1;
    const reach = this.reach + (this.glory > 0 ? 99 : this.taken.spear ? RULES.spearReach : 0);
    let best: Zmora | null = null;
    for (const z of this.zmory) if (z.side === side && this.strikable(z) && z.d - z.r <= reach && (!best || z.d < best.d)) best = z;
    if (!best) return 0;
    const edge = best.d - best.r;
    if (!best.boss && !best.armoured && edge >= this.reach - this.perfectBand && edge <= this.reach + 1e-6) return 2;
    return 1;
  }

  /** The side whose Zmora (or ink drop) is nearest the bed (the facing side when the room is empty). */
  nearerSide(): Side {
    let best: { side: Side; d: number } | null = null;
    for (const z of this.zmory) {
      if (z.state !== 'walk' || z.turning || z.flip > 0) continue;
      if (z.boss && this.boss?.move === 'sea') continue;
      if (!best || z.d - z.r < best.d) best = { side: z.side, d: z.d - z.r };
    }
    for (const o of this.drops) if (o.dir < 0 && (!best || o.d < best.d)) best = { side: o.side, d: o.d };
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
    this.say('gift');
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
    if (this.glory > 0) {
      this.glory = Math.max(0, this.glory - dt);
      if (this.glory <= 0) this.emit({ type: 'glory', on: false });
    }
    this.brain(dt, w, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.dawn(false);
    this.spawner(w);
    if (this.boss) this.bossTick(w);
    this.walk(w);
    this.flyDrops(w);
    if (this.taken.shield && !this.shieldReady) {
      this.shieldT += w;
      if (this.shieldT >= RULES.shieldSec) this.shieldReady = true;
    }
    this.hint = this.phase === 'play' && this.block.kind === 'warmup' && t - this.lastInput >= RULES.idleHint;
    this.lookAround();
    this.talkTick(dt);
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
    // the aura's light on the Zmory inside it (a boss stands above it)
    for (const z of this.zmory) {
      z.inAura = false;
      if (z.state !== 'walk' || z.boss) continue;
      const inside = z.d - z.r <= this.auraR;
      if (live && inside) {
        z.inAura = true;
        if (z.armoured) {
          if (f.level > 0.5) {
            z.crack += R.crackRate * w;
            if (z.crack >= 1) this.breakArmour(z);
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
    // a good stretch of the signal: Pan Guzik notices
    if (live && f.level > 0.55) {
      this.goodT += dt;
      if (this.goodT >= 6) {
        this.goodT = -20;
        this.say('good');
      }
    } else if (this.goodT > 0) this.goodT = Math.max(0, this.goodT - dt);
    if (live && this.blockT >= this.lead + 1) this.coach('coach.aura', { ui: 'aura' });
    // the Płomień: a held focus fills it
    if (f.hold < this.lastHold - 0.5) this.nextFlame = this.flameNeed;
    this.lastHold = f.hold;
    if (live) this.maxHold = Math.max(this.maxHold, f.hold);
    const need = this.flameNeed;
    this.flameCharge = live && this.flameBlock < R.flameMax ? clamp((f.hold - (this.nextFlame - need)) / need) : approach(this.flameCharge, 0, dt, 0.6);
    if (live && this.flameCharge > 0.35) this.coach('coach.flame', { ui: 'flame' });
    if (live && f.hold >= this.nextFlame && this.flameBlock < R.flameMax) {
      this.flameBlock++;
      this.nextFlame = f.hold + need;
      this.flame();
    }
    // the lullaby: calm lights stars in the dream and brings Sen back
    if (play && b.kind === 'rest' && this.blockT >= this.starLead && f.reliable) {
      const gain = R.starGain * (1 + R.up.lull * this.up('lull'));
      this.sen = Math.min(1, this.sen + R.senGain * f.calm * dt);
      this.starP = Math.min(R.starMax, this.starP + gain * f.calm * dt);
      while (Math.floor(this.starP) > this.stars) {
        this.stars++;
        this.sen = Math.min(1, this.sen + R.starSen);
        this.gain(R.starFeathers);
        this.emit({ type: 'star', n: this.stars });
      }
    }
  }

  /** The Płomień: every Zmora in the room is banished at once, then Skrzydła ognia for a few seconds. */
  private flame(): void {
    let n = 0;
    for (const z of this.zmory) {
      if (z.state !== 'walk' || z.boss) continue;
      n += this.banish(z, 'flame');
    }
    this.drops.length = 0;
    this.flames++;
    this.stop = Math.max(this.stop, RULES.stopFlame);
    this.glory = RULES.glorySec;
    this.emit({ type: 'flame', n });
    this.emit({ type: 'glory', on: true });
    this.say('flame');
    this.coach('coach.glory', null);
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
    if (b.kind === 'rest' && this.blockT >= R.quietStart) this.coach('coach.rest', { ui: 'bubble' });
    if (b.kind === 'rest' && this.blockT >= 9 && this.blockT - dt < 9) this.say('mumble');
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
      this.goodT = 0;
      if (i > 0) this.say(b.blind ? 'blind' : 'push');
    } else if (b.kind === 'rest') {
      this.starP = 0;
      this.stars = 0;
      // the lullaby: the Zmory draw back into the dark, the ink drops dry up
      for (const z of this.zmory) if (z.state === 'walk' && !z.boss) {
        z.state = 'back';
        z.grab = false;
      }
      this.drops.length = 0;
      this.spawnT = Math.max(this.spawnT, RULES.spawnRest * 0.6);
      this.say('rest');
    }
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  /** The block's strategy — what to do in the head, nothing else (the banner and the gauge say what it drives). */
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
    this.p.pushes = Math.max(this.p.pushes, this.pushesBase + this.pushesBegun);
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need, stars: b.kind === 'rest' ? this.stars : 0 });
  }

  /** The blind block's end: its focus as a burst of the aura's strength, all at once. */
  private dawnBurst(share: number): void {
    const r = auraFor(share, this.auraWide);
    let n = 0;
    for (const z of this.zmory) {
      if (z.state !== 'walk' || z.boss || z.d - z.r > r) continue;
      if (z.armoured && share < 0.5) continue;
      n += this.banish(z, 'burst');
    }
    this.burstT = RULES.burstSec;
    this.burstR = r;
    this.emit({ type: 'burst', share, r, n });
  }

  // ── the Zmory ───────────────────────────────────────────────────
  /** Which kind steps out next: the dream's mix, the blocks of the night. */
  kindFor(): ZKind {
    const b = this.block;
    if (this.phase !== 'play' || b.kind !== 'push') return 'mara';
    const pushI = this.plan.slice(0, this.blockIndex).filter(x => x.kind === 'push').length;
    const mix = kindMix(this.night, pushI, this.session === 1);
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
    return (1 + RULES.nightRamp * this.nightShare) * (1 + RULES.nightsRamp * Math.min(RULES.nightsMax, Math.max(this.session - 1, this.night)));
  }

  spawn(kind: ZKind, side: Side, d: number = RULES.edge, emerged = false): Zmora {
    const s = ZMORY[kind];
    const z: Zmora = {
      id: this.nextId++, kind, side, d, z: 0, hp: s.hp, maxHp: s.hp, r: s.r, armoured: kind === 'pancerna', crack: 0,
      speed: s.speed * this.speedK, age: emerged ? RULES.emerge : 0, state: 'walk', hop: this.rng() * RULES.hopGround,
      knockV: 0, hitT: 0, inAura: false, burn: 0, phaseHits: 0, turning: false, turnT: 0,
      flip: 0, flipFrom: 0, flipTo: 0, spitT: RULES.spitEvery * 0.5, wind: 0, grab: false, boss: false,
    };
    this.zmory.push(z);
    this.emit({ type: 'spawn', id: z.id, kind, side });
    if ((TOLD as readonly ZKind[]).includes(kind)) {
      const fresh = !this.p.seen.includes(`coach.k.${kind}`);
      this.coach(`coach.k.${kind}` as Key, { z: z.id });
      if (fresh && this.session > 1) this.say('fresh');
    }
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
      // a flight over the bed (the Fikołek, a boss's hop): signed position from one side to the other
      if (z.flip > 0) {
        const dur = z.boss ? R.hopSec : R.flipSec;
        z.flip = Math.max(0, z.flip - w);
        const k = 1 - z.flip / dur;
        const x = z.flipFrom + (z.flipTo - z.flipFrom) * k;
        z.side = (x < 0 ? -1 : 1) as Side;
        z.d = Math.abs(x);
        z.z = (z.boss ? 1.2 : R.flipHigh) * Math.sin(Math.PI * k);
        continue;
      }
      if (z.state === 'back' || z.turning) {
        z.d += R.backSpeed * w;
        z.z = Math.max(0, z.z - 3 * w);
        if (z.boss && z.turning) {
          if (z.d >= R.edge) {
            z.turnT += w;
            if (z.turnT >= R.koszmarTurn) {
              z.turning = false;
              z.turnT = 0;
              const left = z.side;
              z.side = -z.side as Side;
              z.d = R.koszmarBack + 0.8;
              z.age = 0;
              z.phaseHits = 0;
              this.emit({ type: 'boss', what: 'turn', side: z.side, kind: this.boss?.kind ?? 'koszmar' });
              if (this.boss && this.boss.phase > 0) this.spawn('mara', left, R.edge - 0.4);
            }
          }
          continue;
        }
        if (z.d >= R.wall) z.state = 'gone';
        continue;
      }
      // a boss that is not Koszmar moves by its own steps (bossTick)
      if (z.boss && this.boss && this.boss.move !== 'walk') continue;
      // a hit's push back
      if (z.knockV > 0.01) {
        z.d = Math.min(R.edge, z.d + z.knockV * w);
        z.knockV = approach(z.knockV, 0, w, R.knockTau);
      }
      if (z.grab) {
        this.sen = Math.max(0, this.sen - R.grabDim * this.dimK * w);
        if (this.sen <= 0) this.stir();
        continue;
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
      } else if (z.kind === 'kleks' && z.d <= R.kleksStop) {
        // the Kleks stops out of reach, puffs up (the tell) and spits a drop of ink at the bed
        z.d = Math.max(z.d, R.kleksStop - 0.01);
        if (z.wind > 0) {
          z.wind = Math.max(0, z.wind - w);
          if (z.wind <= 0) this.spitDrop(z, z.d - z.r);
        } else {
          z.spitT -= w * (rest ? 0 : 1);
          if (z.spitT <= 0) {
            z.spitT = R.spitEvery;
            z.wind = R.spitWind;
          }
        }
      } else {
        const fast = z.boss && this.boss && this.boss.phase > 0 ? R.phaseFast : 1;
        z.d -= z.speed * slow * fast * w;
      }
      if (z.d - z.r <= R.bedHalf) this.touch(z);
    }
    // the gone ones leave the list
    let n = 0;
    for (const z of this.zmory) if (z.state !== 'gone') this.zmory[n++] = z;
    this.zmory.length = n;
  }

  // ── ink drops ───────────────────────────────────────────────────
  private spitDrop(z: Zmora, d: number): void {
    const o: Drop = { id: this.nextId++, side: z.side, d, z: 0.6, dir: -1, src: z.id, t: 0 };
    this.drops.push(o);
    this.emit({ type: 'spit', id: o.id, side: o.side, d });
  }

  private deflect(o: Drop): void {
    o.dir = 1;
    o.t = 0;
    this.combo++;
    this.hits++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.stop = Math.max(this.stop, RULES.stopHit);
    this.emit({ type: 'deflect', id: o.id, side: o.side, d: o.d });
    this.comboStep();
  }

  private flyDrops(w: number): void {
    const R = RULES;
    let n = 0;
    for (const o of this.drops) {
      o.t += w;
      if (o.dir < 0) {
        o.d -= R.dropSpeed * w;
        o.z = 0.25 + 0.45 * Math.sin(clamp(o.d / R.kleksStop) * Math.PI * 0.9);
        if (o.d <= R.bedHalf) {
          this.sen = Math.max(0, this.sen - R.dropDim * this.dimK);
          this.combo = 0;
          this.emit({ type: 'splash', id: o.id, side: o.side, sen: this.sen });
          this.coach('coach.sen', { ui: 'bubble' });
          if (this.sen <= 0) this.stir();
          continue;
        }
      } else {
        o.d += R.dropBack * w;
        o.z = 0.6;
        const src = this.zmory.find(z => z.id === o.src && z.state === 'walk');
        if (src && src.side === o.side && o.d >= src.d - src.r) {
          this.hitZ(src, src.boss ? RULES.counter : 1, false, 'deflect');
          continue;
        }
        if (o.d >= R.wall) continue;
      }
      this.drops[n++] = o;
    }
    this.drops.length = n;
  }

  // ── hits ────────────────────────────────────────────────────────
  private breakArmour(z: Zmora): void {
    z.armoured = false;
    z.crack = 1;
    this.emit({ type: 'crack', id: z.id, side: z.side, d: z.d });
  }

  /** The combo climbed a rung of the ladder: say so (once per rung; a broken combo starts the ladder again). */
  private comboStep(): void {
    let reached = 0;
    for (const n of RULES.comboAt as readonly number[]) if (this.combo >= n) reached = n;
    if (reached < this.lastRung) this.lastRung = reached;
    if (reached > this.lastRung) {
      this.lastRung = reached;
      this.emit({ type: 'combo', n: this.combo, mult: comboMult(this.combo) });
      if (reached === RULES.comboAt[0]) this.coach('coach.combo', { ui: 'combo' });
      this.say('combo');
    }
  }
  private lastRung = 0;

  private hitZ(z: Zmora, dmg: number, struck: boolean, via: Via = 'strike'): void {
    const R = RULES;
    if (z.armoured) {
      if (this.glory > 0) this.breakArmour(z);
      else {
        z.knockV = R.bounceKnock;
        z.hitT = 0.12;
        z.crack = Math.min(1, z.crack + 1 / R.crackBounces);
        this.stop = Math.max(this.stop, R.stopHit);
        this.emit({ type: 'bounce', id: z.id, side: z.side, d: z.d });
        if (z.crack >= 1 - 1e-6) this.breakArmour(z);
        return;
      }
    }
    // the perfect window: its near edge has just come into reach
    const edge = z.d - z.r;
    const perfect = struck && !z.boss && edge >= this.reach - this.perfectBand && edge <= this.reach + 1e-6;
    const close = struck && edge - R.bedHalf <= R.closeCall;
    // a boss in its open moment takes a counter
    const counter = struck && z.boss && this.boss?.move === 'open';
    const hurt = counter ? Math.max(dmg, R.counter) : dmg;
    z.hp -= hurt;
    z.hitT = 0.16;
    z.knockV = z.kind === 'ciagutek' ? R.stickyKnock : z.boss ? R.knock * 0.6 : R.knock;
    if (z.grab) {
      z.knockV = R.stickyKnock;
    }
    this.combo += perfect ? 2 : 1;
    this.hits++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (perfect) {
      this.perfects++;
      this.perfectRun++;
      this.gain(R.perfectFeathers);
      if (this.perfectRun === 3) this.say('perfect');
    } else if (struck) this.perfectRun = 0;
    if (close && z.hp <= 1e-6) {
      this.closeCalls++;
      this.emit({ type: 'close', side: z.side, d: z.d, n: this.closeCalls });
    }
    this.comboStep();
    this.stop = Math.max(this.stop, R.stopHit);
    this.emit({ type: 'hit', id: z.id, kind: z.kind, side: z.side, d: z.d, z: z.z, left: Math.max(0, z.hp), combo: this.combo, perfect });
    if (this.hits === 3) this.coach('coach.middle', { ui: 'mid' });
    if (this.hits === 7) this.coach('coach.perfect', { ui: z.side < 0 ? 'reachL' : 'reachR' });
    if (z.boss) {
      this.bossHurt(z, hurt, counter);
      return;
    }
    if (z.hp > 1e-6) {
      if (z.kind === 'widmo') z.d = Math.min(R.edge, z.d + R.slip);
      if (z.kind === 'fikolek') {
        // over the bed to the other side
        z.flip = R.flipSec;
        z.flipFrom = z.side * z.d;
        z.flipTo = -z.side * R.flipTo;
        z.knockV = 0;
        this.emit({ type: 'flip', id: z.id, side: z.side });
      }
      return;
    }
    if (z.grab) z.grab = false;
    this.banish(z, via === 'deflect' ? 'deflect' : 'strike');
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
    const feathers = ZMORY[z.kind].feathers * n * (via === 'strike' || via === 'deflect' ? this.mult : 1);
    this.score += n;
    this.byKind[z.kind] = (this.byKind[z.kind] ?? 0) + n;
    this.stop = Math.max(this.stop, z.boss ? R.stopKoszmar : R.stopBanish);
    this.emit({ type: 'banish', id: z.id, kind: z.kind, side: z.side, d: z.d, z: z.z, via, feathers, n });
    this.gain(feathers);
    // an Ośmiornica's arm banished hurts the great nightmare behind it
    if (z.kind === 'ramie' && this.boss && via !== 'dawn') {
      const b = this.zmory.find(x => x.id === this.boss!.id && x.state === 'walk');
      if (b) {
        b.hp -= 2;
        b.hitT = 0.2;
        this.bossHurt(b, 2, false);
      }
    }
    if (z.boss) {
      this.koszmar = 'banished';
      this.emit({ type: 'boss', what: 'banished', side: z.side, kind: this.boss?.kind ?? 'koszmar' });
      this.say('bossDown');
      this.dawn(true);
    }
    return n;
  }

  /** A Zmora at the bed: the wing shield takes it, a Ciągutek holds on, else it dims Sen and fades. */
  private touch(z: Zmora): void {
    const R = RULES;
    this.combo = 0;
    this.perfectRun = 0;
    if (z.boss) {
      this.sen = Math.max(0, this.sen - R.bossDim * this.dimK);
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
    if (z.kind === 'ciagutek') {
      z.grab = true;
      z.d = R.bedHalf + z.r;
      this.touches++;
      this.emit({ type: 'grab', id: z.id, side: z.side });
      this.say('near');
      return;
    }
    z.state = 'gone';
    this.sen = Math.max(0, this.sen - ZMORY[z.kind].dim * this.dimK);
    this.touches++;
    this.emit({ type: 'touch', id: z.id, kind: z.kind, side: z.side, sen: this.sen });
    this.coach('coach.sen', { ui: 'bubble' });
    if (this.sen < 0.45) this.say('near');
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
      z.grab = false;
      if (z.boss) z.d = Math.max(z.d, R.koszmarBack);
      else if (z.d - z.r <= R.scatter) z.state = 'back';
    }
    this.drops.length = 0;
    this.emit({ type: 'stir' });
    this.say('stir');
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
    this.coach('coach.gift', { ui: 'sheet' });
  }

  // ── the finale: the dream's great nightmare ────────────────────
  private get long(): boolean { return this.plannedSec >= 120; }
  get koszmarPhase(): number { return this.long ? RULES.koszmarPhase.long : RULES.koszmarPhase.short; }

  /** The last block ended: the dream's great nightmare comes. */
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.phaseT = 0;
    this.flameCharge = 0;
    for (const z of this.zmory) if (z.state === 'walk') {
      z.state = 'back';
      z.grab = false;
    }
    this.drops.length = 0;
    const kind = this.chapter.boss;
    const side = this.sideFor();
    const R = RULES;
    const startD = kind === 'koszmar' ? R.koszmarBack + 0.8 : R.edge - 0.3;
    const k = this.spawn('koszmar', side, startD);
    k.boss = true;
    k.hp = k.maxHp = this.long ? R.koszmarHp.long : R.koszmarHp.short;
    this.koszmarId = k.id;
    this.koszmar = 'come';
    this.boss = { kind, id: k.id, phase: 0, move: kind === 'koszmar' ? 'walk' : 'enter', act: undefined, t: 0, dur: 0, q: [], armT: 1, n: 0 };
    if (kind === 'osmiornica') {
      // the body rises out of the sea behind the bed: out of reach, its arms come from both sides
      k.d = 0.01;
      this.boss.move = 'sea';
      this.boss.dur = 999;
    }
    this.emit({ type: 'finale' });
    this.emit({ type: 'boss', what: 'come', side, kind });
    this.coach(`coach.boss.${kind}` as Key, { z: k.id });
    this.say('boss');
  }

  /** The boss's next steps, by its kind and phase. */
  private bossPlan(b: Boss): BossStep[] {
    const R = RULES;
    const fast = b.phase > 0 ? 1 / R.phaseFast : 1;
    const spit = (): BossStep[] => [{ m: 'idle', dur: 0.6 * fast }, { m: 'wind', dur: R.spitWind * fast, act: 'spit' }];
    const dash = (): BossStep[] => {
      const feint = b.phase > 0 && this.rng() < 0.55;
      const steps: BossStep[] = [{ m: 'idle', dur: R.dashIdle * fast }, { m: 'wind', dur: R.dashWind * (feint ? 0.55 : 1) * fast, act: feint ? 'feint' : 'dash' }];
      if (feint) steps.push({ m: 'hop', dur: R.hopSec * 0.6 }, { m: 'wind', dur: 0.5, act: 'dash' });
      steps.push({ m: 'dash', dur: R.dashGo }, { m: 'open', dur: R.dashOpen * (b.phase > 0 ? 0.85 : 1) }, { m: 'back', dur: 9 });
      return steps;
    };
    switch (b.kind) {
      case 'kufer': return b.phase > 0 ? [...spit(), ...spit(), { m: 'hop', dur: R.hopSec }] : [...spit(), ...spit()];
      case 'wilk': return dash();
      case 'burza': {
        b.n++;
        if (b.phase > 0) return b.n % 2 ? [{ m: 'sea', dur: 5 }] : dash();
        return b.n % 3 === 0 ? [...spit(), ...spit()] : dash();
      }
      default: return [{ m: 'sea', dur: 999 }];
    }
  }

  /** The boss's own clock: its steps, their tells, the moments it can be struck. */
  private bossTick(w: number): void {
    const b = this.boss!, R = RULES;
    if (this.phase !== 'finale') return;
    const z = this.zmory.find(x => x.id === b.id && x.state === 'walk');
    if (!z) return;
    if (b.move === 'walk') return;   // Koszmar walks by the old rules (walk())
    b.t += w;
    if (b.move === 'enter') {
      const to = b.kind === 'kufer' ? R.bossStand : R.dashFrom;
      z.d = Math.max(to, z.d - z.speed * 1.4 * w);
      if (z.d <= to + 1e-3) this.nextStep(b, z);
      return;
    }
    if (b.move === 'sea') {
      // the arms: one side after the other, both at once in the second phase
      b.armT -= w;
      if (b.armT <= 0) {
        b.armT = R.armEvery * (b.phase > 0 ? 1.15 / R.phaseFast : 1);
        const s = this.sideFor();
        this.spawn('ramie', s, R.edge - 0.2);
        if (b.phase > 0) this.spawn('ramie', -s as Side, R.edge - 0.2);
      }
      if (b.kind === 'burza') z.d = Math.max(R.bossStand, z.d);
      if (b.t >= b.dur) this.nextStep(b, z);
      return;
    }
    if (b.move === 'hop') {
      if (z.flip <= 0) this.nextStep(b, z);
      return;
    }
    if (b.move === 'dash') {
      const open = R.bedHalf + z.r + 0.35;
      z.d = Math.max(open, z.d - ((R.dashFrom - open) / R.dashGo) * w);
      if (b.t >= b.dur) this.nextStep(b, z);
      return;
    }
    if (b.move === 'open') {
      if (b.t >= b.dur) {
        // not struck in time: it reaches the bed, then runs back
        this.sen = Math.max(0, this.sen - R.bossDim * this.dimK);
        this.combo = 0;
        this.touches++;
        this.emit({ type: 'touch', id: z.id, kind: z.kind, side: z.side, sen: this.sen });
        if (this.sen <= 0) this.stir();
        this.nextStep(b, z);
      }
      return;
    }
    if (b.move === 'back') {
      z.d += R.backSpeed * 1.6 * w;
      if (z.d >= R.dashFrom) {
        z.d = R.dashFrom;
        if (this.rng() < 0.5) z.side = -z.side as Side;
        this.nextStep(b, z);
      }
      return;
    }
    if (b.t >= b.dur) {
      if (b.move === 'wind' && b.act === 'spit') this.spitDrop(z, z.d - z.r);
      this.nextStep(b, z);
    }
  }

  private nextStep(b: Boss, z: Zmora): void {
    if (!b.q.length) b.q = this.bossPlan(b);
    const s = b.q.shift()!;
    b.move = s.m;
    b.act = s.act;
    b.dur = s.dur;
    b.t = 0;
    if (s.m === 'wind') this.emit({ type: 'boss', what: 'wind', side: z.side, kind: b.kind, feint: s.act === 'feint' });
    if (s.m === 'dash') this.emit({ type: 'boss', what: 'dash', side: z.side, kind: b.kind });
    if (s.m === 'hop') {
      z.flip = RULES.hopSec;
      z.flipFrom = z.side * z.d;
      z.flipTo = -z.side * z.d;
      this.emit({ type: 'boss', what: 'hop', side: -z.side as Side, kind: b.kind });
    }
    if (s.m === 'back') z.knockV = 0;
    if (s.m === 'sea') b.armT = Math.min(b.armT, 0.8);
  }

  /** The boss took light: its second phase at half, a counter throws it back. */
  private bossHurt(z: Zmora, hurt: number, counter: boolean): void {
    const b = this.boss;
    if (!b) return;
    if (z.hp <= 1e-6) {
      this.banish(z, 'strike');
      return;
    }
    this.emit({ type: 'boss', what: counter ? 'counter' : 'hurt', side: z.side, kind: b.kind });
    if (b.phase === 0 && z.hp <= z.maxHp * RULES.phaseAt) {
      b.phase = 1;
      b.q = [];
      this.emit({ type: 'boss', what: 'phase', side: z.side, kind: b.kind });
      this.say('phase');
    }
    if (b.kind === 'koszmar') {
      z.phaseHits++;
      if (z.phaseHits >= this.koszmarPhase) {
        z.turning = true;
        z.turnT = 0;
      }
      return;
    }
    if (counter || b.move === 'dash') {
      b.q = b.q.filter(s => s.m !== 'open' && s.m !== 'back');
      b.move = 'back';
      b.t = 0;
      b.dur = 9;
    }
    void hurt;
  }

  /** Dawn: the great nightmare banished, or the night's time is up (it flees, the next dawn always comes). */
  private dawn(banished: boolean): void {
    if (this.phase === 'done') return;
    for (const z of this.zmory) {
      if (z.state !== 'walk' && z.state !== 'back') continue;
      if (z.boss) {
        if (!banished) {
          z.state = 'back';
          z.turning = false;
          z.flip = 0;
          z.d = Math.max(z.d, 0.5);
          this.koszmar = 'fled';
          this.emit({ type: 'boss', what: 'fled', side: z.side, kind: this.boss?.kind ?? 'koszmar' });
        }
        continue;
      }
      if (z.state === 'walk') this.banish(z, 'dawn');
    }
    this.drops.length = 0;
    this.choice = null;
    this.pending = 0;
    this.phase = 'done';
    this.phaseT = 0;
    this.glory = 0;
    this.settle();
    this.emit({ type: 'dawn', stars: this.nightStars });
    this.sayQ = null;
    this.speak('end');
  }

  // ── Pan Guzik and the coach marks ───────────────────────────────
  /**
   * The view's word that its own cards are on screen (a story card, a toast): Pan Guzik and the coach marks
   * wait for them, so a phone never shows three bubbles over one angel.  Set by the view every frame.
   */
  busy = false;

  /** Is the screen free for a bubble: not in a block's first seconds (the banner), not in its telegraph, not in a choice, no card up. */
  get quiet(): boolean {
    if (this.choice || this.busy) return false;
    const b = this.block;
    if (!b || this.phase !== 'play') return true;
    return this.blockT >= RULES.quietStart && this.blockT < b.dur - RULES.telegraph;
  }

  private say(m: Moment): void {
    if (this.sayQ && URGENT.includes(this.sayQ.moment) && !URGENT.includes(m)) return;
    this.sayQ = { moment: m, at: this.t };
  }

  private speak(m: Moment): void {
    const n = (this.sayN[m] ?? 0) + 1;
    this.sayN[m] = n;
    const text = line(m, this.session + n - 1 + (m === 'mumble' ? this.night : 0));
    this.lastSay = this.t;
    this.said = { who: WHO[m], text, t: 0, dur: RULES.sayFor };
    this.emit({ type: 'say', who: WHO[m], text, moment: m });
  }

  private talkTick(dt: number): void {
    if (this.said) {
      this.said.t += dt;
      if (this.said.t >= this.said.dur) this.said = null;
    }
    const q = this.sayQ;
    if (q && this.quiet && !this.said) {
      const urgent = URGENT.includes(q.moment);
      if (urgent || this.t - this.lastSay >= RULES.sayGap) {
        this.sayQ = null;
        if (LINES[q.moment]) this.speak(q.moment);
      } else if (this.t - q.at > 6) this.sayQ = null;
    } else if (q && this.t - q.at > 9) this.sayQ = null;
    // coach marks: one at a time, a few seconds apart, not in a block's first seconds, never over the gifts
    // (the first Zmora's and the gifts' go at once; the rest wait for the view's cards to go)
    const first = this.coachQ[0]?.key;
    const now = first === 'coach.tap' || first === 'coach.gift';
    if (this.coachQ.length && (!this.choice || first === 'coach.gift') && (!this.busy || now) && this.t - this.lastCoach >= RULES.coachGap && (this.phase !== 'play' || this.blockT >= 1.5 || this.block.kind === 'warmup')) {
      const c = this.coachQ.shift()!;
      if (!this.fits(c)) {
        // stale (its Zmora gone, its block over, too long in the queue): it waits for another night
        this.p.seen = this.p.seen.filter(k => k !== c.key);
      } else {
        this.lastCoach = this.t;
        this.emit({ type: 'coach', key: c.key, at: c.at });
      }
    }
  }

  /** Does a waiting coach mark still fit the moment it was made for? */
  private fits(c: { key: Key; at: CoachAt; t: number }): boolean {
    if (this.t - c.t > 8) return false;
    if (c.at && 'z' in c.at) {
      const id = c.at.z;
      if (!this.zmory.some(z => z.id === id && z.state === 'walk')) return false;
    }
    if (c.key === 'coach.aura' || c.key === 'coach.flame') return this.sighted;
    if (c.key === 'coach.rest') return this.restBlock;
    if (c.key === 'coach.gift') return !!this.choice;
    return true;
  }

  /** A coach mark, once ever (the first session teaches the controls; later ones only what is new). */
  private coach(key: Key, at: CoachAt): void {
    if (this.p.seen.includes(key)) return;
    this.p.seen.push(key);
    if (key === 'coach.gift') {
      // the choice is open now: this one goes first, at once
      this.coachQ.unshift({ key, at, t: this.t });
      this.lastCoach = -99;
    } else this.coachQ.push({ key, at, t: this.t });
  }

  /** The first Zmora in reach: the first coach mark points at it. */
  private lookAround(): void {
    if (this.p.seen.includes('coach.tap')) return;
    const z = this.zmory.find(x => x.state === 'walk' && x.d - x.r <= this.reach + 0.3);
    if (z) {
      this.coach('coach.tap', { z: z.id });
      // it goes out at once (the first thing the player needs)
      this.lastCoach = -99;
    }
  }

  // ── the meta ────────────────────────────────────────────────────
  /** The night's stars: one for keeping it, one for the great nightmare banished, one for a calm sleep with a long combo. */
  starsNow(): number {
    return 1 + (this.koszmar === 'banished' ? 1 : 0) + (this.stirs === 0 && this.bestCombo >= RULES.starCombo ? 1 : 0);
  }

  /**
   * The night is settled once — at dawn, or when it ends early: the day's gift comes, the feathers
   * reach the angel's rank and the wallet, the campaign moves to the next night, the counters reach
   * the progress.
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
    p.wallet += this.feathers + this.dayGiftNow;
    p.flames += this.flames;
    p.perfects += this.perfects;
    if (this.koszmar === 'banished') p.koszmary++;
    if (this.stirs === 0) p.calmNights++;
    p.lastLen = this.plannedSec;
    this.nightStars = this.starsNow();
    giveStars(p, this.night, this.nightStars);
    p.night = Math.max(p.night, this.night + 1);
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

  /** What the block asks of the brain, for the runner's panel, banner and dock. */
  signal(): SignalPhase {
    const b = this.block;
    if (!this.started || this.phase !== 'play' || !b) return { want: 'free', blind: false };
    const left = Math.max(0, b.dur - this.blockT);
    const nb = this.next;
    const next = this.telegraphed ? (nb ? (nb.kind === 'push' ? 'focus' : nb.kind === 'rest' ? 'rest' : 'free') : 'free') : null;
    if (b.kind === 'warmup') return { want: 'free', blind: false, task: this.tip, left, next };
    return { want: b.kind === 'push' ? 'focus' : 'rest', blind: this.blind, task: this.tip, left, next };
  }

  /** The panel's gauge: the aura's reach in a Czuwanie (0.5 = the dotted ring), the lullaby's calm; null when blind or without signal. */
  meter(): number | null {
    if (!this.started || !this.reliable || this.phase !== 'play') return null;
    const b = this.block;
    if (b.kind === 'rest') return clamp(this.calm);
    if (b.kind !== 'push' || b.blind) return null;
    if (this.blockT < this.lead) return null;
    return clamp((this.auraR - RULES.auraMin) / (RULES.auraExtra * this.auraWide));
  }

  /** The headline: Zmory banished; under it the combo, else the record within reach, else the night of the dream. */
  headline(): Headline {
    let sub: string;
    if (this.combo >= 2) sub = t('sub.combo', { n: this.combo, m: this.mult });
    else if (this.bestBefore !== null && this.score < this.bestBefore && this.bestBefore - this.score <= 10) sub = t('sub.record', { n: this.bestBefore - this.score });
    else sub = t('sub.night', { n: this.nightNo, dream: chapterName(this.chapter.id) });
    return { value: this.score, sub };
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
      [t('stat.night', { dream: chapterName(this.chapter.id) }), String(this.nightNo)],
      [t('stat.level'), String(this.nightLevel + 1)],
      [t('stat.combo'), String(this.bestCombo)],
      [t('stat.perfect'), String(this.perfects)],
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
   * night, a Płomień, the great nightmare banished, many Zmory, Sen never ran out, a long vigil, a
   * passed lullaby, a new rank; else Psalm 127:2.
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
    const stars = this.settled ? this.nightStars : this.starsNow();
    add(0, t('hl.stars', { n: this.nightNo, dream: chapterName(this.chapter.id), stars: '★'.repeat(stars) + '☆'.repeat(3 - stars) }));
    if (this.rankUp >= 0) add(1, t('hl.rank', { name: RANKS[this.rankUp] }));
    if (this.koszmar === 'banished') add(2, t('hl.boss', { name: bossName(this.chapter.boss) }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(3, t('hl.record', { zmory: zmoryText(this.score) }));
    else if (this.bestBefore !== null && this.score < this.bestBefore) add(3, t('hl.toRecord', { zmory: zmoryText(this.bestBefore - this.score) }));
    const rung = comboRung(this.bestCombo);
    if (rung.next !== null && rung.next - this.bestCombo <= 4 && this.bestCombo >= 4) add(4, t('hl.comboNear', { n: rung.next - this.bestCombo, m: comboMult(rung.next) }));
    else if (this.bestCombo >= RULES.comboAt[0]) add(4, t('hl.combo', { n: this.bestCombo }));
    if (this.closeCalls > 0) add(5, t('hl.close', { n: this.closeCalls }));
    if (this.stirs === 0 && this.score > 0) add(6, t('hl.calm'));
    if (this.perfects > 0) add(7, t('hl.perfect', { n: this.perfects }));
    if (this.flames) add(8, t('hl.flames', { n: this.flames }));
    if (this.blindShare >= 0) add(9, t('hl.blind', { n: this.blindShare }));
    if (this.dayGiftNow) add(10, t('hl.dayGift', { feathers: feathersText(this.dayGiftNow) }));
    if (this.gifts.length) add(11, t('hl.gifts', { list: [...new Set(this.gifts)].map(id => giftById(id).name).join(', ') }));
    const out = notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
    // the story's closing line: where the child's dream goes next
    const nextNight = this.night + 1;
    const nextCh = chapterOf(nextNight);
    out.push(nextCh !== this.chapterIndex ? t('hl.nextDream', { dream: chapterName(CHAPTERS[nextCh].id) }) : t('hl.sameDream', { dream: chapterName(this.chapter.id) }));
    return out;
  }
}
