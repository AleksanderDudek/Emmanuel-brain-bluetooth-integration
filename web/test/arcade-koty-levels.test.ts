/**
 * Kocia straż's difficulty levels (kit/difficulty.ts, DESIGN §29): Na start · Zwykły · Zaawansowany · Hardcore on the
 * game's own knobs (rules.ts LEVELS).  REGULAR is the game as it was (arcade-koty.test.ts runs on it unchanged); the
 * blocks, the squad's alertness and the Great Hunt never change with the level; every level scores in a 40 s test;
 * the order is measured with three 10-minute sessions in a row played the way the pace test plays (the helping paw
 * every 2 s) at the same focus; Hardcore is hard but a focused watch still chases chiefs off; records per level, one
 * watch across them; the lobby's card opens with the row.
 */
import { describe, expect, it } from 'vitest';
import { CATALOGS, t } from '../src/arcade/koty/i18n';
import { bestFor, bestOf, freshProgress, lenKey, migrate, type KotyProgress } from '../src/arcade/koty/meta';
import { LEVELS, RULES } from '../src/arcade/koty/rules';
import { KotySim, bossCourage, courage, waveSize, type SimEvent } from '../src/arcade/koty/sim';
import { DIFFICULTIES, type Difficulty } from '../src/arcade/kit/difficulty';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mulberry32 } from '../src/core/random';

const DAY = '2026-11-28';
const STEP = 1 / 60;
const NOW = Date.UTC(2026, 10, 28, 9, 0, 0);
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };
const ALL_SEEN = ['squad', 'merge', 'merge2', 'equip', 'upgrade', 'eye', 'hunt', 'nap', 'boss', 'paw', 'target', 'pet', 'vintage', 'dusk', 'full'];
const LENGTHS = [40, 180, 300, 600, 900, 1200, 1800, 2700, 3600];
const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const MID = frame({ level: 0.5, activity: 2, focused: true, hold: 1, calm: 0.4 });
const AVG = frame({ level: 0.62, activity: 3, focused: true, hold: 4, calm: 0.6 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

function makeSim(o: { difficulty?: Difficulty; planned?: number; seed?: number; progress?: Partial<KotyProgress>; tuning?: FocusTuning } = {}): KotySim {
  const sim = new KotySim({
    progress: migrate({ ...freshProgress(), ...o.progress, difficulty: o.difficulty ?? 'regular' }), rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: false, tuning: o.tuning ?? TUNING, now: NOW,
  });
  sim.start();
  return sim;
}
const later = (o: Parameters<typeof makeSim>[0] = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

function drive(sim: KotySim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0, n = Math.round(sec / STEP); i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t) : f, clock.t);
    out.push(...sim.take());
  }
  return out;
}

type Prof = 'none' | 'avg' | 'good';
/** One session played as the pace test plays it (the helping paw every 2 s, a ready hunt let go): the chiefs' back-offs. */
function play(p: KotyProgress, planned: number, prof: Prof, seed: number, day = 0) {
  const sim = new KotySim({ progress: p, rng: mulberry32(seed), day: DAY, daySeed: 1, plannedSec: planned, eeg: false, tuning: TUNING, now: NOW + day * 86400_000 });
  sim.start();
  let paw = 2, backs = 0;
  const step = 1 / 30;
  for (let t = 0; t < planned + 6 && !sim.canStop(); t += step) {
    sim.update(step, prof === 'none' ? NONE : prof === 'good' ? HIGH : Math.floor(t / 13) % 2 ? MID : AVG, t);
    for (const e of sim.take()) if (e.type === 'bossBacks') backs++;
    if (sim.story) sim.tap();
    if (t >= paw) {
      paw += 2;
      sim.paw();
      if (sim.huntReady) sim.releaseHunt();
    }
  }
  sim.finish();
  sim.result();
  return { backs, chiefs: sim.bossesNow.length, score: sim.score };
}

/** Three 10-minute sessions in a row on a returning player's watch: the stage reached, the chiefs' back-offs and those chased. */
function watch(d: Difficulty, prof: Prof, seed: number, n = 3) {
  const p = migrate({ ...freshProgress(), sessions: 5, pushes: 1, seen: [...ALL_SEEN], difficulty: d });
  let backs = 0, chiefs = 0;
  for (let s = 0; s < n; s++) {
    const r = play(p, 600, prof, seed * 10 + s, s);
    backs += r.backs;
    chiefs += r.chiefs;
  }
  return { stage: p.stage, backs, chiefs };
}

