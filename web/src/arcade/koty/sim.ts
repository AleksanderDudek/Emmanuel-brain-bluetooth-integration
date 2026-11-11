/**
 * Kocia straż's rules without a screen: an idle merge shooter after Idle Cat Gunner.  The abbey's cats
 * sit on cushions along the old wall and fire their toys by themselves at the pests that come into the
 * field (the vineyard, the granary, the orchard, the kitchen garden, the pond, the scriptorium) and settle
 * on the goods to nibble; a hit startles, and when a pest's courage runs out it bolts off and Brother
 * Anselm pays the cats in fish.  A stage is a wave of pests; every fifth stage the place's chief comes,
 * with a trick and a patience of his own — chased off in time, the watch moves on to the next place; too
 * slow, he backs off and comes back after a few more pests (nothing is ever lost).
 *
 * The hands run the economy: drag a toy onto one of the same grade to merge them into a random toy of
 * the next grade, onto a cat to hand it over (a different grade swaps); buy Celność (power), Zwinne łapy
 * (pace), Pełna miska (fish) and toys along the bottom; the helping paw (Space) merges the next pair,
 * hands out the best toy and buys the cheapest; a tap on a pest makes it the squad's target, on a cat
 * pets it (it purrs and fires faster), on the empty field it goes "psst!".
 *
 * The band: in a sighted push block (Czujność) the squad's pace is × (1 + 2 · level) — ×2 at the
 * threshold, ×3 well above it — and their eyes turn gold; a held focus fills the Great Hunt (every cat
 * pounces at once).  In a rest block (Drzemka) everyone naps: no pests come, the cats and the pests doze,
 * calm ripens the grapes into fish and the nap ends with a toy in the chest.  A blind push (Zmierzch)
 * fights at ×1 and tells, at its end, how alert the cats were — that share fills the hunt at once.
 *
 * No DOM: the view and the sound read the state and the event queue (`take()`).
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  BOSSES, FAMS, FAM_IDS, LINES, PESTS, TIPS, big, bossName, catName, catSpec, fishText, gradeName, famName, goldText, placeName, stageInfo,
  toyHit, toyDps, type BossId, type BossSpec, type CatId, type CatSpec, type FamId, type Pattern, type PestId, type PestSpec,
  type PlaceId, type Toy, type Trick,
} from './content';
import { pestsText, t, unit } from './i18n';
import {
  aimMult, bestFor, bowlMult, canVintage, costOf, holdVintage, joinCats, lenKey, noteToy, pawsMult, perks, shopGrade, slotCount,
  vintageGold, type BuyId, type KotyProgress, type Perks,
} from './meta';
import { RULES, span } from './rules';
import { Talk } from './talk';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';
export type Coach = 'squad' | 'merge' | 'merge2' | 'equip' | 'upgrade' | 'eye' | 'hunt' | 'nap' | 'boss' | 'paw' | 'target' | 'pet' | 'vintage' | 'dusk' | 'full';
export type CoachAt =
  | { kind: 'field'; x: number; y: number } | { kind: 'chest'; i: number } | { kind: 'slot'; i: number }
  | { kind: 'up'; id: BuyId } | { kind: 'eye' } | { kind: 'paw' } | { kind: 'vintage' };

export interface Loc { kind: 'chest' | 'slot'; i: number }
export type PestState = 'come' | 'nibble' | 'flee';

export interface Pest {
  id: number; kind: PestId; spec: PestSpec;
  x: number; y: number; tx: number; ty: number;
  hp: number; max: number; state: PestState;
  t: number; hit: number; freeze: number; dir: number;
  vx: number; vy: number;
  elite: boolean; counted: boolean; seed: number;
  /** damage already on its way (the squad does not pile shots on a pest that is as good as gone) */
  pending: number;
  /** the cushion whose shot hit it last */
  by: number;
}

export type BossState = 'away' | 'enter' | 'here' | 'tele' | 'trick' | 'leave' | 'chased';
export interface Boss {
  id: BossId; spec: BossSpec; state: BossState; st: number;
  x: number; y: number; tx: number; ty: number;
  hp: number; max: number; patience: number; patienceMax: number;
  trickIn: number; hit: number; dir: number; visits: number; pending: number;
}

/** A pest's id for the boss (pests count up from 1). */
export const BOSS_TARGET = -1;

export interface Shot {
  id: number; slot: number; fam: FamId; pattern: Pattern;
  sx: number; sy: number; x: number; y: number; tx: number; ty: number;
  target: number; dmg: number; t: number; dur: number; crit: boolean; side: boolean;
  /** bounces left (the yarn), pests already hit by this chain */
  bounces: number; chain: number[];
}

export interface Beam { slot: number; sx: number; sy: number; tx: number; ty: number; t: number }
export type SplashKind = 'water' | 'bubble' | 'apple' | 'yarn' | 'psst' | 'pounce' | 'puff';
export interface Splash { x: number; y: number; r: number; t: number; kind: SplashKind }

export interface Cushion {
  i: number; cat: CatId | null; spec: CatSpec | null; toy: Toy | null;
  cool: number; shots: number; purr: number; petCool: number; recoil: number;
  /** the hunt's pounce: where it leaps and how far through it is (0..1) */
  leap: { x: number; y: number; t: number } | null;
}

export type StoryKind = 'open' | 'place' | 'year' | 'away' | 'trip';
export interface Story { kind: StoryKind; t: number; dur: number; place?: PlaceId; fish?: number; toy?: boolean; from?: number; cats?: CatId[]; stars?: number }
export interface Confirm { t: number; gold: number; from: number }
export type Step = 'wave' | 'boss' | 'farm';
export interface Wave { all: number; spawned: number; chased: number }
export type ToySource = 'shop' | 'nap' | 'boss' | 'elite' | 'found' | 'away' | 'merge';

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'finale' }
  | { type: 'done' }
  | { type: 'dusk'; share: number }
  | { type: 'spawn'; id: number; kind: PestId; elite: boolean }
  | { type: 'shot'; slot: number; fam: FamId; pattern: Pattern }
  | { type: 'hit'; x: number; y: number; dmg: number; crit: boolean; boss: boolean; fam: FamId | null }
  | { type: 'splash'; x: number; y: number; kind: SplashKind; r: number }
  | { type: 'chased'; x: number; y: number; kind: PestId; fish: number; elite: boolean }
  | { type: 'stage'; n: number; place: PlaceId; newPlace: boolean }
  | { type: 'boss'; id: BossId }
  | { type: 'bossTele'; trick: Trick }
  | { type: 'bossTrick'; trick: Trick }
  | { type: 'bossChased'; id: BossId; first: boolean; fish: number; stars: number }
  | { type: 'bossBacks'; id: BossId; near: boolean }
  | { type: 'merge'; at: Loc; toy: Toy; fresh: boolean }
  | { type: 'equip'; at: Loc }
  | { type: 'swap'; a: Loc; b: Loc }
  | { type: 'nope'; at: Loc | null }
  | { type: 'buy'; id: BuyId; level: number }
  | { type: 'cant'; id: BuyId }
  | { type: 'toy'; toy: Toy; source: ToySource; at: Loc | null; fresh: boolean }
  | { type: 'full' }
  | { type: 'huntReady' }
  | { type: 'hunt' }
  | { type: 'pounce'; slot: number; x: number; y: number }
  | { type: 'huntEnd' }
  | { type: 'napStart' }
  | { type: 'napEnd'; toy: Toy | null }
  | { type: 'ripe'; v: number }
  | { type: 'cat'; id: CatId }
  | { type: 'cushion'; n: number }
  | { type: 'pet'; slot: number }
  | { type: 'clap'; x: number; y: number; hit: boolean }
  | { type: 'target'; id: number }
  | { type: 'vintageReady' }
  | { type: 'vintage'; gold: number }
  | { type: 'story'; kind: StoryKind }
  | { type: 'coach'; what: Coach; at: CoachAt };

const NO_EVENTS: readonly SimEvent[] = [];
const cap1 = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

// ── pure rules ───────────────────────────────────────────────────
/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/** The last stretch without a block: 12 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/**
 * The session's blocks.  A first-ever session opens with the warm-up (30 s in 5 and 10 min, 20 s in
 * 3, 6 s in a 40 s test); then Czujność / Drzemka pairs (26 ± 4 s and 22 ± 3 s, scaled to end on time,
 * jittered only when there is room) ending with a nap, leaving the last stretch at the end.  No block
 * under 12 s.
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

/** Where a cushion sits along the wall (field u): the cats split around the gatehouse's eye in the middle. */
export function cushionX(i: number, n: number): number {
  const left = Math.ceil(n / 2), right = n - left;
  if (i < left) return 0.55 + (3.55 * (i + 0.5)) / left;
  return 5.9 + (3.55 * (i - left + 0.5)) / Math.max(1, right);
}

/** The pests a stage brings (the boss stage: a short wave before the chief). */
export function waveSize(stage: number): number {
  const s = stageInfo(stage);
  if (s.boss) return RULES.bossWave + s.round;
  return Math.round(RULES.waveBase + RULES.wavePer * (s.inPlace - 1) + RULES.waveRound * s.round);
}

/** A pest's courage at a stage (before an elite's ×). */
export const courage = (stage: number, kind: PestId): number => RULES.hp0 * PESTS[kind].hp * RULES.hpG ** (Math.max(1, stage) - 1);

/** A chief's courage at his stage. */
export function bossCourage(stage: number, id: BossId): number {
  const s = stageInfo(stage);
  return RULES.hp0 * RULES.hpG ** (s.n - 1) * RULES.bossK * BOSSES[id].hp * (1 + RULES.bossPlace * (s.placeIdx + s.round * RULES.places));
}

