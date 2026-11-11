/**
 * Dziewiątka's battle without a screen: five heroes against the Din's shadows on a side-view street,
 * after Hero Wars.  The heroes stand by their line (front, middle, back) and fight by themselves:
 * melee heroes step up to the front-most shadow, the others shoot from home.  Every basic attack or
 * skill gives energy (+100), every 1 % of health lost +10, every hush +300 — all times the band's
 * multiplier the session sets each frame (`mult`).  A full bar (1000) is an ultimate: the portrait's
 * tap fires it (`fire`), and the semi-auto fires it by itself after a role-wise wait.  The world holds
 * for a moment while it is cast (`stop`).  Harmony (`chord`) is all five at once.
 *
 * The shadows walk in from the right and go for the front-most hero (Pośpiechy for the back line,
 * Rozproszki for the one with the most energy, everybody for Patience behind her Wall).  Hushed, a
 * shadow dissolves into quiet: its worth goes to the headline.  Kłótniaki split, Gniewosze swell and
 * burst, Pyszałki hide behind a mirror, Leniwce yawn, Zazdrośniki copy buffs, Plotki whisper (no
 * ultimate), bosses wind up big specials and call their kind.  A wind-up is broken by a stun, sleep,
 * tea or Self-control's stroke ("Przerwane!").  A fallen hero sits out of breath until the well, a
 * revive or the chord lifts them.
 *
 * No DOM, no clock of its own: the session (sim.ts) calls `update(w)` with the world's seconds and
 * reads the event queue it passed in.
 */
import {
  DIN, HEROES, ZGIELK_PHASES, isBoss,
  type BossKind, type DinKind, type DinSpec, type HeroId, type HeroSpec, type Line, type Special,
} from './content';
import { RULES } from './rules';

export interface Hero {
  id: number;
  kind: HeroId;
  spec: HeroSpec;
  /** the portrait's index (0…4) */
  slot: number;
  x: number;
  y: number;
  home: number;
  /** a slide (knockback) in u/s */
  vx: number;
  hp: number;
  max: number;
  atk: number;
  cd: number;
  range: number;
  armor: number;
  rank: number;
  atkT: number;
  energy: number;
  /** seconds since the bar filled (the semi-auto's wait) */
  readyT: number;
  down: boolean;
  /** when it fell (the session's battle clock), for Faithfulness's revive */
  fellAt: number;
  /** statuses (seconds left) */
  stun: number;
  silence: number;
  slow: number;
  haste: number;
  dmgUp: number;
  wall: number;
  wallStore: number;
  guardT: number;
  /** the ally this hero guards (unit id, −1 none) */
  guardOf: number;
  shield: number;
  blueT: number;
  /** Self-control: seconds since last hit (his green crit), a parry waiting */
  calmT: number;
  parry: boolean;
  /** Faithfulness's green: a killing blow on an ally taken once per wave */
  intercept: boolean;
  attacks: number;
  /** animation timers */
  hit: number;
  act: number;
  cast: number;
  dash: number;
  dashTo: number;
}

export interface Din {
  id: number;
  kind: DinKind;
  spec: DinSpec;
  x: number;
  y: number;
  vx: number;
  hp: number;
  max: number;
  atk: number;
  cd: number;
  range: number;
  speed: number;
  armor: number;
  worth: number;
  atkT: number;
  /** waiting to walk in (s), dozing at the rest */
  enter: number;
  doze: boolean;
  /** statuses (seconds left) */
  stun: number;
  sleep: boolean;
  firm: number;
  tea: number;
  blind: number;
  weak: number;
  daze: number;
  taunt: number;
  tauntBy: number;
  copyHaste: number;
  copyUp: number;
  /** Gniewosz's swell, the mirror's health and its regrowth */
  swell: number;
  mirror: number;
  mirrorMax: number;
  mirrorT: number;
  /** a wind-up under way (−1 none), its length, the special's timer; summons; a Leniwiec's yawn */
  windT: number;
  windDur: number;
  special: Special | null;
  specT: number;
  summonT: number;
  yawnT: number;
  split: boolean;
  /** Zgiełk's third (0…2) */
  phase: number;
  hit: number;
  act: number;
  /** forming out of the noise (s left): seen, but not yet acting */
  form: number;
}

export interface Shot { id: number; from: number; to: number; hero: boolean; kind: HeroId | DinKind; x: number; y: number; tx: number; ty: number; t: number; dur: number; dmg: number; pierce: boolean; sx: number; sy: number }

/** What the battle tells the session (and through it the view and the sound). */
export type BattleEvent =
  | { type: 'attack'; hero: boolean; kind: HeroId | DinKind; x: number; y: number; ranged: boolean }
  | { type: 'hit'; x: number; y: number; dmg: number; onHero: boolean; crit: boolean; big: boolean }
  | { type: 'heal'; x: number; y: number; v: number }
  | { type: 'hush'; kind: DinKind; x: number; y: number; worth: number; boss: boolean; size: number }
  | { type: 'split'; x: number; y: number }
  | { type: 'swell'; x: number; y: number; n: number }
  | { type: 'ready'; slot: number; kind: HeroId }
  | { type: 'ult'; slot: number; kind: HeroId; x: number; y: number; auto: boolean; chord: boolean }
  | { type: 'wallAnswer'; x: number; y: number; dmg: number }
  | { type: 'revive'; slot: number; x: number; y: number }
  | { type: 'fall'; slot: number; kind: HeroId; x: number; y: number }
  | { type: 'near'; slot: number }
  | { type: 'wind'; kind: DinKind; special: Special; x: number; y: number; boss: boolean }
  | { type: 'special'; kind: DinKind; special: Special; x: number; y: number }
  | { type: 'interrupt'; kind: DinKind; x: number; y: number; boss: boolean }
  | { type: 'steal'; x: number; y: number; slot: number }
  | { type: 'yawn'; x: number; y: number }
  | { type: 'copy'; x: number; y: number }
  | { type: 'whisper'; slot: number; x: number; y: number }
  | { type: 'summon'; kind: DinKind; n: number; x: number; y: number }
  | { type: 'mirrorBreak'; x: number; y: number }
  | { type: 'parry'; x: number; y: number }
  | { type: 'miss'; x: number; y: number }
  | { type: 'intercept'; x: number; y: number }
  | { type: 'chord'; n: number }
  | { type: 'form'; kind: DinKind; x: number; y: number; size: number }
  | { type: 'meet'; kind: DinKind };