describe('Kocia straż — the four levels on its knobs', () => {
  it('REGULAR is all ones: the game as it was; the levels grow harder one by one', () => {
    expect(LEVELS.regular).toEqual({ foe: 1, count: 1, speed: 1, self: 1, grace: 1, reward: 1 });
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      const a = LEVELS[DIFFICULTIES[i - 1]], b = LEVELS[DIFFICULTIES[i]];
      for (const k of ['foe', 'count', 'speed', 'reward'] as const) expect(b[k], k).toBeGreaterThan(a[k]);
      for (const k of ['self', 'grace'] as const) expect(b[k], k).toBeLessThan(a[k]);
    }
    expect(LEVELS.hardcore.grace).toBe(0);
  });

  it('puts them into the watch: the pests\' courage, a stage\'s pests, the fish, a chief\'s courage and patience', () => {
    const reg = later({ progress: { stage: 7, bestStage: 7 } });
    for (const d of DIFFICULTIES) {
      const sim = later({ difficulty: d, progress: { stage: 7, bestStage: 7 } }), L = LEVELS[d];
      const pe = sim.spawnPest('mysz', false);
      expect(pe.max).toBeCloseTo(courage(7, 'mysz') * L.foe, 9);
      expect(sim.wave.all).toBe(d === 'regular' ? waveSize(7) : Math.max(1, Math.round(waveSize(7) * L.count)));
      expect(sim.fishOf('mysz')).toBeCloseTo(reg.fishOf('mysz') * L.reward, 9);
    }
    // a chief: his courage × foe, his patience × self
    for (const d of DIFFICULTIES) {
      const sim = later({ difficulty: d, progress: { stage: 5, bestStage: 5 } });
      (sim as unknown as { bossEnter: () => void }).bossEnter();
      const b = sim.boss!;
      expect(b.max).toBeCloseTo(bossCourage(5, b.id) * LEVELS[d].foe, 6);
      const regB = later({ progress: { stage: 5, bestStage: 5 } });
      (regB as unknown as { bossEnter: () => void }).bossEnter();
      expect(b.patienceMax).toBeCloseTo(regB.boss!.patienceMax * LEVELS[d].self, 9);
    }
  });

  it('a chief who backs off: back sooner at Na start, his wounds kept at REGULAR, all his courage again at Hardcore', () => {
    const weak = { stage: 5, bestStage: 5, slots: [{ fam: 'proca' as const, g: 1 }, null, null, null, null, null], squad: ['mruczek' as const] };
    const after = (d: Difficulty) => {
      const sim = later({ difficulty: d, progress: weak });
      const clock = { t: 0 };
      let evs: SimEvent[] = [];
      for (let i = 0; i < 20 && !evs.some(e => e.type === 'bossBacks'); i++) evs = evs.concat(drive(sim, 5, frame({ level: 0.2 }), clock));
      expect(evs.some(e => e.type === 'bossBacks'), d).toBe(true);
      const hurt = 1 - sim.boss!.hp / sim.boss!.max;
      drive(sim, 2, frame({ level: 0.2 }), clock);
      return { hurt, kept: 1 - sim.boss!.hp / sim.boss!.max, farm: sim.wave.all };
    };
    const reg = after('regular'), hard = after('hardcore'), start = after('start');
    expect(reg.hurt).toBeGreaterThan(0);
    expect(reg.kept).toBeCloseTo(reg.hurt, 9);
    expect(hard.kept).toBeCloseTo(0, 9);
    expect(reg.farm).toBe(RULES.farmWave);
    expect(start.farm).toBeLessThan(RULES.farmWave);
    expect(start.kept).toBeCloseTo(start.hurt, 9);
  });
});

