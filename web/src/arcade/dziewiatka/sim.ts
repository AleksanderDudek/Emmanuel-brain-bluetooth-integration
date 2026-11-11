/**
 * Dziewiątka's session without a screen: the campaign through Zacisze (six districts × five
 * missions of three waves, a boss in the fifth), then the Bell Tower's floors, fought by the five in
 * push blocks and the warm-up (battle.ts); the rest blocks are the well.
 *
 * The band is the team's energy (Hero Wars' energy rules, battle.ts): in a sighted push block past its
 * lead-in every gain is × (1 + 2·level) — ×1 without signal, ×2 at the threshold, ×3 well above —
 * so the ultimates come two or three times as often; as the lead-in ends the Din surges with more
 * shadows.  A held focus fills Harmony, the bell of Zacisze: rung, all five ultimates go at once.  A
 * blind push ("a fog of noise") keeps ×1 in sight and pays its share into Harmony at its end.  In a
 * rest block the Din draws back and dozes, the team sits at the well: calm heals (and the fallen
 * stand up), a tap sews a piece of gear onto a hero (six = the next colour rank), and the block's end
 * offers one of three boons (golden after a calm rest).
 *
 * Grace everywhere: a fallen hero is carried to the well; a wipe is a stumble (the team gets up, the
 * wave loses heart, the score stays); the Din is shy against a team behind its pace; nothing waits
 * on the band.  No DOM: the view and the sound read the state and the event queue (`take()`).
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import { Battle, type BattleEvent, type Hero, type TeamMods } from './battle';
import {
  BOONS, BOON_IDS, CAMPAIGN, CHAPTERS, DIN, HEROES, LINES, MISSIONS_PER_CHAPTER, PIECES, TIPS,
  boonName, campaignMission, chapterName, dinName, heroName, rankName, towerFloor,
  type BoonId, type DinKind, type HeroId, type MissionSpec, type ShadowKind,
} from './content';
import { hushed as hushedText, t, unit } from './i18n';
import {
  addNotes, addXp, bestFor, campaignDone, equip, equipAll, familyBonus, growth, isBoonId, joiningAfter, lenKey,
  neededKinds, nextToEquip, powerOf, recordStars, type DziewiatkaProgress,
} from './meta';
import { RULES, span } from './rules';
import { Talk } from './talk';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';
export type Coach = 'ult' | 'tap' | 'mult' | 'bell' | 'well' | 'boon' | 'wind' | 'split' | 'swell' | 'shield' | 'steal' | 'rush' | 'yawn' | 'copy' | 'whisper' | 'boss';
/** where a coach mark points: a spot of the street (u), a portrait, the bell, the dial, the well, the first card */
export type CoachAt = { at: 'field'; x: number; y: number } | { at: 'slot'; slot: number } | { at: 'bell' } | { at: 'dial' } | { at: 'well' } | { at: 'card' } | { at: 'centre' };

export interface Story { kind: 'open' | 'chapter' | 'join' | 'tower'; t: number; dur: number; chapter: number; hero: HeroId | null }
export interface Choice { ids: BoonId[]; gold: boolean; t: number }
export interface Tally { t: number; dur: number }
export interface MissionState {
  spec: MissionSpec;
  /** the wave fighting now (0…2), a breather before the next (s), the mission's end card (s) */
  wave: number;
  gap: number;
  won: number;
  /** the slots that fell in this mission (stars) */
  fallen: Set<number>;
  /** the Din's shyness against a weaker team (× its power) and its heart after wipes */
  shy: number;
  heart: number;
  stars: number;
}

export type SimEvent =
  | BattleEvent
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'fog'; share: number }
  | { type: 'finale' }
  | { type: 'done' }
  | { type: 'mission'; index: number; floor: number; boss: boolean }
  | { type: 'wave'; n: number; all: number }
  | { type: 'surge'; n: number }
  | { type: 'won'; stars: number; index: number; floor: number; boss: boolean }
  | { type: 'harmonyReady' }
  | { type: 'harmony'; n: number }
  | { type: 'wipe' }
  | { type: 'standUp' }
  | { type: 'well' }
  | { type: 'leaveWell' }
  | { type: 'choice'; gold: boolean }
  | { type: 'pick'; id: BoonId; gold: boolean }
  | { type: 'equip'; slot: number; kind: number; rankUp: boolean; rank: number }
  | { type: 'piece'; kind: number; x: number; y: number }
  | { type: 'level'; slot: number; lv: number }
  | { type: 'star'; hero: HeroId; stars: number }
  | { type: 'join'; hero: HeroId }
  | { type: 'chapter'; index: number }
  | { type: 'chest'; pieces: number }
  | { type: 'nope'; slot: number }
  | { type: 'coach'; what: Coach; at: CoachAt };