/** The fish a pest brings at a stage, before the bowl and the perks. */
export const pestFish = (stage: number, kind: PestId): number => RULES.fish0 * PESTS[kind].fish * RULES.fishG ** (Math.max(1, stage) - 1);

/** A random toy of a grade (the merge's luck, never bought). */
export const randomToy = (g: number, rnd: () => number): Toy => ({ fam: FAM_IDS[Math.floor(rnd() * FAM_IDS.length) % FAM_IDS.length], g: clamp(Math.floor(g), 1, RULES.grades) });

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: KotyProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
  /** now (ms since the epoch): the gift of the watch kept while away */
  now: number;
}

export class KotySim {
  readonly p: KotyProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  readonly talk: Talk;
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly holdNeed: number;
  private readonly restLead: number;
  readonly finaleSec: number;
  private readonly startMs: number;

  started = false;
  readonly session: number;
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  phase: Phase = 'play';
  t = 0;
  tip = '';
  story: Story | null = null;
  confirm: Confirm | null = null;

  // the field
  readonly pests: Pest[] = [];
  readonly shots: Shot[] = [];
  readonly beams: Beam[] = [];
  readonly splashes: Splash[] = [];
  readonly cushions: Cushion[] = [];
  boss: Boss | null = null;
  step: Step = 'wave';
  wave: Wave = { all: 0, spawned: 0, chased: 0 };
  private spawnT = 0.8;
  private nextId = 1;
  /** gifts waiting for room in the chest */
  readonly gifts: Toy[] = [];
  /** the player's target: a pest id, BOSS_TARGET, or 0 */
  target = 0;
  private targetT = 0;
  private clapCool = 0;
  /** hit-stop (s left) */
  stop = 0;
  timeScale = 1;

  // the band
  reliable = false;
  level = 0;
  calm = 0;
  calmShown = 0;
  /** the eased alertness level (0..1) and the squad's pace from it (×1…×3) */
  alertLevel = 0;
  alert = 1;
  /** above the threshold in a sighted push: the cats' eyes are gold */
  golden = false;
  /** the Great Hunt: charge 0..1, ready, seconds left of a hunt */
  charge = 0;
  huntReady = false;
  hunting = 0;
  private readyT = 0;
  private pounceT = 0;
  /** the nap: how asleep the field is (0..1); the fish ripened this nap */
  napK = 0;
  ripe = 0;
  private ripeTick = 0;
  maxHold = 0;
  private goodT = 0;
  private goodSaid = false;
  private relSec = 0;

  // the session's numbers
  score = 0;
  fishGained = 0;
  merges = 0;
  hunts = 0;
  bossesNow: BossId[] = [];
  /** the stars of each chief chased this session */
  starsNow: number[] = [];
  placesNow: PlaceId[] = [];
  catsNow: CatId[] = [];
  freshGrades: Toy[] = [];
  passedRests = 0;
  petted = 0;
  birds = 0;
  newPests: PestId[] = [];
  vintageGold = 0;
  awayFish = 0;
  /** the cats back from their trips this session */
  tripBack: CatId[] = [];
  duskShare = -1;
  stageStart: number;
  private settled = false;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  private readonly bestBefore: number | null;
  private buys = 0;
  private coachMergeT = 0;
  private vintageSaid = false;
  private fullSaid = false;
  private readonly away: { fish: number; toy: boolean } | null;