describe('Kocia straż — the training is the same at every level', () => {
  it('plans the same blocks at every level, 40 s to 60 min', () => {
    for (const planned of LENGTHS) {
      for (const first of [true, false]) {
        const progress = first ? {} : { sessions: 4 };
        const reg = makeSim({ planned, progress }).plan;
        for (const d of DIFFICULTIES) expect(makeSim({ planned, progress, difficulty: d }).plan, `${d} ${planned}`).toEqual(reg);
      }
    }
  });

  it('the band drives the squad\'s alertness and the Great Hunt the same way at every level', () => {
    const run = (d: Difficulty) => {
      const sim = later({ difficulty: d });
      (sim as unknown as { director: () => void }).director = () => {};
      sim.pests.length = 0;
      const out: number[] = [];
      for (let t = 0; t < 70; t += STEP) {
        const push = sim.block.kind === 'push';
        sim.update(STEP, frame({ level: push ? 0.2 + 0.7 * Math.abs(Math.sin(t / 3)) : 0.3, focused: push && t % 6 > 2, hold: push && t % 6 > 2 ? 6 : 0, calm: push ? 0.1 : 0.8 }), t);
        sim.take();
        out.push(Math.round(sim.alert * 1e9), Math.round(sim.charge * 1e9));
      }
      return out;
    };
    const reg = run('regular');
    for (const d of DIFFICULTIES) expect(run(d), d).toEqual(reg);
  });
});

describe('Kocia straż — every level scores in a 40 s test', () => {
  it('chases pests by 22 s at every level with the smoke test\'s crude input (a centre tap every 0.65 s, Space every ~2 s), first session or a later stage', () => {
    for (const d of DIFFICULTIES) {
      for (const progress of [{}, { sessions: 6, seen: [...ALL_SEEN], stage: 12, bestStage: 12 }] as Partial<KotyProgress>[]) {
        for (let seed = 1; seed <= 3; seed++) {
          const sim = makeSim({ difficulty: d, progress, planned: 40, seed, tuning: BEGINNER });
          let next = 0.65, space = 2;
          const clock = { t: 0 };
          for (let i = 0; i < 22 / STEP; i++) {
            clock.t += STEP;
            sim.update(STEP, HIGH, clock.t);
            sim.take();
            if (clock.t >= next) {
              next += 0.65;
              if (!sim.tap()) sim.clap(5, 6);
            }
            if (clock.t >= space) {
              space += 2;
              sim.key(' ', true);
              sim.key(' ', false);
            }
          }
          // a first session chases a few; a stage-12 watch still holding only the two starter toys at least one
          expect(sim.result().score, `${d}, seed ${seed}, stage ${progress.stage ?? 1}`).toBeGreaterThan(progress.stage ? 0 : 3);
        }
      }
    }
  });
});

describe('Kocia straż — the order, measured at the same focus', () => {
  it('three 10-minute sessions: the watch gets less far and chiefs back off more often level by level (an average, a good and a band-less player)', () => {
    const rows = DIFFICULTIES.map(d => {
      let stage = 0, backs = 0;
      for (const prof of ['avg', 'good', 'none'] as Prof[]) {
        const r = watch(d, prof, 1);
        stage += r.stage;
        backs += r.backs;
      }
      return { stage, backs };
    });
    const say = rows.map(r => `stage ${r.stage}, ${r.backs} back-offs`).join(' · ');
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].stage, `${DIFFICULTIES[i]}: ${say}`).toBeLessThan(rows[i - 1].stage);
      expect(rows[i].backs, `${DIFFICULTIES[i]}: ${say}`).toBeGreaterThan(rows[i - 1].backs);
    }
  }, 300_000);
});

describe('Kocia straż — Hardcore is hard but fair', () => {
  it('a focused watch still chases a chief off every session and reaches the vintage in half an hour; without the band it lags far behind', () => {
    const good = watch('hardcore', 'good', 2);
    expect(good.chiefs).toBeGreaterThanOrEqual(3);
    expect(good.stage).toBeGreaterThanOrEqual(RULES.vintageFrom);
    const none = watch('hardcore', 'none', 2);
    expect(none.stage).toBeLessThan(good.stage);
    expect(none.backs).toBeGreaterThan(good.backs);
  }, 300_000);
});