const NO_EVENTS: readonly SimEvent[] = [];
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

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
 * 3, 6 s in a 40 s test); then push / rest pairs (26 ± 4 s and 22 ± 3 s, scaled to end on time,
 * jittered only when there is room) ending with a rest, leaving the last stretch at the end.  No
 * block under 12 s.
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
  for (let i = 0; i < pairs; i++) durs.push(span([R.push[0] - R.push[1], R.push[0] + R.push[1]], jitter ? rnd() : 0.5), span([R.rest[0] - R.rest[1], R.rest[0] + R.rest[1]], jitter ? rnd() : 0.5));
  const scale = left / durs.reduce((s, d) => s + d, 0);
  for (let i = 0; i < durs.length; i++) durs[i] *= scale;
  liftShort(durs, R.minBlock);
  durs.forEach((dur, i) => plan.push(b(i % 2 ? 'rest' : 'push', dur)));
  return plan;
}

/** The band's energy multiplier for a level: ×1 … ×3, ×2 at the threshold. */
export const multFor = (level: number): number => 1 + RULES.multK * clamp(level);

/** Stars of a mission by how many fell: 3, 2, 1. */
export const starsFor = (fallen: number): number => 3 - Math.min(2, Math.max(0, fallen));

/** The team that plays when the player never chose: newcomers take the flexible places, the oldest out. */
export function autoTeam(owned: readonly HeroId[]): HeroId[] {
  const core: HeroId[] = ['cierpliwosc', 'pokoj', 'dobroc'];
  const flex: HeroId[] = ['milosc', 'radosc'];
  for (const id of ['uprzejmosc', 'lagodnosc', 'wiernosc', 'opanowanie'] as HeroId[]) {
    if (!owned.includes(id)) continue;
    flex.shift();
    flex.push(id);
  }
  return [core[0], flex[0], flex[1], core[1], core[2]];
}

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: DziewiatkaProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

export class DziewiatkaSim {
  readonly p: DziewiatkaProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  readonly talk: Talk;
  readonly battle: Battle;
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly holdNeed: number;
  private readonly restLead: number;
  readonly finaleSec: number;

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
  private readonly stories: Story[] = [];
  tally: Tally | null = null;
  choice: Choice | null = null;
  mission: MissionState;
  /** the gold surge: seconds to the next shadow, and how many this block */
  private surgeT = 0;
  private surgeN = 0;
  /** seconds the current wave has been fought (the Din tires after a while) */
  private waveT = 0;
  /** heroes join at the next mission (a chapter's end) */
  private rebuildPending = false;
  private leavePending = false;

  // the band
  reliable = false;
  level = 0;
  calm = 0;
  calmShown = 0;
  /** the energy multiplier now, and as drawn (eased) */
  mult = 1;
  multShown = 1;
  harmony = 0;
  harmonyReady = false;
  private harmonyT = 0;
  maxHold = 0;
  private goodT = 0;
  private goodSaid = false;
  private relSec = 0;

  // boons in effect this session (shares)
  private boonDmg = 0;
  private boonGuard = 0;
  private boonSpeed = 0;
  private boonHp = 0;
  private kit = 0;
  /** the boon picked at the last rest's end (kept for the next session) */
  private lastPick: { id: BoonId; gold: boolean } | null = null;
  private finalChoice = false;

