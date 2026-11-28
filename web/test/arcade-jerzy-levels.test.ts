/**
 * Jerzy i smok's difficulty levels (kit/difficulty.ts, DESIGN §29): Na start · Zwykły · Zaawansowany · Hardcore on the
 * game's own knobs (rules.ts LEVELS).  REGULAR is the game as it was (arcade-jerzy.test.ts runs on it unchanged); the
 * blocks and the band's aura never change with the level; every level scores in a 40 s test; the order is measured
 * with the session bots of arcade-jerzy.test.ts (copied below: the knight's falls in 5-minute sessions at the same
 * focus) and with a knight who stands still; Hardcore is hard but a focused player still drives dragons off; records
 * per level, one map across them; the lobby's card opens with the row.
 */
import { describe, expect, it } from 'vitest';
import { DRAGONS, type ItemId } from '../src/arcade/jerzy/content';
import { CATALOGS, t } from '../src/arcade/jerzy/i18n';
import {
  bestFor, bestOf, bestRunAt, dragonHp, freshProgress, hpOf, keepRun, lenKey, migrate, woundKey, type JerzyProgress,
} from '../src/arcade/jerzy/meta';
import { LEVELS, RULES } from '../src/arcade/jerzy/rules';
import { JerzySim, type Card, type Creature } from '../src/arcade/jerzy/sim';
import { DIFFICULTIES, type Difficulty } from '../src/arcade/kit/difficulty';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mulberry32 } from '../src/core/random';

const DAY = '2026-11-28';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };
const SEEN = ['move', 'scales', 'choose', 'aura', 'quench', 'sword', 'rest', 'boss', 'evolve', 'chest', 'reroll', 'pal', 'treasure', 'duet', 'fatal', 'ring'];
const LENGTHS = [40, 180, 300, 600, 900, 1200, 1800, 2700, 3600];
const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

function makeSim(o: { difficulty?: Difficulty; planned?: number; seed?: number; progress?: Partial<JerzyProgress>; tuning?: FocusTuning; eeg?: boolean } = {}): JerzySim {
  const sim = new JerzySim({
    progress: migrate({ ...freshProgress(), ...o.progress, difficulty: o.difficulty ?? 'regular' }), rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}
const later = (o: Parameters<typeof makeSim>[0] = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...SEEN], ...o.progress } });
type Inner = { director: () => void; spawn: (k: string, a: number, elite?: boolean, ringK?: number) => Creature; hurt: (v: number, x: number, y: number) => void };
const inner = (sim: JerzySim) => sim as unknown as Inner;

// ── the session bots of arcade-jerzy.test.ts ────────────────────────
type Skill = 'sharp' | 'casual';
/** what a casual bot has decided not to see (telegraphs it misses), per sim */
const missed = new WeakMap<JerzySim, Set<number>>();