describe('Kocia straż — records per level, one watch', () => {
  it('an old save plays REGULAR; an odd level is read as REGULAR; the level survives migration', () => {
    expect(freshProgress().difficulty).toBe('regular');
    const old = { ...freshProgress() } as Partial<KotyProgress>;
    delete old.difficulty;
    expect(migrate(old as KotyProgress).difficulty).toBe('regular');
    expect(migrate({ ...freshProgress(), difficulty: 'nightmare' } as unknown as KotyProgress).difficulty).toBe('regular');
    expect(migrate({ ...freshProgress(), difficulty: 'start' }).difficulty).toBe('start');
    expect(migrate({ sessions: 4 } as unknown as KotyProgress).difficulty).toBe('regular');
  });

  it('keeps a record per level (REGULAR the old key) and names a level past REGULAR in the summary', () => {
    const p = migrate({ ...freshProgress(), sessions: 4, seen: [...ALL_SEEN], best: { 40: 9 }, lastLen: 40, difficulty: 'start' });
    const sim = new KotySim({ progress: p, rng: mulberry32(3), day: DAY, daySeed: 1, plannedSec: 40, eeg: false, tuning: TUNING, now: NOW });
    sim.start();
    drive(sim, 46, HIGH);
    const r = sim.result();
    expect(sim.score).toBeGreaterThan(0);
    expect(p.best['40']).toBe(9);
    expect(p.best[lenKey(40, 'start')]).toBe(sim.score);
    expect(r.stats[0]).toEqual([t('stat.difficulty'), 'Na start']);
    expect(bestFor({ ...p, difficulty: 'regular' }, 40)).toBe(9);
    expect(bestOf({ ...p, difficulty: 'hardcore' })).toBeNull();
    const reg = later({ planned: 40 });
    expect(reg.result().stats.some(([k]) => k === t('stat.difficulty'))).toBe(false);
  });

  it('one watch: the stage, the fish and the chief\'s wounds (a share) carry from one level to another', () => {
    const p = migrate({ ...freshProgress(), sessions: 5, pushes: 1, seen: [...ALL_SEEN], difficulty: 'start' });
    play(p, 300, 'avg', 4);
    const stage = p.stage, fish = p.fish;
    expect(stage).toBeGreaterThan(1);
    p.difficulty = 'hardcore';
    const sim = new KotySim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 300, eeg: false, tuning: TUNING, now: NOW });
    expect(sim.p.stage).toBe(stage);
    expect(sim.p.fish).toBe(fish);
  });
});

describe('Kocia straż — the lobby', () => {
  it('opens the card with the difficulty row; a choice saves and shows that level\'s record', async () => {
    const mod = (await import('../src/arcade/koty/index')).default;
    const p = migrate({ ...freshProgress(), sessions: 2, best: { 300: 345, '300@advanced': 123 }, lastLen: 300 });
    let saved = 0;
    const el = mod.progressPanel(p, () => { saved++; });
    const row = el.firstElementChild as HTMLElement;
    expect(row.classList.contains('difficulty')).toBe(true);
    const chips = [...row.querySelectorAll<HTMLButtonElement>('[data-difficulty]')];
    expect(chips.map(c => c.dataset.difficulty)).toEqual([...DIFFICULTIES]);
    expect(el.querySelector('.arcade-stats')!.textContent).toContain('345');
    chips[2].click();
    expect(p.difficulty).toBe('advanced');
    expect(saved).toBe(1);
    expect(el.firstElementChild).toBe(row);
    expect(row.textContent).toContain(t('level.advanced'));
    const stats = el.querySelector('.arcade-stats')!.textContent!;
    expect(stats).toContain('123');
    expect(stats).not.toContain('345');
    expect(mod.best(p)).toBe(123);
  });

  it('says what each level means here, in four languages, with the table\'s numbers', () => {
    for (const cat of Object.values(CATALOGS)) {
      for (const d of DIFFICULTIES) expect(String(cat[`level.${d}` as keyof typeof cat]).length, d).toBeGreaterThan(20);
      expect(String(cat['stat.difficulty']).length).toBeGreaterThan(3);
    }
    expect([LEVELS.start.foe, LEVELS.start.self, LEVELS.advanced.foe, LEVELS.hardcore.foe, LEVELS.hardcore.self, LEVELS.hardcore.reward]).toEqual([0.6, 1.5, 1.4, 2, 0.7, 1.3]);
    expect(t('level.start')).toContain('40%');
    expect(t('level.hardcore')).toContain('30%');
  });
});