  constructor(init: SimInit) {
    const p = (this.p = init.progress);
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.holdNeed = RULES.holdNeed[band];
    this.restLead = RULES.restLead[band];
    this.finaleSec = finaleFor(init.plannedSec);
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.pushesBase = p.pushes;
    this.startMs = init.now;
    this.stageStart = p.stage;
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng);
    this.talk = new Talk(LINES, init.rng);
    // the watch kept while away: modest and capped
    const pk = perks(p);
    const awaySec = p.lastSeen > 0 ? (init.now - p.lastSeen) / 1000 : 0;
    if (this.session > 1 && awaySec >= RULES.awayMin) {
      const sec = Math.min(awaySec, pk.awayCapH * 3600);
      this.away = { fish: Math.round(this.fightIncome() * sec * pk.awayShare), toy: awaySec >= RULES.awayToy };
    } else this.away = null;
    this.syncCushions();
    this.newWave();
  }

  // ── views of the state ──────────────────────────────────────────
  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.phase === 'play'; }
  get pushBlock(): boolean { return this.block?.kind === 'push' && this.phase === 'play'; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.phase === 'play'; }
  get warmBlock(): boolean { return this.block?.kind === 'warmup' && this.phase === 'play'; }
  /** a sighted push past its lead-in: alertness answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get leadIn(): number { return this.lead; }
  /** everyone naps: a rest block */
  get napping(): boolean { return this.restBlock; }
  /** the world is held (a story card or the vintage's question) */
  get frozen(): boolean { return !!(this.story || this.confirm); }
  get stage(): number { return this.p.stage; }
  get info() { return stageInfo(this.p.stage); }
  get perks(): Perks { return perks(this.p); }
  get openSlots(): number { return slotCount(this.p); }
  get bossHere(): boolean { return !!this.boss && ['here', 'tele', 'trick'].includes(this.boss.state); }
  get bossImmune(): boolean {
    const b = this.boss;
    return !!b && b.state === 'trick' && (b.spec.trick === 'fly' || b.spec.trick === 'dig' || b.spec.trick === 'gust');
  }
  /** a wave's count for the corner: chased / all */
  get waveLeft(): number { return Math.max(0, this.wave.all - this.wave.chased); }
  get vintageOpen(): boolean { return canVintage(this.p); }
  get vintageNow(): number { return vintageGold(Math.max(this.p.stage, this.p.yearBest)); }
  get chestFull(): boolean { return this.p.chest.every(x => !!x); }

  /** The fish of a fox-sized pest at this stage, with the bowl and the perks. */
  fishOf(kind: PestId, stage = this.p.stage): number {
    return pestFish(stage, kind) * bowlMult(this.p.up.bowl) * this.perks.fish;
  }

  /** What the watch earns a second while fighting at par (a fox-sized pest every two seconds). */
  fightIncome(): number { return this.fishOf('liszka') * 0.5; }

  /** The cushions open now, their cats and toys (the toys live in the progress). */
  private syncCushions(): void {
    const n = this.openSlots;
    while (this.cushions.length < n) {
      this.cushions.push({ i: this.cushions.length, cat: null, spec: null, toy: null, cool: this.rng() * 0.5, shots: 0, purr: 0, petCool: 0, recoil: 0, leap: null });
    }
    this.cushions.length = n;
    for (const c of this.cushions) {
      c.cat = this.p.squad[c.i] ?? null;
      c.spec = c.cat ? catSpec(c.cat) : null;
      c.toy = this.p.slots[c.i] ?? null;
    }
  }

  /** A cushion's place on the field (u). */
  slotPos(i: number): { x: number; y: number } { return { x: cushionX(i, this.cushions.length || 1), y: RULES.FH - 0.35 }; }

  private gift(i: number): string | null { return this.cushions[i]?.spec?.gift ?? null; }
  private onWall(g: string): boolean { return this.cushions.some(c => c.spec?.gift === g); }

  /** A cushion's pace now (shots × this a second of its toy's cd). */
  paceOf(c: Cushion): number {
    let k = pawsMult(this.p.up.paws);
    const g = c.spec?.gift;
    if (g === 'quick') k *= 1.3;
    const nb = [this.cushions[c.i - 1], this.cushions[c.i + 1]].filter(x => x?.spec?.gift === 'purr').length;
    k *= 1.15 ** nb;
    if (c.purr > 0) k *= RULES.purrK;
    return k * this.alertFor(c);
  }

  /** Alertness for a cat: the golden-eyed one counts above the threshold more. */
  alertFor(c: Cushion): number {
    if (c.spec?.gift !== 'golden') return this.alert;
    const l = this.alertLevel;
    return 1 + RULES.alertK * (l < 0.5 ? l : 0.5 + (l - 0.5) * RULES.goldenK);
  }

  /** A cushion's hit, before the target's trait and the crit: toy × Celność × perks × courage. */
  hitOf(c: Cushion): number {
    if (!c.toy) return 0;
    let k = aimMult(this.p.up.aim) * this.perks.dmg;
    if (c.spec?.gift === 'brave') k *= 1.25;
    return toyHit(c.toy) * k;
  }

  /** The squad's damage a second at ×1 (the corner's strength, the balance tests). */
  squadDps(): number {
    let s = 0;
    for (const c of this.cushions) if (c.toy && c.cat) s += (this.hitOf(c) / FAMS[c.toy.fam].cd) * this.paceOf(c) / this.alertFor(c);
    return s;
  }

  // ── input ───────────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.session === 1) this.story = { kind: 'open', t: 0, dur: RULES.openSec };
    else if (this.away && (this.away.fish > 0 || this.away.toy)) {
      this.addFish(this.away.fish);
      this.awayFish = this.away.fish;
      if (this.away.toy) this.give(randomToy(shopGrade(this.p), this.rng), 'away');
      this.story = { kind: 'away', t: 0, dur: RULES.storySec, fish: this.away.fish, toy: this.away.toy };
      this.talk.ask('away', 3, 12);
    }
    // kitchen cats back from their trips, each with fish and a toy
    if (this.p.trips.length) {
      this.tripBack = this.p.trips.slice();
      this.p.trips = [];
      for (let i = 0; i < this.tripBack.length; i++) {
        this.addFish(this.fightIncome() * 90);
        this.give(randomToy(shopGrade(this.p) + 1, this.rng), 'away');
      }
      if (this.story?.kind === 'away') this.story.cats = this.tripBack;
      else if (!this.story) this.story = { kind: 'trip', t: 0, dur: RULES.storySec, cats: this.tripBack };
    }
    if (this.story) this.emit({ type: 'story', kind: this.story.kind });
    for (const id of joinCats(this.p)) this.catJoined(id);
    this.startBlock(0);
    this.talk.ask('open', 2, 12);
  }

  /** A tap on a story card or the vintage's question closes it (after a moment); true when consumed. */
  tap(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= 0.6) this.closeStory();
      return true;
    }
    if (this.confirm) return true;
    return false;
  }

  /** Space and Enter: close a card, release a ready hunt, or the helping paw. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const space = k === ' ' || k === 'Enter' || k === 'Spacebar';
    if (!down) return space;
    if (!space) return false;
    if (this.tap()) return true;
    if (this.huntReady && this.releaseHunt()) return true;
    this.paw();
    return true;
  }

  private closeStory(): void {
    this.story = null;
  }

  /** The toy at a place (null: empty or outside the open cushions). */
  toyAt(l: Loc): Toy | null {
    if (l.kind === 'chest') return this.p.chest[l.i] ?? null;
    if (l.i >= this.openSlots) return null;
    return this.p.slots[l.i] ?? null;
  }

  private setToy(l: Loc, toy: Toy | null): void {
    if (l.kind === 'chest') this.p.chest[l.i] = toy;
    else this.p.slots[l.i] = toy;
    this.syncCushions();
  }

  private validLoc(l: Loc): boolean {
    return l.kind === 'chest' ? l.i >= 0 && l.i < RULES.chest : l.i >= 0 && l.i < this.openSlots;
  }

  /**
   * A toy dropped somewhere: on an empty place it moves, on one of the same grade the two merge into a
   * random toy of the next grade (in the place dropped on), on another grade they swap.  True when it changed.
   */
  drop(from: Loc, to: Loc): boolean {
    if (!this.started || this.phase === 'done' || this.frozen) return false;
    if (!this.validLoc(from) || !this.validLoc(to) || (from.kind === to.kind && from.i === to.i)) return false;
    const a = this.toyAt(from), b = this.toyAt(to);
    if (!a) return false;
    if (!b) {
      this.setToy(to, a);
      this.setToy(from, null);
      this.emit(to.kind === 'slot' ? { type: 'equip', at: to } : { type: 'swap', a: from, b: to });
      this.afterToys();
      return true;
    }
    if (a.g === b.g && a.g < RULES.grades) {
      this.merge(from, to);
      return true;
    }
    this.setToy(to, a);
    this.setToy(from, b);
    this.emit(to.kind === 'slot' ? { type: 'equip', at: to } : { type: 'swap', a: from, b: to });
    this.afterToys();
    return true;
  }

  /** Two toys of a grade become one random toy of the next, in `to`. */
  private merge(from: Loc, to: Loc): void {
    const a = this.toyAt(from)!;
    const out = randomToy(a.g + 1, this.rng);
    this.setToy(from, null);
    this.setToy(to, out);
    this.merges++;
    this.p.merges++;
    const fresh = noteToy(this.p, out);
    if (fresh) this.freshGrades.push(out);
    this.emit({ type: 'merge', at: to, toy: out, fresh });
    if (this.merges === 1 || fresh || out.g >= 5) this.talk.ask('merge', 2, 5);
    // the first merge in the chest: now hand it to a cat
    if (to.kind === 'chest' && this.weakestSlot(out) >= 0) this.coach('equip', { kind: 'slot', i: this.weakestSlot(out) });
    this.afterToys();
  }

  /** Gifts waiting for room drop into the chest; the full chest is said once. */
  private afterToys(): void {
    while (this.gifts.length) {
      const i = this.p.chest.findIndex(x => !x);
      if (i < 0) break;
      const toy = this.gifts.shift()!;
      this.p.chest[i] = toy;
      this.emit({ type: 'toy', toy, source: 'nap', at: { kind: 'chest', i }, fresh: false });
    }
    this.syncCushions();
  }

  /** The open cushion whose toy is weakest (−1 when `than` beats none of them). */
  weakestSlot(than?: Toy): number {
    let best = -1, bestDps = Infinity;
    for (let i = 0; i < this.openSlots; i++) {
      if (!this.cushions[i]?.cat) continue;
      const toy = this.p.slots[i];
      const d = toy ? toyDps(toy) : 0;
      if (d < bestDps) { bestDps = d; best = i; }
    }
    if (best < 0) return -1;
    if (than && toyDps(than) <= bestDps) return -1;
    return best;
  }

  /**
   * A pair of the lowest grade (chest and open cushions); a cushion is preferred as the target.  With
   * `keepCats`, two toys both on cushions pair only while the chest has a toy to give the cat left empty.
   */
  firstPair(keepCats = false): { from: Loc; to: Loc } | null {
    const spare = this.p.chest.some(x => !!x);
    const all: Loc[] = [];
    for (let i = 0; i < this.openSlots; i++) all.push({ kind: 'slot', i });
    for (let i = 0; i < RULES.chest; i++) all.push({ kind: 'chest', i });
    const by = new Map<number, Loc[]>();
    for (const l of all) {
      const toy = this.toyAt(l);
      if (!toy || toy.g >= RULES.grades) continue;
      const list = by.get(toy.g) ?? [];
      list.push(l);
      by.set(toy.g, list);
    }
    const grades = [...by.keys()].sort((a, b) => a - b);
    for (const g of grades) {
      const list = by.get(g)!;
      if (list.length < 2) continue;
      // into a cushion from the chest (a cell frees, every cat keeps a toy); two cushions only when it must
      const slot = list.find(l => l.kind === 'slot');
      const chest = list.find(l => l.kind === 'chest');
      if (slot && chest) return { from: chest, to: slot };
      if (keepCats && !chest && !spare) continue;
      return { from: list[1], to: list[0] };
    }
    return null;
  }

  /** A tap on a toy: merge it with its pair if it has one, else hand it to the weakest cat if it is better. */
  autoPlace(from: Loc): boolean {
    if (!this.started || this.frozen || this.phase === 'done') return false;
    const toy = this.toyAt(from);
    if (!toy) return false;
    if (toy.g < RULES.grades) {
      const places: Loc[] = [];
      for (let i = 0; i < this.openSlots; i++) places.push({ kind: 'slot', i });
      for (let i = 0; i < RULES.chest; i++) places.push({ kind: 'chest', i });
      const mate = places.find(l => !(l.kind === from.kind && l.i === from.i) && this.toyAt(l)?.g === toy.g);
      if (mate) {
        // into a cushion when one of the two sits on one
        if (from.kind === 'slot' && mate.kind === 'chest') this.merge(mate, from);
        else this.merge(from, mate);
        return true;
      }
    }
    if (from.kind === 'chest') {
      const w = this.weakestSlot(toy);
      if (w >= 0) return this.drop(from, { kind: 'slot', i: w });
    }
    this.emit({ type: 'nope', at: from });
    return false;
  }

  /** Buy along the bottom: an upgrade's next level, or a toy from the brother's trunk. */
  buy(id: BuyId): boolean {
    if (!this.started || this.frozen || this.phase === 'done') return false;
    const cost = costOf(this.p, id);
    if (cost === null || this.p.fish < cost) { this.emit({ type: 'cant', id }); return false; }
    if (id === 'toy' && this.chestFull) { this.full(); return false; }
    this.p.fish -= cost;
    this.buys++;
    if (id === 'toy') {
      this.p.bought++;
      this.give(randomToy(shopGrade(this.p), this.rng), 'shop');
      this.emit({ type: 'buy', id, level: this.p.bought });
    } else {
      this.p.up[id]++;
      this.emit({ type: 'buy', id, level: this.p.up[id] });
      if (this.buys === 1 || this.buys % 12 === 0) this.talk.ask('upgrade', 1, 4);
    }
    if (this.buys === 1) this.coach('paw', { kind: 'paw' });
    return true;
  }

  /** The cheapest thing along the bottom the bowl can pay now (a toy only while the chest has room). */
  cheapest(): BuyId | null {
    let best: BuyId | null = null, bestCost = Infinity;
    for (const id of ['aim', 'paws', 'bowl', 'toy'] as const) {
      if (id === 'toy' && this.chestFull) continue;
      const c = costOf(this.p, id);
      if (c !== null && c <= this.p.fish && c < bestCost) { bestCost = c; best = id; }
    }
    return best;
  }

  /**
   * The helping paw (Space, the paw button): a cat without a toy gets the best one in the chest; else the
   * next pair merges; else the best toy in the chest goes to the weakest cat; else the cheapest buy (a toy
   * first while a cat sits empty-pawed).
   */
  paw(): 'merge' | 'equip' | 'buy' | null {
    if (!this.started || this.frozen || this.phase === 'done') return null;
    const bestChest = (): number => {
      let bi = -1, bd = 0;
      this.p.chest.forEach((x, i) => { if (x && toyDps(x) > bd) { bd = toyDps(x); bi = i; } });
      return bi;
    };
    const empty = this.cushions.findIndex(c => c.cat && !c.toy);
    if (empty >= 0) {
      const bi = bestChest();
      if (bi >= 0 && this.drop({ kind: 'chest', i: bi }, { kind: 'slot', i: empty })) return 'equip';
    }
    const pair = this.firstPair(true);
    if (pair) {
      this.merge(pair.from, pair.to);
      return 'merge';
    }
    const bi = bestChest();
    if (bi >= 0) {
      const w = this.weakestSlot(this.p.chest[bi]!);
      if (w >= 0 && this.drop({ kind: 'chest', i: bi }, { kind: 'slot', i: w })) return 'equip';
    }
    const id = empty >= 0 && !this.chestFull && (costOf(this.p, 'toy') ?? Infinity) <= this.p.fish ? 'toy' : this.cheapest();
    if (id && this.buy(id)) return 'buy';
    this.emit({ type: 'nope', at: null });
    return null;
  }

  /** A tap on a pest (or the chief) makes it the squad's target; true when something was there. */
  aim(x: number, y: number): boolean {
    if (!this.started || this.frozen || this.phase === 'done') return false;
    const b = this.boss;
    if (b && this.bossHere && dist(x, y, b.x, b.y) <= b.spec.r + 0.5) {
      this.target = BOSS_TARGET;
      this.targetT = RULES.targetSec;
      this.emit({ type: 'target', id: BOSS_TARGET });
      return true;
    }
    let best: Pest | null = null, bd = Infinity;
    for (const pe of this.pests) {
      if (pe.state === 'flee') continue;
      const d = dist(x, y, pe.x, pe.y);
      if (d <= pe.spec.r + 0.5 && d < bd) { bd = d; best = pe; }
    }
    if (!best) return false;
    this.target = best.id;
    this.targetT = RULES.targetSec;
    this.emit({ type: 'target', id: best.id });
    return true;
  }

  /** "Psst!": a tap on the field startles the nearest pest a little (the squad's best shot × clapK). */
  clap(x: number, y: number): boolean {
    if (!this.started || this.frozen || this.phase === 'done' || this.clapCool > 0) return false;
    this.clapCool = RULES.clapCool;
    let best = 0;
    for (const c of this.cushions) if (c.cat) best = Math.max(best, this.hitOf(c));
    const dmg = Math.max(1, best) * RULES.clapK;
    const b = this.boss;
    let hit = false;
    if (b && this.bossHere && !this.bossImmune && dist(x, y, b.x, b.y) <= b.spec.r + 1) {
      this.hitBoss(dmg, -1, null);
      hit = true;
    } else {
      let near: Pest | null = null, nd = 1.8;
      for (const pe of this.pests) {
        if (pe.state === 'flee') continue;
        const d = dist(x, y, pe.x, pe.y);
        if (d < nd) { nd = d; near = pe; }
      }
      if (near) {
        this.hitPest(near, dmg, -1, false, null);
        hit = true;
      }
    }
    this.splashes.push({ x, y, r: 0.9, t: 0, kind: 'psst' });
    this.emit({ type: 'clap', x, y, hit });
    return hit;
  }

  /** "Psst!" at the pest nearest the wall (a tap on the eye while the hunt is not ready yet). */
  clapNearest(): boolean {
    let best: Pest | null = null;
    for (const pe of this.pests) if (pe.state !== 'flee' && pe.y > -0.3 && (!best || pe.y > best.y)) best = pe;
    if (this.boss && this.bossHere && (!best || this.boss.y > best.y)) return this.clap(this.boss.x, this.boss.y);
    return best ? this.clap(best.x, best.y) : false;
  }

  /** Pet a cat: it purrs and fires faster for a moment. */
  pet(i: number): boolean {
    const c = this.cushions[i];
    if (!this.started || this.frozen || !c?.cat || c.petCool > 0) return false;
    c.purr = RULES.purrSec;
    c.petCool = RULES.petCool;
    this.petted++;
    this.emit({ type: 'pet', slot: i });
    if (this.petted === 1 || this.petted % 6 === 0) this.talk.ask('pet', 1, 4);
    return true;
  }

  /** Ask for the vintage (the question card). */
  askVintage(): boolean {
    if (!this.started || this.frozen || this.phase === 'done' || !this.vintageOpen) return false;
    this.confirm = { t: 0, gold: this.vintageNow, from: this.perks.start };
    return true;
  }

  /** The answer to the vintage's question. */
  answerVintage(yes: boolean): void {
    if (!this.confirm) return;
    this.confirm = null;
    if (!yes) return;
    const gold = holdVintage(this.p);
    if (gold <= 0) return;
    this.vintageGold += gold;
    this.vintageSaid = false;
    // the field empties: the pests run home for the winter, the chief too
    for (const pe of this.pests) if (pe.state !== 'flee') this.flee(pe);
    this.shots.length = 0;
    this.boss = null;
    this.target = 0;
    this.stageStart = this.p.stage;
    this.newWave();
    for (const id of joinCats(this.p)) this.catJoined(id);
    this.syncCushions();
    this.story = { kind: 'year', t: 0, dur: RULES.storySec, from: this.p.stage };
    this.emit({ type: 'story', kind: 'year' });
    this.emit({ type: 'vintage', gold });
    this.talk.clear();
    this.talk.ask('vintage', 4, 12);
  }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.stop = Math.max(0, this.stop - dt);
    this.timeScale = this.frozen || this.stop > 0 ? 0 : 1;
    const w = dt * this.timeScale;
    if (this.story) {
      this.story.t += dt;
      if (this.story.t >= this.story.dur) this.closeStory();
    } else if (this.confirm) {
      this.confirm.t += dt;
      if (this.confirm.t >= 14) this.confirm = null;
    }
    this.brain(dt, w, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.endFinale();
    if (w > 0 && this.phase !== 'done') {
      this.director(w);
      this.movePests(w);
      this.bossAI(w);
      this.squad(w);
      this.flyShots(w);
      this.huntStep(w);
    }
    this.fx(dt, w);
    this.tutor();
    this.talk.update(dt, t, this.talkBlocked);
  }

  get talkBlocked(): boolean {
    const b = this.block;
    const tele = this.phase === 'play' && b && this.blockT >= b.dur - RULES.telegraph;
    const banner = this.phase === 'play' && this.blockT < RULES.bannerSec && this.blockIndex > 0;
    return !!(tele || banner || this.story || this.confirm || this.boss?.state === 'tele');
  }

  /** The band's slow quantities: alertness, the hunt's charge from a held focus, the nap's ripening. */
  private brain(dt: number, w: number, f: FocusFrame): void {
    const R = RULES;
    const play = this.phase === 'play';
    this.reliable = f.reliable;
    this.level = f.reliable ? f.level : 0;
    this.calm = f.reliable ? f.calm : 0;
    this.calmShown = approach(this.calmShown, this.calm, dt, 0.6);
    if (play && f.reliable) this.relSec += dt;
    const live = this.sighted && f.reliable;
    this.alertLevel = approach(this.alertLevel, live ? clamp(f.level) : 0, dt, R.alertTau);
    this.alert = 1 + R.alertK * this.alertLevel;
    this.golden = live && this.alertLevel >= 0.5;
    if (live) this.maxHold = Math.max(this.maxHold, f.hold);
    if (live && f.hold >= this.holdNeed) this.addCharge(R.holdRate * dt * this.chargeK());
    if (live && f.level >= 0.5) this.goodT += dt;
    else this.goodT = 0;
    if (this.goodT >= R.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 4);
    }
    if (live && this.blockT >= this.lead + 0.5) this.coach('eye', { kind: 'eye' });
    // the nap: the field dozes; calm ripens the grapes into fish (a little even without a signal)
    this.napK = approach(this.napK, this.napping ? 1 : 0, dt, 0.35);
    if (this.napping && this.blockT >= this.restLead && !this.frozen) {
      const k = 0.3 + 0.7 * (f.reliable ? clamp(f.calm) : 0);
      const v = R.napRate * this.fightIncome() * k * this.perks.nap * (this.onWall('gourmand') ? 1.2 : 1) * dt;
      this.addFish(v);
      this.ripe += v;
      this.ripeTick += v;
      if (this.ripeTick >= Math.max(1, this.fightIncome() * 1.6)) {
        this.emit({ type: 'ripe', v: this.ripeTick });
        this.ripeTick = 0;
      }
    }
    // a ready hunt waits for a tap, then goes by itself
    if (this.huntReady && w > 0 && !this.napping) {
      this.readyT += w;
      if (this.readyT >= R.huntAuto) this.releaseHunt();
    }
  }

  private chargeK(): number { return this.perks.huntCharge * (this.onWall('hunt') ? 1.25 : 1); }

  private addCharge(v: number): void {
    if (this.huntReady || this.hunting > 0 || !(v > 0)) return;
    this.charge = Math.min(1, this.charge + v);
    if (this.charge >= 1 - 1e-9) {
      this.charge = 1;
      this.huntReady = true;
      this.readyT = 0;
      this.emit({ type: 'huntReady' });
      this.talk.ask('huntReady', 3, 4);
      this.coach('hunt', { kind: 'eye' });
    }
  }

  /** The Great Hunt: every cat leaves its cushion and pounces, again and again, for a few seconds. */
  releaseHunt(): boolean {
    if (!this.huntReady || this.napping || this.frozen || this.phase === 'done') return false;
    this.huntReady = false;
    this.charge = 0;
    this.readyT = 0;
    this.hunting = RULES.huntSec;
    this.pounceT = 0;
    this.hunts++;
    this.p.hunts++;
    this.stop = Math.max(this.stop, 0.12);
    const b = this.boss;
    if (b && ['here', 'tele', 'trick', 'enter'].includes(b.state)) this.hitBoss(b.max * RULES.huntBoss * this.perks.huntPower, -1, null, true);
    this.emit({ type: 'hunt' });
    this.talk.ask('hunt', 3, 4);
    return true;
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
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('nap', { kind: 'field', x: 5, y: 5.5 });
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
      this.goodT = 0;
      this.goodSaid = false;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
      if (b.blind) this.coach('dusk', { kind: 'eye' });
    } else if (b.kind === 'rest') {
      this.ripe = 0;
      this.ripeTick = 0;
      if (this.hunting > 0) {
        // the nap ends a hunt: the cats come home to their cushions
        this.hunting = 0;
        for (const c of this.cushions) c.leap = null;
        this.emit({ type: 'huntEnd' });
      }
      this.emit({ type: 'napStart' });
      this.talk.ask('rest', 2, 12);
    } else {
      this.talk.ask('warm', 1, 10);
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
    const b = this.block;
    let verdict: boolean | null = null, share = 0, need = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push' && b.blind) {
        const s = this.judge.measured > 0 ? share : 0;
        this.duskShare = Math.max(this.duskShare, Math.round(s * 100));
        this.addCharge(s);
        this.emit({ type: 'dusk', share: s });
      }
      if (b.kind === 'rest') {
        if (verdict) this.passedRests++;
        // the nap's gift: a toy in the chest, a grade higher after a calm nap
        const g = shopGrade(this.p) + (verdict === true ? 1 : 0) + this.perks.napGift;
        const toy = randomToy(g, this.rng);
        this.give(toy, 'nap');
        this.emit({ type: 'napEnd', toy });
        this.talk.ask('gift', 2, 6);
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  // ── stages and spawning ─────────────────────────────────────────
  /** A new stage's wave (the boss stage: the short wave before the chief). */
  private newWave(): void {
    this.step = 'wave';
    this.wave = { all: waveSize(this.p.stage), spawned: 0, chased: 0 };
    this.spawnT = 0.9;
  }

  private director(w: number): void {
    if (this.napping) return;
    const R = RULES;
    // the player's target fades
    if (this.target !== 0) {
      this.targetT -= w;
      const alive = this.target === BOSS_TARGET ? this.bossHere : this.pests.some(pe => pe.id === this.target && pe.state !== 'flee');
      if (this.targetT <= 0 || !alive) this.target = 0;
    }
    if (this.step !== 'boss' && this.wave.spawned < this.wave.all) {
      this.spawnT -= w * (this.pushBlock ? R.pushSpawn : 1);
      const alive = this.pests.filter(pe => pe.state !== 'flee').length;
      if (this.spawnT <= 0 && alive < R.cap) {
        this.spawnGroup();
        this.spawnT = span(R.groupSec, this.rng());
      }
    }
    if (this.step !== 'boss' && this.wave.spawned >= this.wave.all && !this.pests.some(pe => pe.counted && pe.state !== 'flee')) {
      if (this.info.boss) this.bossEnter();
      else this.stageClear();
    }
  }

  private spawnGroup(): void {
    const place = this.info.place;
    const total = place.pests.reduce((s, [, wt]) => s + wt, 0);
    let r = this.rng() * total;
    let kind: PestId = place.pests[0][0];
    for (const [id, wt] of place.pests) {
      r -= wt;
      if (r <= 0) { kind = id; break; }
    }
    const spec = PESTS[kind];
    const n = Math.round(span([spec.group[0], spec.group[1]], this.rng()));
    const left = this.wave.all - this.wave.spawned;
    for (let i = 0; i < Math.min(n, left); i++) this.spawnPest(kind, true, i);
  }

  /** A pest comes in toward a free spot on the goods; `counted` pests make the wave. */
  spawnPest(kind: PestId, counted: boolean, k = 0, at?: { x: number; y: number }): Pest {
    const R = RULES, spec = PESTS[kind];
    const elite = counted && this.wave.spawned >= 2 && this.rng() < R.eliteChance;
    const spot = this.freeSpot();
    let x: number, y: number;
    if (at) { x = at.x; y = at.y; }
    else if (spec.motion === 'fly' || spec.motion === 'flutter') {
      const side = this.rng() < 0.5 ? -1 : 1;
      x = side < 0 ? -0.8 : R.FW + 0.8;
      y = 0.4 + this.rng() * 3 + k * 0.3;
    } else {
      x = clamp(spot.x + (this.rng() - 0.5) * 3, 0.4, R.FW - 0.4);
      y = R.enterY - k * 0.35;
    }
    const hp = courage(this.p.stage, kind) * (elite ? R.eliteHp : 1);
    const pe: Pest = {
      id: this.nextId++, kind, spec, x, y, tx: spot.x, ty: spot.y, hp, max: hp, state: 'come', t: 0, hit: 0, freeze: 0,
      dir: spot.x >= x ? 1 : -1, vx: 0, vy: 0, elite, counted, seed: this.rng() * 100, pending: 0, by: -1,
    };
    this.pests.push(pe);
    if (counted) this.wave.spawned++;
    if (!(this.p.notebook[kind] > 0) && !this.newPests.includes(kind)) this.newPests.push(kind);
    this.emit({ type: 'spawn', id: pe.id, kind, elite });
    if (elite) this.coach('target', { kind: 'field', x: spot.x, y: spot.y });
    return pe;
  }

  /** A goal spot on the goods away from the others. */
  private freeSpot(): { x: number; y: number } {
    const R = RULES;
    let best = { x: 5, y: 6 }, bestD = -1;
    for (let k = 0; k < 8; k++) {
      const x = span([R.goodsX[0], R.goodsX[1]], this.rng());
      const y = span([R.goodsY[0], R.goodsY[1]], this.rng());
      let d = Infinity;
      for (const pe of this.pests) if (pe.state !== 'flee') d = Math.min(d, dist(x, y, pe.tx, pe.ty));
      if (this.boss) d = Math.min(d, dist(x, y, this.boss.tx, this.boss.ty) - 0.8);
      if (d >= R.spotGap) return { x, y };
      if (d > bestD) { bestD = d; best = { x, y }; }
    }
    return best;
  }

  private stageClear(): void {
    const was = stageInfo(this.p.stage);
    this.p.stage++;
    this.p.yearBest = Math.max(this.p.yearBest, this.p.stage);
    const before = this.openSlots;
    this.p.bestStage = Math.max(this.p.bestStage, this.p.stage);
    const now = stageInfo(this.p.stage);
    const newPlace = now.placeIdx !== was.placeIdx;
    this.boss = null;
    this.target = 0;
    this.newWave();
    if (newPlace) {
      if (!this.placesNow.includes(now.place.id)) this.placesNow.push(now.place.id);
      this.talk.ask('place', 1, 6);
    }
    this.emit({ type: 'stage', n: this.p.stage, place: now.place.id, newPlace });
    for (const id of joinCats(this.p)) this.catJoined(id);
    if (this.openSlots > before) {
      this.syncCushions();
      this.armCats();
      this.emit({ type: 'cushion', n: this.openSlots });
    }
    if (this.vintageOpen && !this.vintageSaid) {
      this.vintageSaid = true;
      this.emit({ type: 'vintageReady' });
      this.talk.ask('vintageReady', 1, 6);
      this.coach('vintage', { kind: 'vintage' });
    }
  }

  private catJoined(id: CatId): void {
    this.catsNow.push(id);
    this.syncCushions();
    this.armCats();
    this.emit({ type: 'cat', id });
    this.talk.ask('cat', 2, 6);
  }

  /** A cat on an open cushion without a toy gets one from the brother's trunk (a new cat, a new cushion). */
  private armCats(): void {
    for (const c of this.cushions) {
      if (!c.cat || c.toy) continue;
      const toy = randomToy(shopGrade(this.p), this.rng);
      this.p.slots[c.i] = toy;
      noteToy(this.p, toy);
      this.emit({ type: 'toy', toy, source: 'shop', at: { kind: 'slot', i: c.i }, fresh: false });
    }
    this.syncCushions();
  }

  // ── the pests ───────────────────────────────────────────────────
  private movePests(w: number): void {
    const R = RULES;
    for (let i = this.pests.length - 1; i >= 0; i--) {
      const pe = this.pests[i];
      pe.t += w;
      pe.hit = Math.max(0, pe.hit - w);
      if (pe.state === 'flee') {
        pe.x += pe.vx * w;
        pe.y += pe.vy * w;
        if (pe.y < -2.5 || pe.x < -2.5 || pe.x > R.FW + 2.5) this.pests.splice(i, 1);
        continue;
      }
      // in a nap they doze where they are — those still coming in first walk into the field
      const outside = pe.y < 1 || pe.x < 0.4 || pe.x > R.FW - 0.4;
      if (this.napping && !(pe.state === 'come' && outside)) continue;
      if (pe.freeze > 0) { pe.freeze -= w; continue; }
      if (pe.hit > 0 && pe.state === 'come') continue;   // a flinch stops it for a heartbeat
      if (pe.state === 'come') {
        const dx = pe.tx - pe.x, dy = pe.ty - pe.y, d = Math.hypot(dx, dy);
        let sp = pe.spec.speed;
        const m = pe.spec.motion;
        if (m === 'hop') sp *= 1.6 * Math.abs(Math.sin(pe.t * 3.2 + pe.seed));
        if (m === 'scurry') sp *= 0.8 + 0.5 * Math.abs(Math.sin(pe.t * 7 + pe.seed));
        const step = sp * w;
        if (d <= step || d < 0.05) {
          pe.x = pe.tx;
          pe.y = pe.ty;
          pe.state = 'nibble';
        } else {
          let ux = dx / d, uy = dy / d;
          // fliers swoop, scurriers zig-zag
          if (m === 'fly' || m === 'flutter' || m === 'scurry') {
            const sw = (m === 'scurry' ? 0.6 : 0.45) * Math.sin(pe.t * (m === 'scurry' ? 9 : 3) + pe.seed);
            const nx = -uy, ny = ux;
            ux += nx * sw;
            uy += ny * sw;
            const l = Math.hypot(ux, uy) || 1;
            ux /= l;
            uy /= l;
          }
          pe.x += ux * step;
          pe.y += uy * step;
          if (Math.abs(ux) > 0.2) pe.dir = ux > 0 ? 1 : -1;
        }
      }
    }
  }

  private flee(pe: Pest): void {
    pe.state = 'flee';
    const side = pe.x < RULES.FW / 2 ? -1 : 1;
    const air = pe.spec.motion === 'fly' || pe.spec.motion === 'flutter';
    pe.vx = side * RULES.fleeSpeed * (air ? 0.5 : 0.35);
    pe.vy = -RULES.fleeSpeed * (air ? 0.8 : 1);
    pe.dir = side;
  }

  /** A hit on a pest: it flinches; out of courage, it bolts and the brother pays the cats. */
  private hitPest(pe: Pest, dmg: number, slot: number, crit: boolean, fam: FamId | null): void {
    if (pe.state === 'flee' || !(dmg > 0)) return;
    pe.hp -= dmg;
    pe.hit = RULES.flinch;
    pe.by = slot;
    if (slot >= 0 && this.gift(slot) === 'freeze') pe.freeze = 0.4;
    this.emit({ type: 'hit', x: pe.x, y: pe.y, dmg, crit, boss: false, fam });
    if (pe.hp <= 1e-9) this.chase(pe);
  }

  private chase(pe: Pest): void {
    this.flee(pe);
    pe.hp = 0;
    const g = pe.by >= 0 ? this.gift(pe.by) : null;
    const fish = this.fishOf(pe.kind) * (pe.elite ? RULES.eliteFish : 1) * (g === 'gourmand' ? 1.4 : 1);
    this.addFish(fish);
    this.score++;
    this.p.total++;
    this.p.notebook[pe.kind] = (this.p.notebook[pe.kind] ?? 0) + 1;
    if (pe.counted) this.wave.chased++;
    if (pe.spec.trait === 'air') this.birds++;
    if (this.target === pe.id) this.target = 0;
    this.emit({ type: 'chased', x: pe.x, y: pe.y, kind: pe.kind, fish, elite: pe.elite });
    if (pe.elite) this.give(randomToy(shopGrade(this.p) + 1, this.rng), 'elite');
    if (g === 'finder' && this.rng() < 0.03) this.give(randomToy(shopGrade(this.p), this.rng), 'found');
    this.addCharge((this.sighted && this.reliable ? RULES.chaseCharge : RULES.baseCharge) * this.chargeK());
  }

  // ── the chief ───────────────────────────────────────────────────
  private bossEnter(): void {
    const id = this.info.place.boss;
    const prev = this.boss?.id === id ? this.boss : null;
    const max = bossCourage(this.p.stage, id);
    const pat = this.perks.patience;
    this.boss = {
      id, spec: BOSSES[id], state: 'enter', st: 0, x: RULES.FW / 2, y: -1.4, tx: RULES.FW / 2, ty: 3.4,
      hp: prev ? prev.hp : max * clamp(this.p.chief, 0.05, 1), max, patience: pat, patienceMax: pat, trickIn: span(RULES.trickEvery, this.rng()),
      hit: 0, dir: 1, visits: (prev?.visits ?? 0) + 1, pending: 0,
    };
    this.step = 'boss';
    this.emit({ type: 'boss', id });
    this.talk.ask('boss', 3, 6);
    this.coach('boss', { kind: 'field', x: RULES.FW / 2, y: 3.4 });
  }

  private setBoss(state: BossState): void {
    if (!this.boss) return;
    this.boss.state = state;
    this.boss.st = 0;
  }

  private bossAI(w: number): void {
    const b = this.boss;
    if (!b) return;
    b.st += w;
    b.hit = Math.max(0, b.hit - w);
    const move = (sp: number) => {
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
      if (d < 0.04) { b.x = b.tx; b.y = b.ty; return true; }
      const s = Math.min(d, sp * w);
      b.x += (dx / d) * s;
      b.y += (dy / d) * s;
      if (Math.abs(dx) > 0.05) b.dir = dx > 0 ? 1 : -1;
      return false;
    };
    switch (b.state) {
      case 'enter':
        if (move(1.6)) this.setBoss('here');
        return;
      case 'leave':
        b.ty = -2.5;
        move(2.2);
        if (b.st >= 1.4) {
          // he is gone for now: a few more pests, then he is back
          b.state = 'away';
          this.step = 'farm';
          this.wave = { all: RULES.farmWave, spawned: 0, chased: 0 };
          this.spawnT = 0.6;
        }
        return;
      case 'chased':
        b.ty = -3;
        b.tx = b.x + b.dir * 2;
        move(5);
        if (b.st >= 1.2) this.stageClear();
        return;
      case 'away':
        return;
      default:
        break;
    }
    if (this.napping) return;
    // patience runs out while he is here
    b.patience -= w;
    if (b.patience <= 0) {
      const near = b.hp / b.max < 0.15;
      this.setBoss('leave');
      if (this.target === BOSS_TARGET) this.target = 0;
      this.emit({ type: 'bossBacks', id: b.id, near });
      this.talk.ask(near ? 'near' : 'backs', 3, 5);
      return;
    }
    if (b.state === 'here') {
      move(2.6);
      b.trickIn -= w;
      if (b.trickIn <= 0) {
        this.setBoss('tele');
        this.emit({ type: 'bossTele', trick: b.spec.trick });
      }
    } else if (b.state === 'tele') {
      if (b.st >= RULES.trickTele) {
        this.setBoss('trick');
        this.doTrick(b);
      }
    } else if (b.state === 'trick') {
      if (b.spec.trick === 'dash') move(7);
      if (b.st >= b.spec.trickSec) {
        if (b.spec.trick === 'dig') {
          b.x = b.tx;
          b.y = b.ty;
        }
        this.setBoss('here');
        b.trickIn = span(RULES.trickEvery, this.rng());
      }
    }
  }

  private doTrick(b: Boss): void {
    const R = RULES;
    const tr = b.spec.trick;
    if (tr === 'dash' || tr === 'dig') {
      b.tx = clamp(b.x + (this.rng() < 0.5 ? -1 : 1) * (2 + this.rng() * 2), 1.8, R.FW - 1.8);
      b.ty = clamp(3 + this.rng() * 1.6, 2.6, 4.8);
    }
    if (tr === 'summon') for (let i = 0; i < 3; i++) this.spawnPest('mysz', false, i, { x: clamp(b.x + (i - 1) * 0.9, 0.5, R.FW - 0.5), y: b.y + 0.5 });
    this.emit({ type: 'bossTrick', trick: tr });
    if (b.visits <= 1 && this.rng() < 0.6) this.talk.ask('trick', 1, 3);
  }

  /** A hit on the chief (the hunt's leap ignores his trick). */
  private hitBoss(dmg: number, slot: number, fam: FamId | null, hunt = false): void {
    const b = this.boss;
    if (!b || !(dmg > 0)) return;
    if (!['enter', 'here', 'tele', 'trick'].includes(b.state)) return;
    if (!hunt && this.bossImmune) {
      this.emit({ type: 'splash', x: b.x, y: b.y - 0.6, kind: 'puff', r: 0.4 });
      return;
    }
    let k = 1;
    if (!hunt && b.state === 'trick' && (b.spec.trick === 'dash' || b.spec.trick === 'dust')) k = 0.5;
    if (slot >= 0 && this.gift(slot) === 'boss') k *= 1.6;
    const v = dmg * k;
    b.hp -= v;
    b.hit = RULES.flinch;
    this.emit({ type: 'hit', x: b.x, y: b.y - 0.3, dmg: v, crit: false, boss: true, fam });
    if (b.hp <= 1e-9) this.chaseBoss();
  }

  private chaseBoss(): void {
    const b = this.boss;
    if (!b || b.state === 'chased') return;
    b.hp = 0;
    this.setBoss('chased');
    const first = (this.p.bosses[b.id] ?? 0) === 0;
    this.p.bosses[b.id] = (this.p.bosses[b.id] ?? 0) + 1;
    this.p.chief = 1;
    // stars: chased; at his first visit (he never backed off); and with half his patience to spare
    const stars = 1 + (b.visits === 1 ? 1 : 0) + (b.visits === 1 && b.patience >= b.patienceMax * 0.5 ? 1 : 0);
    this.p.stars[b.spec.place] = Math.max(this.p.stars[b.spec.place] ?? 0, stars);
    this.starsNow.push(stars);
    if (!this.bossesNow.includes(b.id)) this.bossesNow.push(b.id);
    const fish = this.fishOf('liszka') * RULES.bossFish;
    this.addFish(fish);
    this.score += 5;
    this.p.total += 5;
    if (this.target === BOSS_TARGET) this.target = 0;
    this.stop = Math.max(this.stop, 0.25);
    // the chief's pests run with him
    for (const pe of this.pests) if (pe.state !== 'flee' && !pe.counted) this.flee(pe);
    this.give(randomToy(shopGrade(this.p) + 1 + this.info.round, this.rng), 'boss');
    this.emit({ type: 'bossChased', id: b.id, first, fish, stars });
    this.talk.ask('chased', 4, 6);
    if (first) {
      this.story = { kind: 'place', t: 0, dur: RULES.storySec, place: b.spec.place, stars };
      this.emit({ type: 'story', kind: 'place' });
    }
  }

  // ── the squad ───────────────────────────────────────────────────
  private squad(w: number): void {
    for (const c of this.cushions) {
      c.purr = Math.max(0, c.purr - w);
      c.petCool = Math.max(0, c.petCool - w);
      c.recoil = Math.max(0, c.recoil - w * 5);
    }
    if (this.napping || this.hunting > 0) return;
    for (const c of this.cushions) {
      if (!c.cat || !c.toy) continue;
      const fam = FAMS[c.toy.fam];
      c.cool -= w * this.paceOf(c);
      if (c.cool > 0) continue;
      const tgt = this.pick(c);
      if (!tgt) { c.cool = 0; continue; }
      this.fire(c, tgt);
      c.cool = Math.max(-fam.cd, c.cool + fam.cd);
    }
  }

  /** The squad's choice: the player's target, the chief, else the pest nearest the wall that is not as good as gone. */
  private pick(c: Cushion): { id: number; x: number; y: number } | null {
    const b = this.boss;
    if (this.target === BOSS_TARGET && b && this.bossHere) return { id: BOSS_TARGET, x: b.x, y: b.y };
    if (this.target > 0) {
      const pe = this.pests.find(x => x.id === this.target && x.state !== 'flee');
      if (pe) return { id: pe.id, x: pe.x, y: pe.y };
    }
    if (b && this.bossHere) return { id: BOSS_TARGET, x: b.x, y: b.y };
    const sx = this.slotPos(c.i).x;
    let best: Pest | null = null, bs = -Infinity;
    for (const pe of this.pests) {
      if (pe.state === 'flee' || pe.y < -0.3 || pe.x < -0.3 || pe.x > RULES.FW + 0.3) continue;
      if (pe.pending >= pe.hp) continue;
      const s = pe.y * 2 - Math.abs(pe.x - sx) * 0.35;
      if (s > bs) { bs = s; best = pe; }
    }
    if (!best) {
      // everyone is as good as gone: help with the nearest anyway
      for (const pe of this.pests) {
        if (pe.state === 'flee' || pe.y < -0.3) continue;
        const s = pe.y * 2 - Math.abs(pe.x - sx) * 0.35;
        if (s > bs) { bs = s; best = pe; }
      }
    }
    return best ? { id: best.id, x: best.x, y: best.y } : null;
  }

  private traitK(fam: FamId, pe: Pest | null): number {
    return pe && FAMS[fam].good === pe.spec.trait ? RULES.traitK : 1;
  }

  private fire(c: Cushion, tgt: { id: number; x: number; y: number }): void {
    const toy = c.toy!, fam = FAMS[toy.fam], R = RULES;
    c.shots++;
    c.recoil = 1;
    const crit = c.spec?.gift === 'crit' && c.shots % 4 === 0;
    const base = this.hitOf(c) * (crit ? 3 : 1);
    const from = this.slotPos(c.i);
    const sy = from.y - 0.35;
    const pe = tgt.id === BOSS_TARGET ? null : this.pests.find(x => x.id === tgt.id) ?? null;
    const main = base * this.traitK(toy.fam, pe);
    this.emit({ type: 'shot', slot: c.i, fam: toy.fam, pattern: fam.pattern });
    if (fam.pattern === 'beam') {
      this.beams.push({ slot: c.i, sx: from.x, sy, tx: tgt.x, ty: tgt.y, t: 0 });
      this.land(c.i, toy.fam, tgt.id, tgt.x, tgt.y, main, crit, false);
      return;
    }
    const shot = (tx: number, ty: number, id: number, dmg: number, side: boolean): void => {
      const d = dist(from.x, sy, tx, ty);
      const dur = fam.pattern === 'lob' ? R.lobSec : d / (fam.pattern === 'splash' ? R.slowShot : R.shotSpeed);
      if (id > 0) {
        const p2 = this.pests.find(x => x.id === id);
        if (p2) p2.pending += dmg;
      } else if (this.boss) this.boss.pending += dmg;
      this.shots.push({
        id: this.nextId++, slot: c.i, fam: toy.fam, pattern: fam.pattern, sx: from.x, sy, x: from.x, y: sy, tx, ty, target: id,
        dmg, t: 0, dur: Math.max(0.05, dur), crit, side, bounces: fam.pattern === 'bounce' ? fam.n : 0, chain: [],
      });
    };
    shot(tgt.x, tgt.y, tgt.id, main, false);
    if (fam.pattern === 'spray') {
      // a fan of drops: the nearest others around the target get the side drops
      const others = this.pests.filter(x => x.state !== 'flee' && x.id !== tgt.id && dist(x.x, x.y, tgt.x, tgt.y) <= fam.area)
        .sort((a, b) => dist(a.x, a.y, tgt.x, tgt.y) - dist(b.x, b.y, tgt.x, tgt.y)).slice(0, fam.n);
      for (const o of others) shot(o.x, o.y, o.id, base * fam.side * this.traitK(toy.fam, o), true);
    }
  }

  private flyShots(w: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      // the shot homes on its target while it is there
      if (s.target === BOSS_TARGET) {
        if (this.boss) { s.tx = this.boss.x; s.ty = this.boss.y; }
      } else {
        const pe = this.pests.find(x => x.id === s.target);
        if (pe && pe.state !== 'flee') { s.tx = pe.x; s.ty = pe.y; }
      }
      s.t += w / s.dur;
      const k = Math.min(1, s.t);
      s.x = s.sx + (s.tx - s.sx) * k;
      s.y = s.sy + (s.ty - s.sy) * k;
      if (s.t < 1) continue;
      this.shots.splice(i, 1);
      if (s.target > 0) {
        const pe = this.pests.find(x => x.id === s.target);
        if (pe) pe.pending = Math.max(0, pe.pending - s.dmg);
      } else if (this.boss) this.boss.pending = Math.max(0, this.boss.pending - s.dmg);
      this.land(s.slot, s.fam, s.target, s.tx, s.ty, s.dmg, s.crit, s.side, s);
    }
  }

  /** A shot arrives: the hit, and what its pattern and its cat's gift add. */
  private land(slot: number, famId: FamId, id: number, x: number, y: number, dmg: number, crit: boolean, side: boolean, s?: Shot): void {
    const fam = FAMS[famId], R = RULES;
    const g = this.gift(slot);
    let target: Pest | null = null;
    if (id === BOSS_TARGET) {
      if (this.bossHere) this.hitBoss(dmg, slot, famId);
    } else {
      target = this.pests.find(pe => pe.id === id && pe.state !== 'flee') ?? null;
      if (!target) {
        // it ran or bolted already: the nearest one by the landing spot takes it
        let nd = 1.1;
        for (const pe of this.pests) {
          if (pe.state === 'flee') continue;
          const d = dist(x, y, pe.x, pe.y);
          if (d < nd) { nd = d; target = pe; }
        }
      }
      if (target) this.hitPest(target, dmg, slot, crit, famId);
      else this.splashes.push({ x, y, r: 0.35, t: 0, kind: 'puff' });
    }
    if (side) return;
    const hitId = target?.id ?? id;
    switch (fam.pattern) {
      case 'pierce': {
        // the jet goes on through everything near its line
        const from = this.slotPos(slot);
        for (const pe of this.pests) {
          if (pe.state === 'flee' || pe.id === hitId) continue;
          if (segDist(pe.x, pe.y, from.x, from.y, x, y) <= fam.area + pe.spec.r * 0.5) this.hitPest(pe, dmg * fam.side, slot, false, famId);
        }
        break;
      }
      case 'splash':
      case 'lob': {
        const kind: SplashKind = fam.pattern === 'lob' ? 'apple' : 'bubble';
        this.splashes.push({ x, y, r: fam.area, t: 0, kind });
        this.emit({ type: 'splash', x, y, kind, r: fam.area });
        for (const pe of this.pests) {
          if (pe.state === 'flee' || pe.id === hitId) continue;
          if (dist(pe.x, pe.y, x, y) <= fam.area) this.hitPest(pe, dmg * fam.side * this.traitK(famId, pe) / this.traitK(famId, target), slot, false, famId);
        }
        break;
      }
      case 'bounce': {
        if (!s || s.bounces <= 0) break;
        const chain = [...s.chain, hitId];
        let next: Pest | null = null, nd = fam.area;
        for (const pe of this.pests) {
          if (pe.state === 'flee' || chain.includes(pe.id)) continue;
          const d = dist(pe.x, pe.y, x, y);
          if (d < nd) { nd = d; next = pe; }
        }
        if (next) {
          const dmg2 = dmg * fam.side;
          next.pending += dmg2;
          this.shots.push({
            id: this.nextId++, slot, fam: famId, pattern: 'bounce', sx: x, sy: y, x, y, tx: next.x, ty: next.y, target: next.id,
            dmg: dmg2, t: 0, dur: Math.max(0.08, nd / (R.shotSpeed * 0.7)), crit: false, side: false, bounces: s.bounces - 1, chain,
          });
        }
        break;
      }
      case 'spray':
        this.splashes.push({ x, y, r: 0.45, t: 0, kind: 'water' });
        break;
      default:
        break;
    }
    // the cats' gifts that carry a hit on
    if (g === 'pierce' && (fam.pattern === 'single' || fam.pattern === 'rapid' || fam.pattern === 'beam') && target) {
      let next: Pest | null = null, nd = 2.6;
      for (const pe of this.pests) {
        if (pe.state === 'flee' || pe.id === target.id) continue;
        const d = dist(pe.x, pe.y, x, y);
        if (d < nd) { nd = d; next = pe; }
      }
      if (next) this.hitPest(next, dmg * 0.7, slot, false, famId);
    }
    if (g === 'splash') {
      for (const pe of this.pests) {
        if (pe.state === 'flee' || pe.id === hitId) continue;
        if (dist(pe.x, pe.y, x, y) <= 1.05) this.hitPest(pe, dmg * 0.4, slot, false, famId);
      }
    }
  }

  // ── the hunt ────────────────────────────────────────────────────
  private huntStep(w: number): void {
    if (this.hunting <= 0) return;
    this.hunting -= w;
    for (const c of this.cushions) if (c.leap) c.leap.t = Math.min(1, c.leap.t + w / RULES.pounceSec);
    this.pounceT -= w;
    if (this.pounceT <= 0 && this.hunting > 0) {
      this.pounceT = RULES.pounceSec;
      const taken = new Set<number>();
      for (const c of this.cushions) {
        if (!c.cat) continue;
        const b = this.boss;
        let tx: number, ty: number;
        // pounces land in the field, not on a pest still coming in over its far edge
        const pe = this.pests.filter(x => x.state !== 'flee' && !taken.has(x.id) && x.y > 0.8 && x.x > 0.3 && x.x < RULES.FW - 0.3)
          .sort((a, z) => z.y - a.y)[0];
        const dmg = Math.max(this.hitOf(c), 1) * RULES.pounceK * this.alertFor(c) * this.perks.huntPower;
        if (pe) {
          taken.add(pe.id);
          tx = pe.x;
          ty = pe.y;
          this.hitPest(pe, dmg, c.i, false, null);
        } else if (b && ['here', 'tele', 'trick'].includes(b.state)) {
          tx = b.x + (this.rng() - 0.5) * 1.2;
          ty = b.y + 0.4;
          this.hitBoss(dmg * 0.5, c.i, null, true);
        } else continue;
        c.leap = { x: tx, y: ty, t: 0 };
        this.splashes.push({ x: tx, y: ty, r: 0.7, t: 0, kind: 'pounce' });
        this.emit({ type: 'pounce', slot: c.i, x: tx, y: ty });
      }
    }
    if (this.hunting <= 0) {
      this.hunting = 0;
      for (const c of this.cushions) c.leap = null;
      this.emit({ type: 'huntEnd' });
    }
  }

  // ── fish and toys ───────────────────────────────────────────────
  addFish(v: number): void {
    if (!(v > 0)) return;
    this.p.fish += v;
    this.fishGained += v;
    const id = this.cheapest();
    if (id && id !== 'toy') this.coach('upgrade', { kind: 'up', id });
  }

  /** A toy for the watch: into the first free cell of the chest, or it waits for room. */
  give(toy: Toy, source: ToySource): void {
    const fresh = noteToy(this.p, toy);
    if (fresh) this.freshGrades.push(toy);
    const i = this.p.chest.findIndex(x => !x);
    if (i >= 0) {
      this.p.chest[i] = toy;
      this.emit({ type: 'toy', toy, source, at: { kind: 'chest', i }, fresh });
    } else {
      if (this.gifts.length < 4) this.gifts.push(toy);
      else this.addFish(costOf(this.p, 'toy')! * 0.5);
      this.emit({ type: 'toy', toy, source, at: null, fresh });
      this.full();
    }
    if (this.chestFull) this.full();
  }

  private full(): void {
    this.emit({ type: 'full' });
    this.coach('full', { kind: 'chest', i: 0 });
    if (!this.fullSaid) {
      this.fullSaid = true;
      this.talk.ask('full', 1, 5);
    }
  }

  // ── teaching ────────────────────────────────────────────────────
  /** The first session's tutorial: one control at a time, when it first matters, until it is done. */
  private tutor(): void {
    if (this.session !== 1 || this.frozen || this.phase !== 'play') return;
    if (this.t >= 2.5) this.coach('squad', { kind: 'slot', i: 0 });
    if (this.p.merges === 0 && this.t >= 9) {
      const pair = this.firstPair();
      if (pair) {
        const at: CoachAt = pair.from.kind === 'chest' ? { kind: 'chest', i: pair.from.i } : { kind: 'slot', i: pair.from.i };
        if (this.coachMergeT === 0) {
          this.coachMergeT = this.t;
          this.coach('merge', at);
        } else if (this.t - this.coachMergeT >= 22) this.coach('merge2', at);
      }
    }
    if (this.t >= 75) this.coach('pet', { kind: 'slot', i: Math.min(1, this.openSlots - 1) });
  }

  /** A first-time explanation (once ever): the index turns it into the runner's coach mark. */
  private coach(what: Coach, at: CoachAt): void {
    if (this.p.seen.includes(what)) return;
    this.p.seen.push(what);
    this.emit({ type: 'coach', what, at });
  }

  private fx(dt: number, w: number): void {
    this.clapCool = Math.max(0, this.clapCool - dt);
    for (let i = this.splashes.length - 1; i >= 0; i--) if ((this.splashes[i].t += dt) > 0.6) this.splashes.splice(i, 1);
    for (let i = this.beams.length - 1; i >= 0; i--) if ((this.beams[i].t += dt) > 0.14) this.beams.splice(i, 1);
    void w;
  }

  // ── the end ─────────────────────────────────────────────────────
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.emit({ type: 'finale' });
  }

  private endFinale(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.confirm = null;
    this.talk.clear();
    this.talk.ask('end', 5, 8);
    this.emit({ type: 'done' });
    this.settle();
  }

  /** The session is settled once — at its end, or when it ends early: the counters reach the progress. */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p;
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushesBase + this.pushesBegun);
    p.lastLen = this.plannedSec;
    p.lastSeen = Math.round(this.startMs + this.t * 1000);
    // a chief still on the field keeps his wounds for the next session
    const b = this.boss;
    if (b && b.state !== 'chased' && this.info.boss) p.chief = clamp(b.hp / b.max, 0.05, 1);
    for (const id of joinCats(p)) {
      this.catsNow.push(id);
      this.emit({ type: 'cat', id });
    }
  }

  /** The session ends before its own end: settle as the end would. */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') this.endBlock();
    this.confirm = null;
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

  /** The panel's gauge: alertness in a sighted push past its lead-in, calm in a nap; null blind, without signal, elsewhere. */
  meter(): number | null {
    if (!this.started || !this.reliable) return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.alertLevel);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  /** The pad follows alertness in a sighted push, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(this.alertLevel);
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
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    let bt: Toy | null = null;
    for (const x of [...p.slots, ...p.chest]) if (x && (!bt || x.g > bt.g)) bt = x;
    const stats: [string, string][] = [
      [t('stat.stage'), String(p.stage)],
      [t('stat.bestStage'), String(p.bestStage)],
      [t('stat.bosses'), String(this.bossesNow.length)],
      [t('stat.merges'), String(this.merges)],
      [t('stat.bestToy'), bt ? `${famName(bt.fam)} ${bt.g}` : '—'],
      [t('stat.hunts'), String(this.hunts)],
      [t('stat.fish'), big(this.fishGained)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: the first
   * session (Song 2:15), a chief chased off (Proverbs 27:18), a vintage or the watch kept while away
   * (Proverbs 6:6-8), a calm nap with pests and cats dozing together (Isaiah 11:6), petting and a new cat
   * (Proverbs 12:10), many birds chased off (Matthew 6:26), a Great Hunt or a new pest in the notebook
   * (Job 12:7); else Song 2:15.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('sng2.15');
    if (this.bossesNow.length) fit.push('pro27.18');
    if (this.vintageGold > 0 || this.awayFish > 0) fit.push('pro6.6-8');
    if (this.passedRests > 0) fit.push('isa11.6');
    if (this.catsNow.length || this.petted >= 3) fit.push('pro12.10');
    if (this.birds >= 20) fit.push('mat6.26');
    if (this.hunts > 0 || this.newPests.length) fit.push('job12.7');
    fit.push('sng2.15');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    const lastBoss = this.bossesNow[this.bossesNow.length - 1];
    if (lastBoss) add(0, t('hl.close.boss', { name: bossName(lastBoss) }));
    else if (this.placesNow.length) add(0, t('hl.close.place', { place: placeName(stageInfo(this.p.stage - 1).place.id) }));
    else if (this.started) add(0, t('hl.close.calm'));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(1, t('hl.record', { pests: pestsText(this.score) }));
    else if (this.bestBefore !== null && this.score > 0 && this.bestBefore - this.score <= Math.max(10, this.bestBefore * 0.3)) {
      add(1, t('hl.toBest', { pests: pestsText(this.bestBefore - this.score) }));
    }
    this.bossesNow.forEach((id, i) => add(2, `${t('hl.boss', { name: bossName(id) })} ${starText(this.starsNow[i] ?? 1)}`));
    for (const id of this.catsNow) add(3, t('hl.cat', { name: cap1(catName(id)) }));
    if (this.vintageGold > 0) add(3, t('hl.vintage', { gold: goldText(this.vintageGold) }));
    const top = this.freshGrades.reduce<Toy | null>((m, x) => (!m || x.g > m.g ? x : m), null);
    if (top) add(4, t('hl.toy', { name: famName(top.fam), g: top.g, grade: gradeName(top.g) }));
    for (const pl of this.placesNow) add(5, t('hl.place', { place: placeName(pl) }));
    if (this.hunts) add(6, t('hl.hunts', { n: this.hunts }));
    if (this.awayFish > 0) add(7, t('hl.away', { fish: fishText(this.awayFish) }));
    if (this.tripBack.length) add(7, t('hl.trip', { names: this.tripBack.map(catName).join(', ') }));
    if (this.duskShare >= 0) add(8, t('hl.blind', { n: this.duskShare }));
    if (this.p.gold > 0 && this.vintageGold > 0) add(9, t('hl.perk'));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}

/** "★★☆" */
export const starText = (n: number): string => '★'.repeat(clamp(Math.round(n), 0, 3)) + '☆'.repeat(3 - clamp(Math.round(n), 0, 3));

/** Distance from a point to a segment. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const k = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2) : 0;
  return Math.hypot(px - (ax + dx * k), py - (ay + dy * k));
}