function botStep(sim: JerzySim, skill: Skill = 'sharp', rnd: () => number = Math.random): void {
  const k = sim.knight, b = sim.boss;
  const casual = skill === 'casual';
  let miss = missed.get(sim);
  if (!miss) missed.set(sim, (miss = new Set()));
  if (sim.story || sim.tally) { sim.tap(); return; }
  if (sim.choice) {
    if (sim.choice.t < 0.3) return;
    const rank = (c: Card): number => {
      if (c.kind === 'evo') return 100;
      if (c.kind === 'treasure') return 60;
      const taste: Partial<Record<ItemId, number>> = { kusza: 30, kopia: 28, wiadra: 26, mlot: 25, miecz: 24, sokol: 20, rog: 18, kon: 17, kolce: 15, sztandar: 22, rekawice: 21, pierscien: 16, kolczan: 16, plaszcz: 14, tarcza: 14, zbroja: 12, buty: 10, sakwa: 9 };
      if (c.kind === 'pal') return 19;
      return (c.id ? taste[c.id] ?? 5 : 3) + (c.kind === 'up' ? 4 : 0);
    };
    const cards = sim.choice.cards;
    let best = 0;
    cards.forEach((c, i) => { if (rank(c) > rank(cards[best])) best = i; });
    sim.pick(best);
    return;
  }
  if (sim.swordReady) sim.tap();
  // candidate steps: stay, or 0.9 u in one of 12 directions; each scored
  let bx = 0, by = 0, bestScore = -Infinity;
  const aura = sim.auraR, smart = sim.p.flaws.includes(b.spec.kind) || sim.session > 2;
  for (let i = -1; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, d = i < 0 ? 0 : 0.9;
    const x = k.x + Math.cos(a) * d, y = k.y + Math.sin(a) * d;
    let s = 0;
    for (const c of sim.brood) {
      const dd = Math.hypot(c.x - x, c.y - y);
      if (dd < 2.6) s -= ((c.elite ? 2.5 : 1) * (casual ? 0.45 : 1)) / Math.max(0.25, dd * dd);
    }
    for (const z of sim.zones) {
      // a casual player misses about a third of the red shapes
      if (casual && !miss.has(z.id) && !miss.has(-z.id)) miss.add(rnd() < 0.35 ? z.id : -z.id);
      if (casual && miss.has(z.id)) continue;
      let inside = false;
      if (z.kind === 'circle') inside = Math.hypot(x - z.x, y - z.y) < z.w + 0.5;
      else if (z.kind === 'lane') inside = sim.inLane(z, x, y);
      else if (z.kind === 'cone') {
        const dd = Math.hypot(x - z.x, y - z.y), da = Math.abs(((Math.atan2(y - z.y, x - z.x) - z.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        inside = dd < z.len + 0.4 && da < z.w + 0.25;
        // the Green Dragon's breath with a big shield: stand in it (his steam flaw)
        if (inside && smart && b.spec.flaw === 'steam' && aura >= sim.auraMark) inside = false;
      } else if (z.kind === 'ring') {
        const dd = Math.hypot(x - z.x, y - z.y), gapA = Math.abs(((Math.atan2(y - z.y, x - z.x) - (z.gap ?? 0) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        inside = gapA > (z.gapW ?? 0) / 2 && dd < (z.r ?? 4) + 0.5;
        if (smart && aura >= sim.auraMark) inside = false;
      }
      if (inside) s -= 40;
    }
    if (sim.bossPresent) {
      const dd = Math.hypot(b.x - x, b.y - y);
      if (b.state === 'flaw') s -= Math.abs(dd - 1.9) * 3;
      else s -= Math.max(0, 3 - dd) * 4;
      if (b.hot > 0 && smart) s -= dd * 2;
    }
    // scales: gather them when it is safe (but leave them by the Golden Dragon once his flaw is known)
    let sc = 0;
    for (const p of sim.scales) {
      const dd = Math.hypot(p.x - x, p.y - y);
      if (dd > 5) continue;
      if (smart && b.spec.flaw === 'greed' && sim.bossPresent && Math.hypot(p.x - b.x, p.y - b.y) < RULES.greedNear) continue;
      sc += p.v / (1 + dd);
    }
    s += sc * (casual ? 0.7 : 0.4);
    // a little pull back to the knight's middle ground, not to wander off forever
    s -= Math.hypot(x, y) * 0.01;
    if (s > bestScore) { bestScore = s; bx = x - k.x; by = y - k.y; }
  }
  const l = Math.hypot(bx, by);
  sim.steer(l > 1e-6 ? bx / l : 0, l > 1e-6 ? by / l : 0);
}

type Profile = 'none' | 'weak' | 'avg' | 'good';
/** The band's frame for a profile: the level while asked to focus, the calm while asked to rest (with slow wobble). */
function profileFrame(sim: JerzySim, prof: Profile, t: number, held: { h: number }): FocusFrame {
  if (prof === 'none') return NONE;
  const base = prof === 'weak' ? 0.42 : prof === 'avg' ? 0.6 : 0.82;
  const wobble = 0.18 * Math.sin(t * 0.45) + 0.08 * Math.sin(t * 1.7);
  const push = sim.block?.kind === 'push' && sim.phase === 'play';
  const level = push ? Math.max(0, Math.min(1, base + wobble)) : 0.25 + 0.1 * Math.sin(t * 0.3);
  const focused = level >= 0.5;
  held.h = focused ? held.h + 1 / 30 : 0;
  const calm = !push ? Math.max(0, Math.min(1, base + 0.1 * Math.sin(t * 0.5))) : 0.1;
  return { reliable: true, activity: level * 8 - 2, threshold: 2, level, focused, hold: held.h, calm };
}

/**
 * One session played by a bot on a returning player's save at a level: the knight's falls and the runs lost, the share
 * of his hearts lost per minute of play (the world held — a card, a tally, the knight down — does not count), the
 * dragon driven off.
 */
function session(level: Difficulty, prof: Profile, skill: Skill, seed: number, planned = 300) {
  const p = migrate({ ...freshProgress(), sessions: 5, pushes: 1, seen: [...SEEN], difficulty: level });
  const sim = new JerzySim({ progress: p, rng: mulberry32(seed * 1000), day: DAY, daySeed: 1, plannedSec: planned, eeg: false, tuning: TUNING });
  sim.start();
  const held = { h: 0 }, rnd = mulberry32(seed * 77);
  let decide = 0, falls = 0, share = 0, play = 0, prev = sim.knight.hearts;
  const step = 1 / 30;
  for (let tt = 0; tt < planned + 6 && !sim.canStop(); tt += step) {
    const live = !sim.frozen && sim.knight.down <= 0 && sim.phase === 'play';
    sim.update(step, profileFrame(sim, prof, tt, held), tt);
    for (const e of sim.take()) if (e.type === 'down') falls++;
    const h = sim.knight.hearts;
    if (live) {
      play += step;
      if (h < prev) share += (prev - h) / sim.knight.max;
    }
    prev = h;
    if ((decide += step) >= (skill === 'casual' ? 0.3 : 0.1)) { decide = 0; botStep(sim, skill, rnd); }
  }
  sim.finish();
  sim.result();
  return { falls, runs: sim.runs + 1, lost: sim.runs, perMin: share / (play / 60), driven: sim.drivenNow.length, score: sim.score };
}

/** A knight who stands still without the band (the weapons strike by themselves, the first card is taken by itself): seconds to his first fall. */
function standStill(level: Difficulty, seed: number): number {
  const sim = later({ difficulty: level, seed, planned: 600 });
  for (let t = 0; t < 600; t += 1 / 30) {
    sim.update(1 / 30, NONE, t);
    if (sim.story) sim.tap();
    if (sim.take().some(e => e.type === 'down')) return t;
  }
  return 600;
}

describe('Jerzy — the four levels on its knobs', () => {
  it('REGULAR is neutral: the game as it was', () => {
    expect(LEVELS.regular).toEqual({ brood: 1, dragon: 1, hurt: 1, count: 1, speed: 1, hearts: 0, revive: 0, rerolls: 0, drops: 1, reward: 1 });
    for (const d of DRAGONS) for (const tier of [0, 1, 3, 6]) expect(dragonHp(d, tier)).toBe(hpOf(d, tier));
  });

  it('grows harder level by level: a stronger, quicker, thicker brood, a bigger dragon, fewer hearts and helps, more for the treasury', () => {
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      const a = LEVELS[DIFFICULTIES[i - 1]], b = LEVELS[DIFFICULTIES[i]];
      for (const k of ['brood', 'dragon', 'hurt', 'count', 'speed', 'reward'] as const) expect(b[k], k).toBeGreaterThan(a[k]);
      for (const k of ['hearts', 'drops'] as const) expect(b[k], k).toBeLessThan(a[k]);
      for (const k of ['revive', 'rerolls'] as const) expect(b[k], k).toBeLessThanOrEqual(a[k]);
    }
  });

  it('puts them into the session: hearts, Linda\'s apples, the reshuffles, the dragon\'s scales, the brood\'s hp and the warnings', () => {
    const want = { start: [7, 2, 2], regular: [5, 1, 1], advanced: [4, 1, 1], hardcore: [3, 0, 0] } as const;
    const reg = later();
    const regC = inner(reg).spawn('piskle', 0);
    for (const d of DIFFICULTIES) {
      const sim = later({ difficulty: d });
      expect([sim.knight.max, sim.run.apples, sim.run.rerolls], d).toEqual([...want[d]]);
      expect(sim.boss.all).toBe(dragonHp(DRAGONS[0], 0, d));
      expect(sim.boss.all).toBe(Math.round(hpOf(DRAGONS[0], 0) * LEVELS[d].dragon));
      const c = inner(sim).spawn('piskle', 0);
      expect(c.max / regC.max).toBeCloseTo(LEVELS[d].brood, 1);
      // a blow takes hearts × the level's hurt
      sim.knight.safe = 0;
      const h0 = sim.knight.hearts;
      inner(sim).hurt(1, 0, 0);
      expect(h0 - sim.knight.hearts).toBeCloseTo(LEVELS[d].hurt, 9);
    }
    // the forge's and the armoury's extra hearts and apples come on top; never under two hearts
    const vet = later({ difficulty: 'hardcore', progress: { forge: { serce: 1 }, armour: ['kosz', 'helm'] } });
    expect(vet.knight.max).toBe(5);
    expect(vet.run.apples).toBe(0);
  });
});

describe('Jerzy — the training is the same at every level', () => {
  it('plans the same blocks at every level, 40 s to 60 min', () => {
    for (const planned of LENGTHS) {
      for (const first of [true, false]) {
        const progress = first ? {} : { sessions: 4 };
        const reg = makeSim({ planned, progress }).plan;
        for (const d of DIFFICULTIES) expect(makeSim({ planned, progress, difficulty: d }).plan, `${d} ${planned}`).toEqual(reg);
      }
    }
  });

  it('the aura follows the band the same way at every level', () => {
    const run = (d: Difficulty) => {
      const sim = later({ difficulty: d });
      inner(sim).director = () => {};
      sim.brood.length = 0;
      const out: number[] = [];
      for (let t = 0; t < 70; t += STEP) {
        const push = sim.block.kind === 'push';
        sim.update(STEP, frame({ level: push ? 0.2 + 0.7 * Math.abs(Math.sin(t / 3)) : 0.3, focused: push && t % 6 > 2, calm: push ? 0.1 : 0.8 }), t);
        sim.take();
        sim.brood.length = 0;
        if (sim.choice) sim.pick(0);
        out.push(Math.round(sim.auraR * 1e9));
      }
      return out;
    };
    const reg = run('regular');
    for (const d of DIFFICULTIES) expect(run(d), d).toEqual(reg);
  });
});

describe('Jerzy — every level scores in a 40 s test', () => {
  /** The smoke test's input (arcade-jerzy.test.ts): a click at the centre every 0.65 s, Space every 2 s, the simulator's focus. */
  function smoke(d: Difficulty, progress: Partial<JerzyProgress>, seed: number, eeg: boolean): number {
    const sim = makeSim({ difficulty: d, progress, planned: 40, seed, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, space = 0;
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      sim.update(STEP, f, t);
      if ((tap += STEP) >= 0.65) {
        tap -= 0.65;
        sim.steer(0, 0);
        sim.tap(1);
      }
      if ((space += STEP) >= 2) {
        space -= 2;
        sim.key(' ', true);
        sim.key(' ', false);
      }
      sim.take();
    }
    return sim.result().score;
  }

  it('gathers scales by 22 s at every level, on either band, first session or later', () => {
    for (const d of DIFFICULTIES) {
      for (const eeg of [false, true]) {
        for (let seed = 1; seed <= 4; seed++) {
          expect(smoke(d, {}, seed, eeg), `${d}, eeg ${eeg}, seed ${seed}`).toBeGreaterThan(3);
          expect(smoke(d, { sessions: 6, seen: [...SEEN] }, seed, eeg), `${d} later, seed ${seed}`).toBeGreaterThan(3);
        }
      }
    }
  });
});

describe('Jerzy — the order, measured at the same focus', () => {
  it('a knight who stands still without the band falls soonest at Hardcore, latest at Na start', () => {
    const at = DIFFICULTIES.map(d => [1, 2, 3].map(seed => standStill(d, seed)).reduce((s, x) => s + x, 0) / 3);
    for (let i = 1; i < at.length; i++) expect(at[i], DIFFICULTIES[i]).toBeLessThan(at[i - 1]);
  });

  it('5-minute sessions played by the bots: more runs lost level by level (an average, a sharp and a band-less player together), and an average player loses more of his hearts a minute', () => {
    const rows = DIFFICULTIES.map(d => {
      let lost = 0, avg = 0, banded = 0, bare = 0;
      for (const [prof, skill] of [['avg', 'casual'], ['good', 'sharp'], ['none', 'casual']] as [Profile, Skill][]) {
        for (const seed of [1, 2]) {
          const r = session(d, prof, skill, seed);
          lost += r.lost;
          if (prof === 'none') bare += r.lost;
          else banded += r.lost;
          if (prof === 'avg') avg += r.perMin / 2;
        }
      }
      return { lost, avg, banded, bare };
    });
    const say = rows.map(r => `${r.lost} runs (${r.banded} with the band), ${r.avg.toFixed(2)}/min`).join(' · ');
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].lost, `${DIFFICULTIES[i]}: ${say}`).toBeGreaterThan(rows[i - 1].lost);
      expect(rows[i].avg, `${DIFFICULTIES[i]}: ${say}`).toBeGreaterThan(rows[i - 1].avg);
    }
    // Na start: with the band nobody's run is lost in these five minutes; without it, one at the most (Zwykły loses
    // 2–4 in every band-less session).  Not "none even without the band": these sessions are chaotic, and V8's
    // Math.sin, cos, exp, atan2, pow and tan differ in the last bit between x64 (CI) and arm64, so the band-less knight
    // of seed 2, who falls once on arm64, falls three times on x64 and loses a run (24 seeds: 0 lost on arm64, 1 on x64).
    expect(rows[0].banded, say).toBe(0);
    expect(rows[0].bare, say).toBeLessThanOrEqual(1);
  }, 300_000);
});

describe('Jerzy — Hardcore is hard but fair', () => {
  it('a focused, sharp player still drives the first dragon off in 5 minutes; one without the band does not, and falls again and again', () => {
    const sharp = [1, 2, 3].map(seed => session('hardcore', 'good', 'sharp', seed));
    expect(sharp.filter(r => r.driven > 0).length).toBeGreaterThanOrEqual(1);
    const none = [1, 2].map(seed => session('hardcore', 'none', 'casual', seed));
    for (const r of none) {
      expect(r.driven).toBe(0);
      expect(r.runs).toBeGreaterThan(4);
    }
  }, 300_000);
});

describe('Jerzy — records per level, one map', () => {
  it('an old save plays REGULAR; an odd level is read as REGULAR; the level survives migration', () => {
    expect(freshProgress().difficulty).toBe('regular');
    const old = { ...freshProgress() } as Partial<JerzyProgress>;
    delete old.difficulty;
    delete old.runs2;
    const m = migrate(old as JerzyProgress);
    expect(m.difficulty).toBe('regular');
    expect(m.runs2).toEqual({});
    expect(migrate({ ...freshProgress(), difficulty: 'nightmare' } as unknown as JerzyProgress).difficulty).toBe('regular');
    expect(migrate({ ...freshProgress(), difficulty: 'advanced' }).difficulty).toBe('advanced');
    // a v1 save and a v2 save come to REGULAR
    expect(migrate({ v: 1, sessions: 3, best: { 300: 20 } } as unknown as JerzyProgress).difficulty).toBe('regular');
    expect(migrate({ ver: 2, dragon: 1, damage: 10, sessions: 2 } as unknown as JerzyProgress).difficulty).toBe('regular');
  });

  it('keeps the records and the best run per level (REGULAR the old fields) and names a level past REGULAR in the summary', () => {
    const p = migrate({ ...freshProgress(), sessions: 4, seen: [...SEEN], best: { 40: 9 }, lastLen: 40, bestRun: 50, bestTime: 90 });
    p.difficulty = 'hardcore';
    const sim = new JerzySim({ progress: p, rng: mulberry32(3), day: DAY, daySeed: 1, plannedSec: 40, eeg: false, tuning: TUNING });
    sim.start();
    for (let t = 0; t < 46; t += STEP) {
      sim.update(STEP, frame({ level: 0.7, focused: true }), t);
      sim.take();
      if (sim.choice) sim.pick(0);
    }
    const r = sim.result();
    expect(sim.score).toBeGreaterThan(0);
    expect(p.best['40']).toBe(9);
    expect(p.best[lenKey(40, 'hardcore')]).toBe(sim.score);
    expect(p.bestRun).toBe(50);
    expect(p.bestTime).toBe(90);
    expect(bestRunAt(p, 'hardcore')).toBe(sim.run.scales);
    expect(r.stats[0]).toEqual([t('stat.difficulty'), 'Hardcore']);
    expect(bestFor({ ...p, difficulty: 'regular' }, 40)).toBe(9);
    expect(bestOf({ ...p, difficulty: 'start' })).toBeNull();
    // REGULAR's summary has no such line, and its best run is the old field
    const reg = later({ planned: 40 });
    expect(reg.result().stats.some(([k]) => k === t('stat.difficulty'))).toBe(false);
    keepRun(p, 'regular', 70, 100);
    expect([p.bestRun, p.bestTime, bestRunAt(p, 'regular')]).toEqual([70, 100, 70]);
  });

  it('one map: the roads cleared and the wounds carry across the levels (an easier level\'s dragon is never more than wounded)', () => {
    const p = migrate({ ...freshProgress(), sessions: 4, seen: [...SEEN], wounds: { [woundKey(0, 0)]: Math.round(hpOf(DRAGONS[0], 0) * 0.9) } });
    for (const d of DIFFICULTIES) {
      p.difficulty = d;
      const sim = new JerzySim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 300, eeg: false, tuning: TUNING });
      expect(sim.boss.land).toBe(0);
      expect(sim.boss.damage).toBeLessThan(sim.boss.all);
      expect(sim.boss.damage).toBe(Math.min(Math.round(hpOf(DRAGONS[0], 0) * 0.9), sim.boss.all - 1));
    }
  });
});

describe('Jerzy — the lobby', () => {
  it('opens the card with the difficulty row; a choice saves and shows that level\'s records', async () => {
    const mod = (await import('../src/arcade/jerzy/index')).default;
    const p = migrate({ ...freshProgress(), sessions: 2, best: { 300: 300, '300@start': 77 }, lastLen: 300, bestRun: 120, runs2: { 'run@start': 66 } });
    let saved = 0;
    const el = mod.progressPanel(p, () => { saved++; });
    const row = el.firstElementChild as HTMLElement;
    expect(row.classList.contains('difficulty')).toBe(true);
    const chips = [...row.querySelectorAll<HTMLButtonElement>('[data-difficulty]')];
    expect(chips.map(c => c.dataset.difficulty)).toEqual([...DIFFICULTIES]);
    expect(row.textContent).toContain(t('level.regular'));
    expect(el.querySelector('.arcade-stats')!.textContent).toContain('300');
    chips[0].click();
    expect(p.difficulty).toBe('start');
    expect(saved).toBe(1);
    expect(el.firstElementChild).toBe(row);
    expect(row.textContent).toContain(t('level.start'));
    const stats = el.querySelector('.arcade-stats')!.textContent!;
    expect(stats).toContain('77');
    expect(stats).toContain('66');
    expect(mod.best(p)).toBe(77);
  });

  it('says what each level means here, in four languages, with the table\'s numbers', () => {
    for (const cat of Object.values(CATALOGS)) {
      for (const d of DIFFICULTIES) expect(String(cat[`level.${d}` as keyof typeof cat]).length, d).toBeGreaterThan(20);
      expect(String(cat['stat.difficulty']).length).toBeGreaterThan(3);
    }
    expect([LEVELS.start.brood, LEVELS.start.dragon, LEVELS.advanced.brood, LEVELS.advanced.dragon, LEVELS.hardcore.brood, LEVELS.hardcore.dragon]).toEqual([0.6, 0.7, 1.3, 1.25, 1.6, 1.5]);
    expect([RULES.hearts + LEVELS.start.hearts, RULES.hearts + LEVELS.advanced.hearts, RULES.hearts + LEVELS.hardcore.hearts]).toEqual([7, 4, 3]);
    expect(t('level.start')).toContain('40%');
    expect(t('level.hardcore')).toContain('60%');
  });
});