/** The team-wide numbers the session gives the battle (boons, families). */
export interface TeamMods {
  /** damage dealt × (1 + dmg); damage taken × (1 − guard); attack speed × (1 + speed) */
  dmg: number;
  guard: number;
  speed: number;
  /** energy given to all five when a Heart fires its ultimate */
  heartEnergy: number;
  /** a fallen hero gets up with this share (Auntie's kit), once; 0 none */
  kit: number;
}

export const NO_MODS: TeamMods = { dmg: 0, guard: 0, speed: 0, heartEnergy: 0, kit: 0 };

const homeOf = (line: Line): number => RULES.home[line];
const LINE_ORDER: Readonly<Record<Line, number>> = { front: 0, mid: 1, back: 2 };
/** where each place in the line stands in depth (0 back of the street … 1 front) */
const ROWS = [0.55, 0.2, 0.85, 0.35, 0.75];

export class Battle {
  readonly heroes: Hero[] = [];
  readonly din: Din[] = [];
  readonly shots: Shot[] = [];
  /** the energy multiplier this frame (the band × the warm-up's boost), set by the session */
  mult = 1;
  mods: TeamMods = { ...NO_MODS };
  /** Love's bond over the whole five (s left) */
  bond = 0;
  /** hit-stop (s left): the session holds the world while it lasts */
  stop = 0;
  /** the battle's own clock (world seconds) */
  clock = 0;
  /** hushed worth gathered (the session adds it to the score) */
  hushed = 0;
  /** at the well: heroes sit, shadows doze */
  atWell = false;
  private nextId = 1;
  private nearSaid = new Set<number>();

  constructor(private readonly emit: (e: BattleEvent) => void, private readonly rnd: () => number) {}

  // ── the five ────────────────────────────────────────────────────
  /** Put the five on the street with their growth (× health and attack) and their ranks. */
  setTeam(team: readonly { kind: HeroId; power: number; rank: number }[]): void {
    this.heroes.length = 0;
    // a staggered line by attack range: the front line first, then the middle, then the back (Hero Wars places them so)
    const order = team.map((m, slot) => ({ slot, line: LINE_ORDER[HEROES[m.kind].line] })).sort((a, b) => a.line - b.line || a.slot - b.slot);
    const place = new Map(order.map((o, i) => [o.slot, i]));
    team.forEach((m, slot) => {
      const spec = HEROES[m.kind];
      const rank = place.get(slot) ?? slot;
      const home = homeOf('front') + 0.2 - rank * RULES.spacing;
      const max = Math.round(spec.hp * m.power);
      this.heroes.push({
        id: this.nextId++, kind: m.kind, spec, slot, x: home - 2, y: ROWS[rank % ROWS.length], home, vx: 0,
        hp: max, max, atk: spec.atk * m.power, cd: spec.cd, range: spec.range, armor: spec.armor, rank: m.rank,
        atkT: 0.4 + slot * 0.15, energy: 0, readyT: 0, down: false, fellAt: 0,
        stun: 0, silence: 0, slow: 0, haste: 0, dmgUp: 0, wall: 0, wallStore: 0, guardT: 0, guardOf: -1, shield: 0,
        blueT: RULES.skill.blueCd[m.kind] ?? 10, calmT: 0, parry: false, intercept: true, attacks: 0,
        hit: 0, act: 0, cast: 0, dash: 0, dashTo: 0,
      });
    });
  }

  get standing(): Hero[] { return this.heroes.filter(h => !h.down); }
  get alive(): Din[] { return this.din.filter(d => d.enter <= 0); }
  /** shadows on the street or about to walk in */
  get anyDin(): boolean { return this.din.length > 0; }
  get wiped(): boolean { return this.heroes.length > 0 && this.heroes.every(h => h.down); }
  heroBySlot(slot: number): Hero | undefined { return this.heroes.find(h => h.slot === slot); }
  ready(h: Hero): boolean { return !h.down && h.energy >= RULES.energyMax - 1e-6 && h.silence <= 0 && h.stun <= 0; }
  /** the ready heroes, longest waiting first */
  get readyHeroes(): Hero[] { return this.heroes.filter(h => this.ready(h)).sort((a, b) => b.readyT - a.readyT || a.slot - b.slot); }
  get winding(): Din[] { return this.din.filter(d => d.windT >= 0 && d.enter <= 0); }
  get boss(): Din | null { return this.din.find(d => d.spec.boss) ?? null; }

  // ── the Din ─────────────────────────────────────────────────────
  /** A shadow into the street (`delay` s before it walks in), its numbers × power. */
  spawn(kind: DinKind, power: number, delay = 0, at?: { x: number; y: number }): Din {
    const spec = DIN[kind];
    const max = Math.round(spec.hp * power);
    const d: Din = {
      id: this.nextId++, kind, spec, x: at?.x ?? (spec.boss ? RULES.formX[1] : RULES.formX[0] + this.rnd() * (RULES.formX[1] - RULES.formX[0])), y: at?.y ?? this.rnd(), vx: 0,
      hp: max, max, atk: spec.atk * power, cd: spec.cd, range: spec.range, speed: spec.speed, armor: spec.armor, worth: spec.worth,
      atkT: 0.6 + this.rnd() * 0.6, enter: delay, doze: this.atWell,
      stun: 0, sleep: false, firm: 0, tea: 0, blind: 0, weak: 0, daze: 0, taunt: 0, tauntBy: -1, copyHaste: 0, copyUp: 0,
      swell: 0, mirror: spec.mirror ? Math.round(max * spec.mirror) : 0, mirrorMax: spec.mirror ? Math.round(max * spec.mirror) : 0, mirrorT: 0,
      windT: -1, windDur: spec.wind ?? 2, special: spec.special ?? null, specT: spec.every ? spec.every * (0.55 + this.rnd() * 0.3) : 0,
      summonT: spec.summonEvery ?? 0, yawnT: kind === 'leniwiec' ? RULES.yawnEvery * (0.5 + this.rnd() * 0.5) : 0,
      split: kind === 'klotniaczek', phase: 0, hit: 0, act: 0, form: at ? 0 : RULES.formSec,
    };
    this.din.push(d);
    if (delay <= 0 && !at) this.emit({ type: 'form', kind, x: d.x, y: d.y, size: spec.size });
    return d;
  }