  // the session's numbers
  score = 0;
  missionsWon = 0;
  starsNow = 0;
  threeStars = 0;
  ultsNow = 0;
  harmoniesNow = 0;
  interruptsNow = 0;
  bossesNow: DinKind[] = [];
  chaptersNow: number[] = [];
  joinedNow: HeroId[] = [];
  rankUps: { id: HeroId; rank: number }[] = [];
  starUps: { id: HeroId; stars: number }[] = [];
  revivesNow = 0;
  wipesNow = 0;
  passedRests = 0;
  blindShare = -1;
  topFloor = 0;
  private settled = false;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  private readonly bestBefore: number | null;
  /** the shadow kinds met this session (first-time marks are once ever, in the progress) */
  private readonly met = new Set<DinKind>();
  private lastHushX = 10;
  private lastHushY = 0.5;

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
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng);
    this.talk = new Talk(LINES, init.rng);
    this.battle = new Battle(e => this.onBattle(e), init.rng);
    this.setTeam();
    this.mission = this.makeMission();
  }

  // ── views of the state ──────────────────────────────────────────
  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.phase === 'play'; }
  get pushBlock(): boolean { return this.block?.kind === 'push' && this.phase === 'play'; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.phase === 'play'; }
  get warmBlock(): boolean { return this.block?.kind === 'warmup' && this.phase === 'play'; }
  /** a sighted push block past its lead-in: the band drives the energy */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get leadIn(): number { return this.lead; }
  /** the world is held (a card, a choice, the wipe's tally) */
  get frozen(): boolean { return !!(this.story || this.choice || this.tally); }
  /** the battle runs (not at the well, not over) */
  get fighting(): boolean { return this.started && this.phase !== 'done' && !this.battle.atWell; }
  get atWell(): boolean { return this.battle.atWell; }
  get inTower(): boolean { return this.mission.spec.floor > 0; }
  get team(): HeroId[] { return this.battle.heroes.map(h => h.kind); }

  // ── the five ────────────────────────────────────────────────────
  private teamMods(): TeamMods {
    const team = this.p.team;
    return {
      dmg: familyBonus(team, 'dlonie') + this.boonDmg,
      guard: Math.min(0.6, familyBonus(team, 'korzenie') + this.boonGuard),
      speed: this.boonSpeed,
      heartEnergy: familyBonus(team, 'serce'),
      kit: this.kit,
    };
  }

  private setTeam(): void {
    const p = this.p;
    this.battle.setTeam(p.team.map(id => {
      const g = growth(p, id as HeroId);
      return { kind: id as HeroId, power: powerOf(g), rank: g.rank };
    }));
    for (const h of this.battle.heroes) this.regrow(h, false);
    this.battle.mods = this.teamMods();
  }

  /** A hero's numbers from its growth now (a level, a rank, a star, the soup): the share of health is kept. */
  private regrow(h: Hero, keepShare = true): void {
    const g = growth(this.p, h.kind);
    const power = powerOf(g);
    const share = keepShare && h.max > 0 ? h.hp / h.max : 1;
    h.max = Math.round(HEROES[h.kind].hp * power * (1 + this.boonHp));
    h.hp = h.down ? 0 : Math.max(1, Math.round(h.max * share));
    h.atk = HEROES[h.kind].atk * power;
    h.rank = g.rank;
  }

  /** A newcomer takes their place at a mission's start (when the player never chose the five). */
  private rebuildTeam(): void {
    const old = new Map(this.battle.heroes.map(h => [h.kind, { e: h.energy, share: h.max ? h.hp / h.max : 1, down: h.down }]));
    this.setTeam();
    for (const h of this.battle.heroes) {
      const o = old.get(h.kind);
      if (!o) { h.x = -0.5; continue; }
      h.energy = o.e;
      h.down = o.down;
      h.hp = o.down ? 0 : Math.max(1, Math.round(h.max * o.share));
    }
  }

  // ── the town: missions ──────────────────────────────────────────
  private makeMission(): MissionState {
    const p = this.p;
    const spec = campaignDone(p)
      ? towerFloor(p.floor, RULES.powerStep ** (CAMPAIGN - 1), RULES.towerStep)
      : campaignMission(p.mission, RULES.powerStep);
    // the Din is shy against a team behind its pace (never more than shyFloor)
    const mean = this.battle.heroes.reduce((s, h) => s + powerOf(growth(p, h.kind)), 0) / Math.max(1, this.battle.heroes.length);
    const shy = clamp(mean / Math.max(1, spec.power * 0.9), RULES.shyFloor, 1);
    return { spec, wave: -1, gap: 0.6, won: 0, fallen: new Set(), shy, heart: 1, stars: 3 };
  }

  private get missionIndexForXp(): number {
    const s = this.mission.spec;
    return s.floor > 0 ? CAMPAIGN - 1 + Math.floor(s.floor / 2) : s.index;
  }

  /** The next wave walks in: its shadows one by one (one more in a push block). */
  private startWave(n: number): void {
    const m = this.mission, spec = m.spec;
    m.wave = n;
    this.waveT = 0;
    const kinds = [...spec.waves[n].kinds];
    if (this.pushBlock) for (let i = 0; i < RULES.pushExtra; i++) kinds.push(this.smallKind());
    const power = spec.power * m.shy * m.heart;
    kinds.forEach((k, i) => this.battle.spawn(k, power, i * RULES.spawnGap));
    this.battle.newWave();
    this.emit({ type: 'wave', n: n + 1, all: spec.waves.length });
    if (n > 0) this.talk.ask('wave', 1, 4);
    if (kinds.some(k => DIN[k].boss)) this.talk.ask('boss', 4, 8);
  }

  /** a small shadow of the mission's district (the surge, the push block's extra) */
  private smallKind(): ShadowKind {
    const pool = this.mission.spec.chapter.pool;
    const small = pool.filter(k => DIN[k].hp <= 100);
    return small.length ? small[Math.floor(this.rng() * small.length)] : 'rozproszek';
  }

  private missionFrame(dt: number, w: number): void {
    const m = this.mission;
    if (this.tally || !this.fighting) return;
    if (m.won > 0) {
      m.won -= w;
      if (m.won <= 0) this.nextMission();
      return;
    }
    if (this.battle.din.length) {
      // the Din tires: a wave fought too long fades (never a wall)
      if (m.wave >= 0) {
        this.waveT += w;
        if (this.waveT > RULES.tireAfter) this.battle.tire(w);
      }
      return;
    }
    if (m.wave < 0) {
      m.gap -= w;
      if (m.gap <= 0) {
        this.emit({ type: 'mission', index: m.spec.index, floor: m.spec.floor, boss: !!m.spec.boss });
        this.startWave(0);
      }
      return;
    }
    // the wave is quiet
    if (m.gap <= 0) {
      m.gap = RULES.waveGap;
      this.waveCleared();
      if (m.wave >= m.spec.waves.length - 1) {
        this.missionWon();
        return;
      }
    }
    m.gap -= w;
    if (m.gap <= 0) this.startWave(m.wave + 1);
    void dt;
  }

  /** XP to the five, now and then a piece of gear and a note. */
  private waveCleared(): void {
    const p = this.p;
    const xp = RULES.xpWave + RULES.xpStep * this.missionIndexForXp;
    for (const h of this.battle.heroes) {
      const up = addXp(growth(p, h.kind), xp);
      if (up > 0) {
        this.regrow(h);
        this.emit({ type: 'level', slot: h.slot, lv: growth(p, h.kind).lv });
      }
    }
    if (this.rng() < RULES.pieceWave) this.givePiece(1);
    const lucky = this.battle.heroes[Math.floor(this.rng() * this.battle.heroes.length)];
    if (lucky) this.giveNotes(lucky.kind, 1);
  }

  /** Pieces of gear for the bag: mostly a kind the five still need (the original's "featured items"). */
  private givePiece(n: number): void {
    for (let i = 0; i < n; i++) {
      const need = neededKinds(this.p);
      const k = need.length && this.rng() < 0.75 ? need[Math.floor(this.rng() * need.length)] : Math.floor(this.rng() * PIECES);
      this.p.bag[k]++;
      this.emit({ type: 'piece', kind: k, x: this.lastHushX, y: this.lastHushY });
    }
  }

  private giveNotes(id: HeroId, n: number): void {
    const g = growth(this.p, id);
    const up = addNotes(g, n);
    if (up > 0) {
      this.starUps.push({ id, stars: g.stars });
      this.emit({ type: 'star', hero: id, stars: g.stars });
      const h = this.battle.heroes.find(x => x.kind === id);
      if (h) this.regrow(h);
    }
  }

  private missionWon(): void {
    const m = this.mission, p = this.p, spec = m.spec;
    const stars = starsFor(m.fallen.size);
    m.stars = stars;
    m.won = RULES.missionGap;
    this.missionsWon++;
    this.starsNow += stars;
    if (stars === 3) this.threeStars++;
    this.emit({ type: 'won', stars, index: spec.index, floor: spec.floor, boss: !!spec.boss });
    this.talk.ask(stars === 3 ? 'stars3' : 'mission', 3, 5);
    this.givePiece(1 + (stars === 3 ? 1 : 0) + (spec.boss ? 2 : 0));
    this.giveNotes(spec.notesOf, 2 + stars);
    if (spec.floor > 0) {
      p.towerBest = Math.max(p.towerBest, spec.floor);
      this.topFloor = Math.max(this.topFloor, spec.floor);
      // a chest every third floor
      if (spec.floor % 3 === 0) {
        this.givePiece(3);
        this.emit({ type: 'chest', pieces: 3 });
        const owned = p.owned as HeroId[];
        this.giveNotes(owned[Math.floor(this.rng() * owned.length)], 6);
      }
      p.floor = spec.floor + 1;
      return;
    }
    recordStars(p, spec.index, stars);
    if (spec.index === p.mission) p.mission = Math.min(CAMPAIGN, p.mission + 1);
    const c = Math.floor(spec.index / MISSIONS_PER_CHAPTER);
    // a district quiet: its card (the tower's after the last)
    if (spec.index % MISSIONS_PER_CHAPTER === MISSIONS_PER_CHAPTER - 1) {
      this.chaptersNow.push(c);
      this.emit({ type: 'chapter', index: c });
      this.stories.push({ kind: 'chapter', t: 0, dur: RULES.storySec, chapter: c, hero: null });
      if (c === CHAPTERS.length - 1) this.stories.push({ kind: 'tower', t: 0, dur: RULES.storySec + 1, chapter: c, hero: null });
    }
    // newcomers: their card, and a flexible place in the five (until the player chooses the five)
    for (const id of joiningAfter(spec.index)) {
      if (p.owned.includes(id)) continue;
      p.owned.push(id);
      this.joinedNow.push(id);
      this.emit({ type: 'join', hero: id });
      this.talk.ask('join', 3, 8);
      this.stories.push({ kind: 'join', t: 0, dur: RULES.storySec, chapter: c, hero: id });
      if (!p.seen.includes('teamSet')) {
        p.team = autoTeam(p.owned as HeroId[]);
        this.rebuildPending = true;
      }
    }
  }

  private nextMission(): void {
    if (this.rebuildPending) {
      this.rebuildPending = false;
      this.rebuildTeam();
    }
    this.mission = this.makeMission();
  }

  // ── input ───────────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.session === 1) this.story = { kind: 'open', t: 0, dur: RULES.openSec, chapter: 0, hero: null };
    // a boon kept from the last session
    if (isBoonId(this.p.boon)) {
      this.applyBoon(this.p.boon, this.p.boonGold);
      this.p.boon = '';
      this.p.boonGold = false;
    }
    this.startBlock(0);
    this.talk.ask('open', 3, 10);
  }

  /**
   * A tap on the street (or Space): closes a card that has been read; at the well sews a piece onto
   * the hero closest to a new rank; in battle rings a ready Harmony, else fires the ultimate that has
   * waited longest.  Anything else: nothing (a tap never hurts).
   */
  tap(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= 0.6) this.closeStory();
      return true;
    }
    if (this.tally) return true;
    if (this.choice) return false;
    if (this.atWell) {
      const id = nextToEquip(this.p);
      return id ? this.sew(id) : false;
    }
    if (this.harmonyReady && this.ringHarmony()) return true;
    const h = this.battle.readyHeroes[0];
    if (h) return this.fireHero(h, false);
    return false;
  }

  /** A tap on a portrait: in battle that hero's ultimate; at the well a piece of gear for them. */
  tapSlot(slot: number): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story || this.tally) return this.tap();
    if (this.choice) return false;
    const h = this.battle.heroBySlot(slot);
    if (!h) return false;
    if (this.atWell) return this.sew(h.kind) || (this.emit({ type: 'nope', slot }), false);
    if (this.fireHero(h, false)) return true;
    this.emit({ type: 'nope', slot });
    return false;
  }

  /** A tap on the bell: Harmony, when it is ready. */
  tapBell(): boolean {
    if (!this.started || this.phase === 'done' || this.frozen) return this.tap();
    return this.ringHarmony();
  }

  /** Pick a boon (`i` 0…2) from the choice. */
  pick(i: number): boolean {
    const c = this.choice;
    if (!c || c.t < 0.25) return false;
    const id = c.ids[Math.max(0, Math.min(c.ids.length - 1, i))];
    this.choice = null;
    this.applyBoon(id, c.gold);
    this.emit({ type: 'pick', id, gold: c.gold });
    this.talk.ask('boon', 2, 4);
    if (this.finalChoice) this.lastPick = { id, gold: c.gold };
    if (this.leavePending) this.leaveWell();
    return true;
  }

  /** Space and Enter tap (or take the first boon), 1–5 the portraits (or 1–3 a boon), B the bell. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (!down) return k === ' ' || k === 'Enter';
    if (k === ' ' || k === 'Enter' || k === 'Spacebar') {
      if (this.choice) this.pick(0); else this.tap();
      return true;
    }
    if (/^[1-5]$/.test(k)) {
      const i = Number(k) - 1;
      if (this.choice) { if (i < 3) this.pick(i); } else this.tapSlot(i);
      return true;
    }
    if (k === 'b' || k === 'h') {
      this.tapBell();
      return true;
    }
    return false;
  }

  private fireHero(h: Hero, auto: boolean): boolean {
    if (!this.fighting || this.frozen) return false;
    if (!this.battle.fire(h, auto)) return false;
    return true;
  }

  private sew(id: HeroId): boolean {
    const r = equip(this.p, id);
    if (!r) return false;
    const h = this.battle.heroes.find(x => x.kind === id);
    if (r.rankUp) {
      const g = growth(this.p, id);
      this.rankUps.push({ id, rank: g.rank });
      if (h) this.regrow(h);
      this.talk.ask('rank', 3, 4);
    }
    this.emit({ type: 'equip', slot: h?.slot ?? -1, kind: r.kind, rankUp: r.rankUp, rank: growth(this.p, id).rank });
    return true;
  }

  private ringHarmony(): boolean {
    if (!this.harmonyReady || !this.fighting || this.frozen) return false;
    this.harmonyReady = false;
    this.harmony = 0;
    this.harmonyT = 0;
    const n = this.battle.chord();
    this.harmoniesNow++;
    this.emit({ type: 'harmony', n });
    this.talk.ask('harmony', 5, 5);
    return true;
  }

  private closeStory(): void {
    this.story = this.stories.shift() ?? null;
  }

  // ── boons ───────────────────────────────────────────────────────
  private offerChoice(gold: boolean): void {
    const ids = [...BOON_IDS];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    // the bell's key only when Harmony is not full already
    const pool = ids.filter(id => !(id === 'klucz' && this.harmonyReady));
    this.choice = { ids: pool.slice(0, 3), gold, t: 0 };
    this.emit({ type: 'choice', gold });
    this.coach('boon', { at: 'card' });
  }

  private applyBoon(id: BoonId, gold: boolean): void {
    const v = BOONS[id][gold ? 1 : 0];
    switch (id) {
      case 'piesn': for (const h of this.battle.standing) this.battle.gain(h, v, true); break;
      case 'zupa':
        this.boonHp += v / 100;
        for (const h of this.battle.heroes) { this.regrow(h); if (!h.down) h.hp = h.max; }
        break;
      case 'szal': this.boonGuard += v / 100; break;
      case 'werbel': this.boonSpeed += v / 100; break;
      case 'pierniki': this.boonDmg += v / 100; break;
      case 'klucz': this.addHarmony(v / 100); break;
      case 'apteczka': this.kit = Math.max(this.kit, v / 100); break;
      case 'kieszenie': this.givePiece(v); break;
    }
    this.battle.mods = this.teamMods();
  }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    const B = this.battle;
    B.stop = Math.max(0, B.stop - dt);
    const held = this.frozen || B.stop > 0 || this.phase === 'done';
    const w = held ? 0 : dt;
    if (this.story) {
      this.story.t += dt;
      if (this.story.t >= this.story.dur) this.closeStory();
    } else if (this.choice) {
      this.choice.t += dt;
      if (this.choice.t >= RULES.choiceSec) this.pick(0);
    } else if (this.tally) {
      this.tally.t += dt;
      if (this.tally.t >= this.tally.dur) this.standUp();
    } else if (this.stories.length && !this.tally) {
      this.story = this.stories.shift()!;
    }
    this.brain(dt, w, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.endFinale();
    if (w > 0) {
      B.mods.kit = this.kit;
      B.update(w);
      this.kit = B.mods.kit;
      this.well(w, f);
      this.missionFrame(dt, w);
      if (this.fighting && !this.tally) {
        const h = B.autoFire();
        if (h) void h;
        if (this.harmonyReady && B.din.some(d => d.enter <= 0 && !d.doze)) {
          this.harmonyT += w;
          if (this.harmonyT >= RULES.harmonyAuto) this.ringHarmony();
        }
      }
      B.meetAll(k => this.met.has(k));
      if (this.fighting && B.wiped && !this.tally) this.wipe();
    }
    // the score follows the battle's hushes
    if (B.hushed !== this.score) this.score = B.hushed;
    this.talk.update(dt, t, this.talkBlocked);
  }

  get talkBlocked(): boolean {
    const b = this.block;
    const tele = this.phase === 'play' && b && this.blockT >= b.dur - RULES.telegraph;
    const banner = this.phase === 'play' && this.blockT < RULES.bannerSec && this.blockIndex > 0;
    return !!(tele || banner || this.story || this.tally || this.choice);
  }

  /** The band's slow quantities: the energy multiplier, Harmony from a held focus; the well's calm. */
  private brain(dt: number, _w: number, f: FocusFrame): void {
    const R = RULES;
    const play = this.phase === 'play';
    this.reliable = f.reliable;
    this.level = f.reliable ? f.level : 0;
    this.calm = f.reliable ? f.calm : 0;
    this.calmShown = approach(this.calmShown, this.calm, dt, 0.6);
    if (play && f.reliable) this.relSec += dt;
    const live = this.sighted && f.reliable;
    const warm = this.session === 1 && this.warmBlock;
    this.mult = (live ? multFor(f.level) : 1) * (warm ? R.warmBoost : 1);
    this.multShown = approach(this.multShown, live ? multFor(f.level) : 1, dt, 0.35);
    this.battle.mult = this.mult;
    if (live) this.maxHold = Math.max(this.maxHold, f.hold);
    if (live && f.hold >= this.holdNeed && !this.harmonyReady) this.addHarmony(R.harmonyRate * dt);
    if (live && f.level >= 0.5) this.goodT += dt;
    else this.goodT = 0;
    if (this.goodT >= R.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 4);
    }
    if (live && this.blockT >= this.lead + 0.5) this.coach('mult', { at: 'dial' });
  }

  private addHarmony(v: number): void {
    if (this.harmonyReady || !(v > 0)) return;
    this.harmony = Math.min(1, this.harmony + v);
    if (this.harmony >= 1 - 1e-9) {
      this.harmony = 1;
      this.harmonyReady = true;
      this.harmonyT = 0;
      this.emit({ type: 'harmonyReady' });
      this.talk.ask('harmonyReady', 4, 5);
      this.coach('bell', { at: 'bell' });
    }
  }

  /** The well: calm (and time) heals; the fallen stand up. */
  private well(w: number, f: FocusFrame): void {
    if (!this.atWell || !this.restBlock || this.blockT < this.restLead) return;
    const rate = RULES.healBase + RULES.healCalm * (f.reliable ? f.calm : 0);
    for (const h of this.battle.heroes) {
      h.hp = Math.min(h.max, h.hp + h.max * rate * w);
      if (h.down && h.hp >= h.max * RULES.standAt) {
        h.down = false;
        this.emit({ type: 'revive', slot: h.slot, x: h.x, y: h.y });
      }
    }
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
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('well', { at: 'well' });
    // the push block's peak: as the lead-in ends the Din surges
    if (b.kind === 'push' && !b.blind && this.blockT >= this.lead && this.blockT - dt < this.lead && this.fighting && this.mission.wave >= 0 && this.mission.won <= 0) {
      const power = this.mission.spec.power * this.mission.shy * this.mission.heart * 0.8;
      for (let i = 0; i < R.surge; i++) this.battle.spawn(this.smallKind(), power, 0.3 + i * 0.4);
      this.emit({ type: 'surge', n: R.surge });
      this.talk.ask('surge', 2, 4);
    }
    // while the multiplier is gold the Din keeps answering: one more small shadow now and then
    if (b.kind === 'push' && this.sighted && this.reliable && this.mult >= multFor(0.5) && this.surgeN < R.surgeCap
      && this.fighting && !this.frozen && !this.tally && this.mission.wave >= 0 && this.mission.won <= 0) {
      this.surgeT -= dt;
      if (this.surgeT <= 0) {
        this.surgeT = R.surgeEvery;
        this.surgeN++;
        this.battle.spawn(this.smallKind(), this.mission.spec.power * this.mission.shy * this.mission.heart * 0.8, 0);
      }
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
      this.surgeN = 0;
      this.surgeT = RULES.surgeEvery;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.goodT = 0;
      this.goodSaid = false;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
      if (this.atWell) {
        if (this.choice) this.leavePending = true;
        else this.leaveWell();
      }
    } else if (b.kind === 'rest') {
      this.talk.ask('rest', 2, 12);
      this.battle.toWell();
      this.emit({ type: 'well' });
    } else {
      this.talk.ask('warm', 1, 8);
    }
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private leaveWell(): void {
    this.leavePending = false;
    if (!this.atWell) return;
    // the fallen are on their feet when the team leaves the well
    for (const h of this.battle.heroes) {
      if (h.down) {
        h.down = false;
        h.hp = Math.max(h.hp, Math.round(h.max * RULES.standAt));
      } else h.hp = Math.max(h.hp, Math.round(h.max * RULES.standAt));
    }
    this.battle.fromWell();
    this.emit({ type: 'leaveWell' });
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
      if (b.kind === 'push') {
        if (b.blind) {
          const s = this.judge.measured > 0 ? share : 0;
          this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
          this.addHarmony(s * RULES.blindPay);
          this.emit({ type: 'fog', share: s });
        }
      } else {
        if (verdict) this.passedRests++;
        // Klara sews on what nobody tapped, and the well's gift: one of three boons (golden after a calm rest)
        for (const r of equipAll(this.p)) {
          const h = this.battle.heroes.find(x => x.kind === r.id);
          if (r.rankUp) {
            const g = growth(this.p, r.id);
            this.rankUps.push({ id: r.id, rank: g.rank });
            if (h) this.regrow(h);
          }
          this.emit({ type: 'equip', slot: h?.slot ?? -1, kind: -1, rankUp: r.rankUp, rank: growth(this.p, r.id).rank });
        }
        this.finalChoice = this.blockIndex >= this.plan.length - 1 || this.t >= this.plannedSec - this.finaleSec - 0.5;
        if (!this.ending) this.offerChoice(verdict === true);
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  // ── grace ───────────────────────────────────────────────────────
  private wipe(): void {
    this.tally = { t: 0, dur: RULES.wipeSec };
    this.wipesNow++;
    for (const h of this.battle.heroes) this.mission.fallen.add(h.slot);
    this.emit({ type: 'wipe' });
    this.talk.clear();
    this.talk.ask('wipe', 5, 6);
  }

  private standUp(): void {
    this.tally = null;
    this.mission.heart *= RULES.wipeHeart;
    this.battle.standUp(RULES.wipeUp, RULES.wipeHeart);
    this.emit({ type: 'standUp' });
  }

  // ── the battle's news ───────────────────────────────────────────
  private onBattle(e: BattleEvent): void {
    switch (e.type) {
      case 'hush':
        this.lastHushX = e.x;
        this.lastHushY = e.y;
        if (e.boss) {
          this.bossesNow.push(e.kind);
          this.talk.ask('bossDown', 5, 6);
        }
        break;
      case 'ready':
        this.coach('ult', { at: 'slot', slot: e.slot });
        break;
      case 'ult':
        if (!e.chord) {
          this.ultsNow++;
          this.coach('tap', { at: 'centre' });
          if (e.kind === 'uprzejmosc') this.talk.ask('tea', 2, 3);
          else if (e.kind === 'radosc') this.talk.ask('song', 2, 3);
          else if (!e.auto && this.rng() < 0.35) this.talk.ask('ult', 1, 3);
        }
        break;
      case 'fall':
        if (this.fighting) this.mission.fallen.add(e.slot);
        this.talk.ask('fall', 3, 4);
        break;
      case 'near':
        this.talk.ask('near', 2, 3);
        break;
      case 'revive':
        this.revivesNow++;
        break;
      case 'interrupt':
        this.interruptsNow++;
        this.talk.ask('interrupt', 3, 4);
        break;
      case 'wind':
        this.coach('wind', { at: 'field', x: e.x, y: e.y });
        break;
      case 'meet':
        this.meet(e.kind);
        break;
      default:
        break;
    }
    this.emit(e);
  }

  /** A kind of shadow comes into sight the first time: its explanation (once ever). */
  private meet(k: DinKind): void {
    if (this.met.has(k)) return;
    this.met.add(k);
    const d = this.battle.din.find(x => x.kind === k && x.enter <= 0);
    const at: CoachAt = d ? { at: 'field', x: d.x, y: d.y } : { at: 'centre' };
    const what: Partial<Record<DinKind, Coach>> = {
      klotniak: 'split', gniewosz: 'swell', pyszalek: 'shield', rozproszek: 'steal', pospiech: 'rush', leniwiec: 'yawn', zazdrosnik: 'copy', plotka: 'whisper',
    };
    const c = DIN[k].boss ? 'boss' : what[k];
    // the very first Scatterflies come with the first lesson: their mark waits for a second meeting
    if (c && !(k === 'rozproszek' && this.session === 1 && this.missionsWon === 0)) this.coach(c, at);
  }

  // ── coach marks ─────────────────────────────────────────────────
  /** A first-time explanation (once ever): the index turns it into the runner's coach mark. */
  private coach(what: Coach, at: CoachAt): void {
    if (this.p.seen.includes(what)) return;
    this.p.seen.push(what);
    this.emit({ type: 'coach', what, at });
  }

  // ── the end ─────────────────────────────────────────────────────
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    if (this.atWell && !this.choice) this.leaveWell();
    else if (this.atWell) this.leavePending = true;
    this.emit({ type: 'finale' });
  }

  private endFinale(): void {
    if (this.phase === 'done') return;
    if (this.choice) {
      this.choice.t = Math.max(this.choice.t, 1);
      this.pick(0);
    }
    this.phase = 'done';
    this.story = null;
    this.stories.length = 0;
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
    p.total += this.score;
    p.lastLen = this.plannedSec;
    p.missions += this.missionsWon;
    p.ults += this.ultsNow;
    p.harmonies += this.harmoniesNow;
    p.interrupts += this.interruptsNow;
    p.bosses += this.bossesNow.length;
    if (this.lastPick) {
      p.boon = this.lastPick.id;
      p.boonGold = this.lastPick.gold;
    }
  }

  /** The session ends before its own end: settle as the end would. */
  finish(): void {
    if (!this.started || this.settled) return;
    this.ending = true;
    if (this.phase === 'play') this.endBlock();
    this.choice = null;
    this.settle();
    this.phase = 'done';
  }

  /** the session is being cut short: a block's end pays its verdict but offers no choice */
  private ending = false;

  // ── output ──────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The panel's gauge: the energy multiplier as a share (×1 → 0, ×2 → ½, ×3 → 1) in a sighted push, calm at the well; null blind, without signal or in the lead-in. */
  meter(): number | null {
    if (!this.started || !this.reliable) return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp((this.multShown - 1) / RULES.multK);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  /** The pad follows the multiplier in a sighted push, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp((this.multShown - 1) / RULES.multK);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** Where the five are in the town (the headline's second line, the summary). */
  get where(): string {
    const s = this.mission.spec;
    if (s.floor > 0) return t('stat.whereTower', { n: s.floor });
    return t('stat.whereMission', { c: Math.floor(s.index / MISSIONS_PER_CHAPTER) + 1, m: (s.index % MISSIONS_PER_CHAPTER) + 1 });
  }

  /** The headline's second line: near the record, or where the five are. */
  get headlineSub(): string {
    const best = this.bestBefore;
    if (best !== null && this.score < best && best - this.score <= Math.max(10, best * 0.25)) return t('hud.subBest', { n: best - this.score });
    const s = this.mission.spec;
    if (s.floor > 0) return t('hud.subTower', { n: s.floor });
    return t('hud.sub', { c: Math.floor(s.index / MISSIONS_PER_CHAPTER) + 1, m: (s.index % MISSIONS_PER_CHAPTER) + 1 });
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.missions'), String(this.missionsWon)],
      [t('stat.stars'), `${this.starsNow}★`],
      [t('stat.ults'), String(this.ultsNow)],
      [t('stat.harmony'), String(this.harmoniesNow)],
      [t('stat.interrupts'), String(this.interruptsNow)],
      [t('stat.where'), this.where],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: the first
   * session, a chord (Col 3:14, love the bond), a boss or a district hushed (Rom 12:21), wind-ups
   * broken (Prov 16:32), the fallen carried back (1 Cor 13:7), calm rests (Jas 1:19, Eccl 3:7);
   * else Galatians 5:22-23.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('gal5.22-23');
    if (this.harmoniesNow > 0) fit.push('col3.14');
    if (this.bossesNow.length || this.chaptersNow.length) fit.push('rom12.21');
    if (this.interruptsNow >= 2) fit.push('pro16.32');
    if (this.revivesNow > 0 || this.wipesNow > 0) fit.push('1co13.7');
    if (this.passedRests > 0) fit.push('jas1.19');
    if (this.passedRests >= 2 || this.plannedSec >= 300) fit.push('ecc3.7');
    fit.push('gal5.22-23');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.harmoniesNow > 0) add(0, t('hl.close.bell'));
    else if (this.chaptersNow.length) add(0, t('hl.close.chapter', { ch: cap(chapterName(CHAPTERS[this.chaptersNow[this.chaptersNow.length - 1]].id)) }));
    else if (this.started) add(0, t('hl.close.plain', { hushed: hushedText(this.score) }));
    for (const c of this.chaptersNow) add(1, t('hl.chapter', { ch: cap(chapterName(CHAPTERS[c].id)) }));
    for (const id of this.joinedNow) add(1, t('hl.join', { name: heroName(id) }));
    for (const k of [...new Set(this.bossesNow)]) add(2, t('hl.boss', { name: cap(dinName(k)) }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(3, t('hl.record', { hushed: hushedText(this.score) }));
    else if (this.bestBefore !== null && this.score > 0 && this.bestBefore > this.score) add(3, t('hl.toBest', { n: this.bestBefore - this.score }));
    for (const r of this.rankUps.slice(-2)) add(4, t('hl.rank', { name: heroName(r.id), rank: rankName(r.rank) }));
    for (const s of this.starUps.slice(-2)) add(5, t('hl.star', { name: heroName(s.id), n: s.stars }));
    if (this.harmoniesNow > 0) add(5, t('hl.harmony', { n: this.harmoniesNow }));
    if (this.threeStars > 0) add(6, t('hl.stars3', { n: this.threeStars }));
    if (this.topFloor > 0) add(6, t('hl.floor', { n: this.topFloor }));
    if (this.interruptsNow > 0) add(7, t('hl.interrupts', { n: this.interruptsNow }));
    if (this.blindShare >= 0) add(8, t('hl.blind', { n: this.blindShare }));
    if (this.lastPick) add(9, t('hl.boonKept', { name: boonName(this.lastPick.id) }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 6).map(n => n.text);
  }
}