  /** The rest: the five walk to the well and sit, the shadows draw back and doze. */
  toWell(): void {
    this.atWell = true;
    this.shots.length = 0;
    for (const d of this.din) { d.doze = true; d.windT = -1; }
    for (const h of this.heroes) { h.wall = 0; h.guardT = 0; h.guardOf = -1; h.stun = 0; h.silence = 0; h.slow = 0; }
  }

  /** The rest is over: back to the line, the shadows wake. */
  fromWell(): void {
    this.atWell = false;
    for (const d of this.din) { d.doze = false; d.atkT = 0.8 + this.rnd() * 0.6; }
  }

  /** Where a hero sits at the well (u): around it, leaving the well itself in sight. */
  wellSeat(h: Hero): number { return RULES.wellX + [-2.3, 1.6, -1.45, 2.45, 3.3][h.slot % 5]; }

  /** A wipe: everyone gets up with a share of health at home; the shadows on the street lose heart and step back. */
  standUp(share: number, heart: number): void {
    for (const h of this.heroes) {
      h.down = false;
      h.hp = Math.max(h.hp, Math.round(h.max * share));
      h.x = h.home - 1.5;
      h.stun = 0; h.silence = 0; h.slow = 0; h.vx = 0;
    }
    this.shots.length = 0;
    for (const d of this.din) {
      d.hp = Math.max(1, Math.round(d.hp * heart));
      d.x = Math.max(d.x, RULES.spawnX - 2 + this.rnd());
      d.windT = -1;
      d.specT = Math.max(d.specT, 3);
    }
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(w: number): void {
    if (!(w > 0)) return;
    this.clock += w;
    this.bond = Math.max(0, this.bond - w);
    for (const h of this.heroes) this.heroFrame(h, w);
    for (const d of [...this.din]) this.dinFrame(d, w);
    this.shotsFrame(w);
  }

  private heroFrame(h: Hero, w: number): void {
    h.hit = Math.max(0, h.hit - w);
    h.act = Math.max(0, h.act - w);
    h.cast = Math.max(0, h.cast - w);
    h.dash = Math.max(0, h.dash - w);
    // a slide (knockback) fades
    if (h.vx) {
      h.x += h.vx * w;
      h.vx *= Math.exp(-RULES.knockDrag * w);
      if (Math.abs(h.vx) < 0.05) h.vx = 0;
      h.x = Math.max(0.6, h.x);
    }
    if (h.down) return;
    for (const k of ['stun', 'silence', 'slow', 'haste', 'dmgUp', 'guardT'] as const) h[k] = Math.max(0, h[k] - w);
    if (h.guardT <= 0) h.guardOf = -1;
    if (h.wall > 0) {
      h.wall -= w;
      if (h.wall <= 0) this.wallAnswer(h);
    }
    h.calmT += w;
    if (this.ready(h)) h.readyT += w;
    if (this.atWell) {
      // walk to the well and sit
      this.walkTo(h, this.wellSeat(h), w, 2.4);
      return;
    }
    if (h.stun > 0) return;
    // the blue skill on its timer (from the blue rank)
    if (h.rank >= RULES.skill.blueRank) {
      h.blueT -= w;
      if (h.blueT <= 0 && this.alive.length) {
        h.blueT = RULES.skill.blueCd[h.kind] ?? 10;
        this.blue(h);
      }
    }
    const target = this.targetOf(h);
    if (!target) {
      this.walkTo(h, h.home, w, 2);
      return;
    }
    const side = target.x >= h.x ? 1 : -1;
    const gap = Math.abs(target.x - h.x) - target.spec.size * 0.25;
    if (gap > h.range) {
      // melee heroes step toward their shadow (never far from home); the others hold the line
      if (h.range < 2.5) {
        const want = target.x - side * (target.spec.size * 0.25 + h.range * 0.85);
        this.walkTo(h, Math.max(h.home - 1.5, Math.min(h.home + RULES.reach, want)), w, 2.2);
      } else this.walkTo(h, h.home, w, 2);
      return;
    }
    h.atkT -= w * this.speedK(h);
    if (h.atkT > 0) return;
    h.atkT = h.cd;
    this.basicAttack(h, target);
  }

  private walkTo(h: Hero, x: number, w: number, speed: number): void {
    const d = x - h.x;
    if (Math.abs(d) < 0.02) return;
    h.x += Math.sign(d) * Math.min(Math.abs(d), speed * w);
  }

  private speedK(h: Hero): number {
    return (1 + this.mods.speed) * (h.haste > 0 ? RULES.ult.songHaste : 1) * (h.slow > 0 ? RULES.yawnSlow : 1)
      * (h.kind !== 'radosc' && this.heroes.some(o => o.kind === 'radosc' && !o.down && o.rank >= RULES.skill.greenRank) ? 1.08 : 1);
  }

  /** a hero's damage multiplier: families and boons, Love's bond, buffs */
  private dmgK(h: Hero): number {
    return (1 + this.mods.dmg) * (h.dmgUp > 0 ? 1 + RULES.ult.bondUp : 1);
  }

  private frontDin(): Din | null {
    let best: Din | null = null;
    for (const d of this.din) if (d.enter <= 0 && !d.doze && (!best || d.x < best.x)) best = d;
    return best;
  }

  /**
   * Whom a hero strikes: melee heroes the front-most shadow before them (a flier that slipped behind
   * only when nothing is ahead), shooters the shadow nearest to themselves (they defend the back line).
   */
  private targetOf(h: Hero): Din | null {
    let best: Din | null = null;
    if (h.range < 2.5) {
      for (const d of this.din) if (d.enter <= 0 && !d.doze && d.x >= h.x - 1.2 && (!best || d.x < best.x)) best = d;
      return best ?? this.frontDin();
    }
    for (const d of this.din) if (d.enter <= 0 && !d.doze && d.x < RULES.fieldW + 0.4 && (!best || Math.abs(d.x - h.x) < Math.abs(best.x - h.x))) best = d;
    return best;
  }

  private basicAttack(h: Hero, d: Din): void {
    h.act = 0.28;
    h.attacks++;
    this.gain(h, RULES.perAttack);
    let dmg = h.atk * this.dmgK(h);
    let crit = false;
    if (h.kind === 'opanowanie' && h.rank >= RULES.skill.greenRank && h.calmT >= 4) { dmg *= 2; crit = true; }
    if (h.kind === 'dobroc' && h.rank >= RULES.skill.greenRank && d.mirror > 0) dmg *= 1.4;
    const ranged = h.range >= 2.5;
    this.emit({ type: 'attack', hero: true, kind: h.kind, x: h.x, y: h.y, ranged });
    if (ranged) this.shoot(h.id, d.id, true, h.kind, h.x + 0.3, h.y, d.x, d.y, dmg, false);
    else this.hurtDin(d, dmg, h, { basic: true, crit });
    // green passives that ride a basic attack
    if (h.rank >= RULES.skill.greenRank) {
      if (h.kind === 'milosc') this.healLowest(0.03);
      if (h.kind === 'pokoj' && h.attacks % 3 === 0) this.healLowest(0.06);
      if (h.kind === 'uprzejmosc' && d.kind === 'gniewosz') d.swell = Math.max(0, d.swell - 1);
      if (h.kind === 'lagodnosc') d.weak = 3;
    }
  }

  private shoot(from: number, to: number, hero: boolean, kind: HeroId | DinKind, x: number, y: number, tx: number, ty: number, dmg: number, pierce: boolean): void {
    const dur = Math.max(0.12, Math.abs(tx - x) / RULES.shot);
    this.shots.push({ id: this.nextId++, from, to, hero, kind, x, y, tx, ty, t: 0, dur, dmg, pierce, sx: x, sy: y });
  }

  private shotsFrame(w: number): void {
    const landed: Shot[] = [];
    for (const s of this.shots) {
      s.t += w;
      const k = Math.min(1, s.t / s.dur);
      // follow the target while it moves
      if (s.hero) {
        const d = this.din.find(x => x.id === s.to);
        if (d) { s.tx = d.x; s.ty = d.y; }
      } else {
        const h = this.heroes.find(x => x.id === s.to);
        if (h) { s.tx = h.x; s.ty = h.y; }
      }
      s.x = s.sx + (s.tx - s.sx) * k;
      s.y = s.sy + (s.ty - s.sy) * k;
      if (k >= 1) landed.push(s);
    }
    if (!landed.length) return;
    for (let i = this.shots.length - 1; i >= 0; i--) if (landed.includes(this.shots[i])) this.shots.splice(i, 1);
    for (const s of landed) {
      if (s.hero) {
        const d = this.din.find(x => x.id === s.to);
        const h = this.heroes.find(x => x.id === s.from);
        if (d) this.hurtDin(d, s.dmg, h ?? null, { basic: true, pierce: s.pierce });
      } else {
        const h = this.heroes.find(x => x.id === s.to);
        const d = this.din.find(x => x.id === s.from);
        if (h && !h.down) this.hurtHero(h, s.dmg, d ?? null);
      }
    }
  }

  // ── energy ──────────────────────────────────────────────────────
  /** Energy for a hero (× the band's multiplier); a full bar announces itself once. */
  gain(h: Hero, v: number, plain = false): void {
    if (h.down || !(v > 0)) return;
    const before = h.energy;
    h.energy = Math.min(RULES.energyMax, h.energy + v * (plain ? 1 : this.mult));
    if (before < RULES.energyMax && h.energy >= RULES.energyMax - 1e-6) {
      h.energy = RULES.energyMax;
      h.readyT = 0;
      this.emit({ type: 'ready', slot: h.slot, kind: h.kind });
    }
  }

  // ── damage ──────────────────────────────────────────────────────
  hurtDin(d: Din, amount: number, src: Hero | null, o: { basic?: boolean; pierce?: boolean; crit?: boolean } = {}): void {
    if (!this.din.includes(d) || !(amount > 0)) return;
    let dmg = amount * (1 - d.armor) * (d.daze > 0 ? RULES.dazeK : 1);
    if (d.mirror > 0 && !o.pierce) {
      // the mirror takes the blow
      const onMirror = dmg;
      d.mirror -= onMirror;
      d.hit = 0.12;
      this.emit({ type: 'hit', x: d.x, y: d.y, dmg: Math.round(onMirror), onHero: false, crit: !!o.crit, big: false });
      if (d.mirror <= 0) {
        d.mirror = 0;
        d.mirrorT = RULES.mirrorBack;
        this.emit({ type: 'mirrorBreak', x: d.x, y: d.y });
      }
      return;
    }
    d.hp -= dmg;
    d.hit = 0.15;
    this.emit({ type: 'hit', x: d.x, y: d.y, dmg: Math.round(dmg), onHero: false, crit: !!o.crit, big: dmg >= d.max * 0.25 || !o.basic });
    if (d.sleep && d.firm <= 0) { d.sleep = false; d.stun = Math.min(d.stun, 0.2); }
    if (d.kind === 'gniewosz' && d.tea <= 0 && !d.sleep && d.windT < 0 && d.hp > 0) {
      d.swell = Math.min(RULES.swellMax, d.swell + 1);
      this.emit({ type: 'swell', x: d.x, y: d.y, n: d.swell });
      if (d.swell >= RULES.swellMax && d.stun <= 0) this.windUp(d, 'outburst');
    }
    if (d.kind === 'klotniak' && !d.split && d.hp > 0 && d.hp < d.max * RULES.splitAt) {
      this.splitDin(d, src);
      return;
    }
    if (d.hp <= 0) this.hushDin(d, src);
  }

  private splitDin(d: Din, src: Hero | null): void {
    d.split = true;
    const share = d.hp / d.max;
    const power = d.max / DIN.klotniak.hp;
    this.din.splice(this.din.indexOf(d), 1);
    this.hushed += d.worth;
    this.emit({ type: 'split', x: d.x, y: d.y });
    this.emit({ type: 'hush', kind: d.kind, x: d.x, y: d.y, worth: d.worth, boss: false, size: d.spec.size });
    if (src) this.gain(src, RULES.perHush * 0.5);
    for (let i = 0; i < RULES.splitN; i++) {
      const c = this.spawn('klotniaczek', power, 0, { x: d.x + (i ? 0.45 : -0.15), y: Math.max(0, Math.min(1, d.y + (i ? 0.25 : -0.25))) });
      c.hp = Math.max(1, Math.round(c.max * Math.max(0.6, share * 1.6)));
      c.atkT = 0.9;
    }
  }

  private hushDin(d: Din, src: Hero | null): void {
    const i = this.din.indexOf(d);
    if (i < 0) return;
    this.din.splice(i, 1);
    this.hushed += d.worth;
    this.emit({ type: 'hush', kind: d.kind, x: d.x, y: d.y, worth: d.worth, boss: !!d.spec.boss, size: d.spec.size });
    if (src) this.gain(src, RULES.perHush);
  }

  /** Damage on a hero: parries, blinds, armour, the five's guard, Patience's Wall, a guardian, Love's bond, shields; energy from the loss. */
  hurtHero(h: Hero, amount: number, src: Din | null, o: { noRedirect?: boolean } = {}): void {
    if (h.down || !(amount > 0)) return;
    if (h.parry) {
      h.parry = false;
      this.emit({ type: 'parry', x: h.x, y: h.y });
      return;
    }
    let dmg = amount * (src && src.weak > 0 ? 0.85 : 1) * (src && src.copyUp > 0 ? 1 + RULES.ult.bondUp : 1);
    dmg *= (1 - h.armor) * (1 - this.mods.guard);
    if (h.kind === 'cierpliwosc' && h.rank >= RULES.skill.greenRank && h.hp < h.max * 0.5) dmg *= 0.8;
    if (h.wall > 0) {
      h.wallStore += dmg;
      dmg *= 1 - RULES.ult.wallCut;
    }
    // a guardian takes a share
    if (!o.noRedirect) {
      const g = this.heroes.find(x => x !== h && !x.down && x.guardT > 0 && x.guardOf === h.id);
      if (g) {
        const share = dmg * RULES.ult.guardShare;
        dmg -= share;
        this.hurtHero(g, share / ((1 - g.armor) * (1 - this.mods.guard)), null, { noRedirect: true });
      }
      // Love's bond: the blow is shared by everyone standing
      if (this.bond > 0) {
        const all = this.standing;
        if (all.length > 1) {
          const part = dmg / all.length;
          for (const o2 of all) if (o2 !== h) this.applyHero(o2, part);
          dmg = part;
        }
      }
    }
    this.applyHero(h, dmg);
  }

  private applyHero(h: Hero, dmg: number): void {
    if (h.down) return;
    if (h.shield > 0) {
      const s = Math.min(h.shield, dmg);
      h.shield -= s;
      dmg -= s;
    }
    if (dmg <= 0) return;
    const before = h.hp;
    h.hp -= dmg;
    h.hit = 0.18;
    h.calmT = 0;
    this.emit({ type: 'hit', x: h.x, y: h.y, dmg: Math.round(dmg), onHero: true, crit: false, big: dmg >= h.max * 0.2 });
    // Hero Wars: +1 % of the bar for every 1 % of health lost
    this.gain(h, RULES.perPct * (Math.min(before, dmg) / h.max) * 100);
    if (h.hp < h.max * 0.25 && h.hp > 0 && !this.nearSaid.has(h.id)) {
      this.nearSaid.add(h.id);
      this.emit({ type: 'near', slot: h.slot });
    }
    if (h.hp > 0) return;
    // Faithfulness's green: she takes a killing blow on an ally once a wave
    const f = this.heroes.find(x => x.kind === 'wiernosc' && x !== h && !x.down && x.intercept && x.rank >= RULES.skill.greenRank && x.hp > x.max * 0.3);
    if (f) {
      f.intercept = false;
      h.hp = 1;
      f.hp = Math.max(1, f.hp - Math.min(f.hp * 0.5, dmg * 0.5));
      this.emit({ type: 'intercept', x: h.x, y: h.y });
      return;
    }
    if (this.mods.kit > 0) {
      h.hp = Math.round(h.max * this.mods.kit);
      this.mods.kit = 0;
      this.emit({ type: 'revive', slot: h.slot, x: h.x, y: h.y });
      return;
    }
    h.hp = 0;
    h.down = true;
    h.fellAt = this.clock;
    h.wall = 0;
    h.guardT = 0;
    h.guardOf = -1;
    h.shield = 0;
    for (const d of this.din) if (d.tauntBy === h.id) { d.taunt = 0; d.tauntBy = -1; }
    this.emit({ type: 'fall', slot: h.slot, kind: h.kind, x: h.x, y: h.y });
  }

  heal(h: Hero, share: number): void {
    if (h.down || !(share > 0)) return;
    const v = Math.min(h.max - h.hp, h.max * share);
    if (v <= 0) return;
    h.hp += v;
    if (h.hp > h.max * 0.4) this.nearSaid.delete(h.id);
    this.emit({ type: 'heal', x: h.x, y: h.y, v: Math.round(v) });
  }

  private healLowest(share: number): void {
    let low: Hero | null = null;
    for (const h of this.standing) if (!low || h.hp / h.max < low.hp / low.max) low = h;
    if (low) this.heal(low, share);
  }

  // ── the Din's frame ─────────────────────────────────────────────
  private dinFrame(d: Din, w: number): void {
    d.hit = Math.max(0, d.hit - w);
    d.act = Math.max(0, d.act - w);
    if (d.enter > 0) {
      d.enter -= w;
      if (d.enter <= 0) this.emit({ type: 'form', kind: d.kind, x: d.x, y: d.y, size: d.spec.size });
      return;
    }
    if (d.form > 0) {
      d.form = Math.max(0, d.form - w);
      return;
    }
    if (d.vx) {
      d.x += d.vx * w;
      d.vx *= Math.exp(-RULES.knockDrag * w);
      if (Math.abs(d.vx) < 0.05) d.vx = 0;
    }
    for (const k of ['stun', 'firm', 'tea', 'blind', 'weak', 'daze', 'taunt', 'copyHaste', 'copyUp'] as const) d[k] = Math.max(0, d[k] - w);
    if (d.stun <= 0) d.sleep = false;
    if (d.taunt <= 0) d.tauntBy = -1;
    if (d.mirrorMax > 0 && d.mirror <= 0 && d.spec.boss) {
      d.mirrorT -= w;
      if (d.mirrorT <= 0) d.mirror = Math.round(d.mirrorMax * RULES.mirrorRegrow);
    }
    if (d.kind === 'zgielk') d.phase = Math.min(2, Math.floor((1 - d.hp / d.max) * 3));
    if (this.atWell || d.doze) {
      // the Din draws back and dozes
      const back = RULES.fieldW - 1.6 + (d.id % 3) * 0.5;
      if (d.x < back) d.x = Math.min(back, d.x + 2.2 * w);
      return;
    }
    if (d.stun > 0 || d.tea > 0) return;
    // a wind-up under way: nothing else until it lands
    if (d.windT >= 0) {
      d.windT += w;
      if (d.windT >= d.windDur) this.landSpecial(d);
      return;
    }
    // bosses call their kind
    if (d.spec.summon && d.spec.summonEvery) {
      d.summonT -= w;
      if (d.summonT <= 0) {
        d.summonT = d.spec.summonEvery;
        const n = d.spec.summonN ?? 2;
        for (let i = 0; i < n; i++) this.spawn(d.spec.summon, d.max / d.spec.hp / 3.2, i * 0.35, { x: d.x + 0.8 + i * 0.5, y: this.rnd() });
        this.emit({ type: 'summon', kind: d.spec.summon, n, x: d.x, y: d.y });
      }
    }
    if (d.kind === 'leniwiec') {
      d.yawnT -= w;
      if (d.yawnT <= 0) {
        d.yawnT = RULES.yawnEvery;
        for (const h of this.standing) h.slow = RULES.yawnSec;
        this.emit({ type: 'yawn', x: d.x, y: d.y });
      }
    }
    const target = this.aimOf(d);
    if (!target) return;
    const dist = d.x - target.x;
    if (dist > d.range + 0.35) {
      this.walkDin(d, target, w);
      return;
    }
    // timed specials (Plotka, bosses) begin from a stand
    if (d.special && d.spec.every && d.kind !== 'gniewosz') {
      d.specT -= w;
      if (d.specT <= 0) {
        const sp = d.kind === 'zgielk' ? ZGIELK_PHASES[d.phase] : d.special;
        this.windUp(d, sp);
        return;
      }
    }
    d.atkT -= w * (d.copyHaste > 0 ? RULES.ult.songHaste : 1);
    if (d.atkT > 0) return;
    d.atkT = d.cd;
    d.act = 0.3;
    this.emit({ type: 'attack', hero: false, kind: d.kind, x: d.x, y: d.y, ranged: d.range > 2.5 });
    if (d.blind > 0) {
      this.emit({ type: 'miss', x: target.x, y: target.y });
      return;
    }
    const dmg = d.atk * (d.kind === 'gniewosz' ? 1 + RULES.swellAtk * d.swell : 1);
    if (d.range > 2.5) this.shoot(d.id, target.id, false, d.kind, d.x - 0.3, d.y, target.x, target.y, dmg, false);
    else this.hurtHero(target, dmg, d);
    if (d.kind === 'rozproszek' && !target.down && target.energy >= RULES.stealFrom && target.energy < RULES.energyMax) {
      target.energy = Math.max(0, target.energy - RULES.stealEnergy);
      this.emit({ type: 'steal', x: target.x, y: target.y, slot: target.slot });
    }
  }

  private walkDin(d: Din, target: Hero, w: number): void {
    let x = d.x - d.speed * w;
    // shadows queue behind the ones in front (fliers, rushers and the ranged pass)
    if (!d.spec.fly && d.spec.aim !== 'back' && d.range < 2.5) {
      for (const o of this.din) {
        if (o === d || o.enter > 0 || o.spec.fly || o.doze || o.x >= d.x || Math.abs(o.y - d.y) > 0.45) continue;
        const gap = (o.spec.size + d.spec.size) * 0.32;
        if (x < o.x + gap) x = Math.max(Math.min(d.x, o.x + gap), x);
      }
    }
    d.x = Math.max(target.x + d.range * 0.6, x);
  }

  private aimOf(d: Din): Hero | null {
    const all = this.standing;
    if (!all.length) return null;
    if (d.taunt > 0) {
      const t = all.find(h => h.id === d.tauntBy);
      if (t) return t;
    }
    if (d.spec.aim === 'back') return all.reduce((a, b) => (b.x < a.x ? b : a));
    if (d.spec.aim === 'energy') return all.reduce((a, b) => (b.energy > a.energy ? b : a));
    return all.reduce((a, b) => (b.x > a.x ? b : a));
  }

  private windUp(d: Din, sp: Special): void {
    if (d.windT >= 0) return;
    d.special = sp;
    d.windT = 0;
    d.windDur = d.kind === 'gniewosz' ? DIN.gniewosz.wind ?? 1.8 : d.spec.wind ?? 2;
    this.emit({ type: 'wind', kind: d.kind, special: sp, x: d.x, y: d.y, boss: !!d.spec.boss });
  }

  /** Break a wind-up (a stun, sleep, tea or the stroke): the shadow is dazed and takes more. */
  private interrupt(d: Din): boolean {
    if (d.windT < 0) return false;
    d.windT = -1;
    d.daze = RULES.dazeSec;
    d.specT = d.spec.every ?? 6;
    if (d.kind === 'gniewosz') d.swell = 0;
    this.emit({ type: 'interrupt', kind: d.kind, x: d.x, y: d.y, boss: !!d.spec.boss });
    return true;
  }

  private landSpecial(d: Din): void {
    const sp = d.special ?? 'shout';
    d.windT = -1;
    d.specT = d.spec.every ?? 7;
    d.act = 0.5;
    this.emit({ type: 'special', kind: d.kind, special: sp, x: d.x, y: d.y });
    const all = this.standing;
    const front = [...all].sort((a, b) => b.x - a.x);
    switch (sp) {
      case 'outburst':
        // Gniewosz bursts: everyone near the front, then he calms down
        for (const h of all) if (d.x - h.x < 3.2) this.hurtHero(h, d.atk * RULES.specialHit.outburst, d);
        for (const h of all) if (d.x - h.x < 3.2) h.vx = -RULES.knock * 0.6;
        d.swell = 0;
        break;
      case 'whisper': {
        const h = all.reduce<Hero | null>((a, b) => (!a || b.energy > a.energy ? b : a), null);
        if (h) {
          h.silence = RULES.hushSec;
          this.emit({ type: 'whisper', slot: h.slot, x: h.x, y: h.y });
        }
        break;
      }
      case 'shout':
        for (const h of all) { this.hurtHero(h, d.atk * RULES.specialHit.shout, d); h.vx = -RULES.knock * 0.8; }
        break;
      case 'roll':
        for (const h of all) this.hurtHero(h, d.atk * RULES.specialHit.roll, d);
        break;
      case 'hubbub':
        for (const h of all) { this.hurtHero(h, d.atk * RULES.specialHit.hubbub, d); h.silence = Math.max(h.silence, 2.5); }
        break;
      case 'honk':
        for (const h of front.slice(0, 2)) { this.hurtHero(h, d.atk * RULES.specialHit.honk, d); h.vx = -RULES.knock; }
        if (front[0] && !front[0].down) front[0].stun = 2;
        break;
      case 'lookAtMe': {
        const h = all.reduce<Hero | null>((a, b) => (!a || b.atk > a.atk ? b : a), null);
        if (h) { h.stun = 3; this.hurtHero(h, d.atk * RULES.specialHit.lookAtMe, d); }
        break;
      }
    }
  }

  // ── ultimates ───────────────────────────────────────────────────
  /** Fire a hero's ultimate (a tap, the semi-auto): false when it is not ready. */
  fire(h: Hero, auto = false): boolean {
    if (!this.ready(h) || this.atWell) return false;
    h.energy = 0;
    h.readyT = 0;
    h.cast = 0.55;
    // the cast's freeze: a full beat for a tap, a small hitch for the semi-auto
    this.stop = Math.max(this.stop, auto ? RULES.castStopAuto : RULES.castStop);
    this.effect(h, false);
    this.emit({ type: 'ult', slot: h.slot, kind: h.kind, x: h.x, y: h.y, auto, chord: false });
    if (HEROES[h.kind].family === 'serce' && this.mods.heartEnergy > 0) for (const o of this.standing) if (o !== h) this.gain(o, this.mods.heartEnergy, true);
    return true;
  }

  /** Harmony: everyone standing (and the fallen, lifted) fires at once; a wave of quiet over the whole street. */
  chord(): number {
    if (this.atWell) return 0;
    this.stop = Math.max(this.stop, RULES.harmonyStop);
    for (const h of this.heroes) {
      if (h.down) {
        h.down = false;
        h.hp = Math.max(1, Math.round(h.max * RULES.harmonyLift));
        h.x = Math.max(h.x, h.home - 1);
        this.emit({ type: 'revive', slot: h.slot, x: h.x, y: h.y });
      }
    }
    const all = this.standing;
    for (const h of all) {
      h.cast = 0.9;
      this.effect(h, true);
      this.emit({ type: 'ult', slot: h.slot, kind: h.kind, x: h.x, y: h.y, auto: false, chord: true });
    }
    const mean = all.reduce((s, h) => s + h.atk, 0) / Math.max(1, all.length);
    for (const d of [...this.din]) if (d.enter <= 0) this.hurtDin(d, mean * RULES.harmonyHit * (1 + this.mods.dmg), null, { pierce: true });
    this.emit({ type: 'chord', n: all.length });
    return all.length;
  }

  /** What an ultimate does, by hero. */
  private effect(h: Hero, chord: boolean): void {
    const U = RULES.ult;
    const dmgK = this.dmgK(h);
    const live = this.din.filter(d => d.enter <= 0);
    switch (h.kind) {
      case 'cierpliwosc':
        h.wall = U.wallSec;
        h.wallStore = 0;
        for (const d of live) { d.taunt = U.wallSec; d.tauntBy = h.id; }
        break;
      case 'wiernosc': {
        const fallen = this.heroes.filter(o => o.down).sort((a, b) => b.fellAt - a.fellAt)[0];
        if (fallen) {
          fallen.down = false;
          fallen.hp = Math.round(fallen.max * U.reviveHp);
          fallen.x = Math.max(fallen.x, fallen.home - 1);
          this.emit({ type: 'revive', slot: fallen.slot, x: fallen.x, y: fallen.y });
        } else {
          const low = this.standing.filter(o => o !== h).sort((a, b) => a.hp / a.max - b.hp / b.max)[0] ?? h;
          low.shield += low.max * U.guardShield;
          if (low !== h) { h.guardOf = low.id; h.guardT = U.guardSec; }
        }
        const t = this.frontDin();
        if (t) this.hurtDin(t, h.atk * U.guardHit * dmgK, h);
        break;
      }
      case 'opanowanie': {
        const t = this.winding[0] ?? this.boss ?? live.reduce<Din | null>((a, b) => (!a || b.hp > a.hp ? b : a), null);
        if (!t) break;
        h.dash = 0.45;
        h.dashTo = t.x - 0.6;
        const wound = t.windT >= 0;
        this.interrupt(t);
        if (t.mirror > 0) {
          t.mirror = 0;
          t.mirrorT = RULES.mirrorBack;
          this.emit({ type: 'mirrorBreak', x: t.x, y: t.y });
        }
        this.hurtDin(t, h.atk * U.strokeHit * (wound ? U.strokeWind : 1) * dmgK, h, { pierce: true, crit: true });
        break;
      }
      case 'milosc':
        this.bond = Math.max(this.bond, U.bondSec);
        for (const o of this.standing) {
          o.dmgUp = Math.max(o.dmgUp, U.bondSec);
          this.heal(o, U.bondHeal);
        }
        this.envy('up', U.bondSec);
        break;
      case 'uprzejmosc': {
        const n = h.rank >= RULES.skill.blueRank ? U.teaNBlue : U.teaN;
        const order = [...live].sort((a, b) => (b.windT >= 0 ? 1 : 0) - (a.windT >= 0 ? 1 : 0) || (b.spec.boss ? 1 : 0) - (a.spec.boss ? 1 : 0) || b.atk - a.atk);
        for (const d of order.slice(0, n)) {
          this.interrupt(d);
          d.tea = U.teaSec;
          d.swell = 0;
          d.atkT = Math.max(d.atkT, 0.6);
        }
        break;
      }
      case 'radosc':
        for (const o of this.standing) {
          if (o !== h) this.gain(o, U.songEnergy, true);
          o.haste = Math.max(o.haste, U.songSec);
          o.slow = 0;
        }
        this.envy('haste', U.songSec);
        break;
      case 'dobroc':
        for (const d of live) this.hurtDin(d, h.atk * U.beamHit * dmgK, h, { pierce: true });
        break;
      case 'lagodnosc':
        for (const d of live) {
          this.interrupt(d);
          d.stun = Math.max(d.stun, U.sleepSec);
          d.sleep = true;
          d.firm = U.sleepFirm;
        }
        break;
      case 'pokoj':
        for (const o of this.standing) {
          this.heal(o, U.stillHeal);
          o.silence = 0;
          o.slow = 0;
          if (o.stun > 0 && !chord) o.stun = 0;
        }
        for (const d of this.din) { d.copyHaste = 0; d.copyUp = 0; }
        break;
    }
  }

  /** Zazdrośniki copy a buff they see (within reach of the five). */
  private envy(kind: 'up' | 'haste', sec: number): void {
    const near = this.din.filter(d => d.kind === 'zazdrosnik' && d.enter <= 0 && !d.doze && this.standing.some(h => d.x - h.x < RULES.copyReach));
    for (const z of near) {
      for (const d of this.din) {
        if (d.enter > 0 || Math.abs(d.x - z.x) > 2.5) continue;
        if (kind === 'up') d.copyUp = Math.max(d.copyUp, sec); else d.copyHaste = Math.max(d.copyHaste, sec);
      }
      this.emit({ type: 'copy', x: z.x, y: z.y });
    }
  }

  private wallAnswer(h: Hero): void {
    h.wall = 0;
    const dmg = RULES.ult.wallBack * h.wallStore + RULES.ult.wallHit * h.atk * this.dmgK(h);
    h.wallStore = 0;
    for (const d of this.din) if (d.tauntBy === h.id) { d.taunt = 0; d.tauntBy = -1; }
    const near = this.din.filter(d => d.enter <= 0 && d.x - h.x < 4.5);
    for (const d of near) {
      this.hurtDin(d, dmg, h, { pierce: false });
      if (this.din.includes(d)) d.vx = RULES.knock * 0.7;
    }
    this.emit({ type: 'wallAnswer', x: h.x, y: h.y, dmg: Math.round(dmg) });
  }

  /** Blue skills (from the blue rank), on their own timers. */
  private blue(h: Hero): void {
    this.gain(h, RULES.perAttack);
    switch (h.kind) {
      case 'cierpliwosc': this.heal(h, 0.1); break;
      case 'wiernosc': {
        const t = this.frontDin();
        if (t) t.blind = 2;
        break;
      }
      case 'opanowanie': h.parry = true; break;
      case 'milosc': {
        const low = this.standing.sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
        if (low) low.shield += low.max * 0.12;
        break;
      }
      case 'uprzejmosc': this.healLowest(0.08); break;
      case 'radosc': for (const o of this.standing) o.slow = 0; break;
      case 'dobroc': {
        const live = this.alive.filter(d => !d.doze);
        for (let i = 0; i < 3 && live.length; i++) {
          const d = live[Math.floor(this.rnd() * live.length)];
          this.shoot(h.id, d.id, true, h.kind, h.x + 0.3, h.y, d.x, d.y, h.atk * this.dmgK(h), false);
        }
        break;
      }
      case 'lagodnosc': {
        const g = this.din.filter(d => d.kind === 'gniewosz').sort((a, b) => b.swell - a.swell)[0];
        if (g) g.swell = Math.max(0, g.swell - 2);
        break;
      }
      case 'pokoj': this.healLowest(0.12); break;
    }
  }

  /**
   * The semi-auto: a ready ultimate goes by itself after its role's wait — healers once somebody is
   * low (or a while later), control once a shadow winds up (or a while later), the rest at once after
   * the wait.  Nothing goes while the street is empty, except a healer or a guardian for the fallen.
   * Returns the hero it fired (one per frame at most).
   */
  autoFire(): Hero | null {
    if (this.atWell) return null;
    const anyLive = this.din.some(d => d.enter <= 0 && !d.doze);
    for (const h of this.readyHeroes) {
      const wait = RULES.autoWait[h.spec.role] ?? 3;
      let go = h.readyT >= wait;
      if (h.spec.role === 'healer') go = (h.readyT >= 1 && this.standing.some(o => o.hp < o.max * RULES.healerAt)) || h.readyT >= wait;
      if (h.spec.role === 'control') go = (h.readyT >= 0.6 && this.winding.length > 0) || h.readyT >= wait;
      if (h.kind === 'wiernosc') go = (h.readyT >= 1 && this.heroes.some(o => o.down)) || h.readyT >= wait;
      const useful = anyLive || ((h.spec.role === 'healer' || h.kind === 'wiernosc') && this.heroes.some(o => o.down || o.hp < o.max * RULES.healerAt));
      if (go && useful && this.fire(h, true)) return h;
    }
    return null;
  }

  /** A new wave: Faithfulness may intercept again. */
  newWave(): void {
    for (const h of this.heroes) h.intercept = true;
  }

  /** The Din tires: a wave fought too long fades a little every second (never a wall). */
  tire(w: number): void {
    for (const d of [...this.din]) {
      if (d.enter > 0 || d.doze) continue;
      d.hp -= d.max * RULES.tireRate * w;
      if (d.hp <= 0) this.hushDin(d, null);
    }
  }

  /** Has a kind of shadow come into the street yet (for first-time explanations)? */
  meetAll(seen: (k: DinKind) => boolean): void {
    for (const d of this.din) if (d.enter <= 0 && d.x < RULES.fieldW - 0.5 && !seen(d.kind)) this.emit({ type: 'meet', kind: d.kind });
  }

  isBossKind(k: DinKind): k is BossKind { return isBoss(k); }
}
