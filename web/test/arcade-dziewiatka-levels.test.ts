/**
 * Dziewiątka's difficulty levels (kit/difficulty.ts, DESIGN §29): Na start · Zwykły · Zaawansowany · Hardcore on the
 * game's own knobs (rules.ts LEVELS).  REGULAR is the game as it was (arcade-dziewiatka.test.ts runs on it unchanged);
 * the blocks and what the band does to the energy never change with the level; every level scores in a 40 s test;
 * the order is measured with 10-minute sessions played the way the smoke test plays (a tap every 0.65 s) at the same
 * focus; Hardcore is hard but a focused player still wins missions; records per level, one town across them; the
 * lobby's card opens with the row.
 */
import { describe, expect, it } from 'vitest';
import { CAMPAIGN, DIN, HEROES, campaignMission } from '../src/arcade/dziewiatka/content';
import { CATALOGS, t } from '../src/arcade/dziewiatka/i18n';
import { bestFor, bestOf, freshProgress, growth, lenKey, migrate, powerOf, type DziewiatkaProgress } from '../src/arcade/dziewiatka/meta';
import { LEVELS, RULES } from '../src/arcade/dziewiatka/rules';
import { DziewiatkaSim } from '../src/arcade/dziewiatka/sim';
import { DIFFICULTIES, type Difficulty } from '../src/arcade/kit/difficulty';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { mulberry32 } from '../src/core/random';

const DAY = '2026-11-28';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };
const SEEN = ['ult', 'tap', 'mult', 'bell', 'well', 'boon', 'wind', 'split', 'swell', 'shield', 'steal', 'rush', 'yawn', 'copy', 'whisper', 'boss'];
const LENGTHS = [40, 180, 300, 600, 900, 1200, 1800, 2700, 3600];
const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });

function makeSim(o: { difficulty?: Difficulty; planned?: number; seed?: number; progress?: Partial<DziewiatkaProgress>; tuning?: FocusTuning; eeg?: boolean } = {}): DziewiatkaSim {
  const progress = migrate(mergeSaved(freshProgress(), { ...freshProgress(), ...o.progress, difficulty: o.difficulty ?? 'regular' }));
  const sim = new DziewiatkaSim({
    progress, rng: mulberry32(o.seed ?? 1), day: DAY, daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}
const later = (o: Parameters<typeof makeSim>[0] = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...SEEN], ...o.progress } });

type Prof = 'none' | 'avg' | 'good';
/** The band for a player: none (no signal), an average or a good focus in a push (with a slow wobble), calm at the well. */
function profFrame(sim: DziewiatkaSim, prof: Prof, t: number): FocusFrame {
  if (prof === 'none') return frame({ reliable: false, activity: null, level: 0, calm: 0 });
  const base = prof === 'avg' ? 0.6 : 0.82, wob = 0.18 * Math.sin(t * 0.45);
  const push = sim.block?.kind === 'push' && sim.phase === 'play';
  const level = push ? Math.max(0, Math.min(1, base + wob)) : 0.25;
  return frame({ activity: level * 8 - 2, level, focused: level >= 0.5, hold: level >= 0.5 ? 6 : 0, calm: push ? 0.1 : base });
}

/** One session on a save, played as the smoke test plays (a tap every 0.65 s, the first boon): heroes fallen, wipes, missions won. */
function play(p: DziewiatkaProgress, planned: number, prof: Prof, seed: number) {
  const sim = new DziewiatkaSim({ progress: p, rng: mulberry32(seed), day: `2026-11-1${seed % 9}`, daySeed: seed * 7, plannedSec: planned, eeg: false, tuning: TUNING });
  sim.start();
  let tap = 0, falls = 0, wipes = 0;
  const step = 1 / 30;
  for (let t = 0; t < planned + 6 && !sim.canStop(); t += step) {
    sim.update(step, profFrame(sim, prof, t), t);
    for (const e of sim.take()) {
      if (e.type === 'fall') falls++;
      if (e.type === 'wipe') wipes++;
    }
    if (sim.story && sim.story.t > 0.7) sim.tap();
    if (sim.choice && sim.choice.t >= 0.3) sim.pick(0);
    if ((tap += step) >= 0.65) {
      tap -= 0.65;
      sim.tap();
    }
  }
  sim.finish();
  sim.result();
  return { falls, wipes, won: sim.missionsWon, score: sim.score };
}

/** A returning player's save, `n` 10-minute sessions in a row: heroes fallen, wipes, the mission reached. */
function campaign(d: Difficulty, prof: Prof, seed: number, n = 2) {
  const p = migrate({ ...freshProgress(), sessions: 5, pushes: 1, seen: [...SEEN], difficulty: d });
  let falls = 0, wipes = 0, won = 0;
  for (let s = 0; s < n; s++) {
    const r = play(p, 600, prof, seed * 10 + s);
    falls += r.falls;
    wipes += r.wipes;
    won += r.won;
  }
  return { falls, wipes, won, mission: p.mission };
}

describe('Dziewiątka — the four levels on its knobs', () => {
  it('REGULAR is all ones: the game as it was; the levels grow harder one by one', () => {
    expect(LEVELS.regular).toEqual({ foe: 1, count: 1, speed: 1, self: 1, grace: 1, reward: 1 });
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      const a = LEVELS[DIFFICULTIES[i - 1]], b = LEVELS[DIFFICULTIES[i]];
      for (const k of ['foe', 'count', 'speed', 'reward'] as const) expect(b[k], k).toBeGreaterThan(a[k]);
      for (const k of ['self', 'grace'] as const) expect(b[k], k).toBeLessThan(a[k]);
    }
    expect(LEVELS.hardcore.grace).toBe(0);
  });

  it('puts them into the battle: the heroes\' health, the shadows\' power and pace, the waves\' size', () => {
    const reg = later();
    for (const d of DIFFICULTIES) {
      const sim = later({ difficulty: d }), L = LEVELS[d];
      sim.battle.heroes.forEach((h, i) => expect(h.max).toBe(Math.round(reg.battle.heroes[i].max * L.self)));
      expect(sim.battle.pace).toBe(L.speed);
      const x = sim.battle.spawn('rozproszek', 2), y = reg.battle.spawn('rozproszek', 2);
      expect(x.speed).toBeCloseTo(y.speed * L.speed, 9);
      expect(x.cd).toBeCloseTo(y.cd / L.speed, 9);
    }
    // a wave's shadows at each level: fewer at Na start (never the boss), more small ones past REGULAR
    const spec = campaignMission(4, RULES.powerStep);
    const sizes = DIFFICULTIES.map(d => {
      const sim = later({ difficulty: d, progress: { mission: 4 } });
      sim.battle.din.length = 0;
      (sim as unknown as { startWave: (n: number) => void }).startWave(2);
      const din = sim.battle.din;
      if (spec.boss) expect(din.some(x => x.spec.boss), d).toBe(true);
      return din.length;
    });
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    // the Din's power at each level × the mission's (a team at the Din's pace: no shyness to bend)
    for (const d of DIFFICULTIES) {
      const sim = later({ difficulty: d });
      expect(sim.mission.shy).toBe(1);
      sim.battle.din.length = 0;
      (sim as unknown as { startWave: (n: number) => void }).startWave(0);
      const s = sim.battle.din.find(x => x.kind === sim.mission.spec.waves[0].kinds[0])!;
      expect(s.max).toBe(Math.round(DIN[s.kind].hp * sim.mission.spec.power * LEVELS[d].foe));
    }
  });

  it('the Din is shyer at Na start against a team behind its pace, and not shy at all at Hardcore', () => {
    const shy = DIFFICULTIES.map(d => later({ difficulty: d, progress: { mission: 20 } }).mission.shy);
    expect(shy[1]).toBeLessThan(1);
    expect(shy[0]).toBeLessThan(shy[1]);
    expect(shy[2]).toBeGreaterThan(shy[1]);
    expect(shy[3]).toBe(1);
    // the team's power is the same at every level (the town is one)
    const p = later({ progress: { mission: 20 } }).p;
    expect(powerOf(growth(p, 'milosc'))).toBe(powerOf(growth(later({ difficulty: 'hardcore', progress: { mission: 20 } }).p, 'milosc')));
    void HEROES;
  });
});

describe('Dziewiątka — the training is the same at every level', () => {
  it('plans the same blocks at every level, 40 s to 60 min', () => {
    for (const planned of LENGTHS) {
      for (const first of [true, false]) {
        const progress = first ? {} : { sessions: 4 };
        const reg = makeSim({ planned, progress }).plan;
        for (const d of DIFFICULTIES) expect(makeSim({ planned, progress, difficulty: d }).plan, `${d} ${planned}`).toEqual(reg);
      }
    }
  });

  it('the band drives the energy\'s multiplier and Harmony the same way at every level', () => {
    const run = (d: Difficulty) => {
      const sim = later({ difficulty: d });
      (sim as unknown as { missionFrame: () => void }).missionFrame = () => {};
      sim.battle.din.length = 0;
      const out: number[] = [];
      for (let t = 0; t < 70; t += STEP) {
        const push = sim.block.kind === 'push';
        sim.update(STEP, frame({ level: push ? 0.2 + 0.7 * Math.abs(Math.sin(t / 3)) : 0.3, focused: push && t % 6 > 2, hold: push && t % 6 > 2 ? 6 : 0, calm: push ? 0.1 : 0.8 }), t);
        sim.take();
        if (sim.choice) sim.pick(0);
        out.push(sim.mult, Math.round(sim.harmony * 1e9));
      }
      return out;
    };
    const reg = run('regular');
    for (const d of DIFFICULTIES) expect(run(d), d).toEqual(reg);
  });
});

describe('Dziewiątka — every level scores in a 40 s test', () => {
  /** The smoke test's input (arcade-dziewiatka.test.ts): a click at the centre every 0.65 s, Space every 2 s, the simulator's focus. */
  function smoke(d: Difficulty, progress: Partial<DziewiatkaProgress>, seed: number, eeg: boolean): number {
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
        sim.tap();
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

  it('hushes shadows by 22 s at every level, on either band, first session or later', () => {
    for (const d of DIFFICULTIES) {
      for (const eeg of [false, true]) {
        for (let seed = 1; seed <= 4; seed++) {
          expect(smoke(d, {}, seed, eeg), `${d}, eeg ${eeg}, seed ${seed}`).toBeGreaterThan(2);
          expect(smoke(d, { sessions: 6, seen: [...SEEN], mission: 12 }, seed, eeg), `${d} later, seed ${seed}`).toBeGreaterThan(2);
        }
      }
    }
  });
});

describe('Dziewiątka — the order, measured at the same focus', () => {
  it('two 10-minute sessions: more heroes fall and fewer missions are won level by level, for an average, a good and a band-less player', () => {
    const rows = DIFFICULTIES.map(d => {
      let falls = 0, mission = 0;
      for (const prof of ['avg', 'good', 'none'] as Prof[]) {
        const r = campaign(d, prof, 1);
        falls += r.falls;
        mission += r.mission;
      }
      return { falls, mission };
    });
    const say = rows.map(r => `${r.falls} fallen, mission ${r.mission}`).join(' · ');
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].falls, `${DIFFICULTIES[i]}: ${say}`).toBeGreaterThan(rows[i - 1].falls);
      expect(rows[i].mission, `${DIFFICULTIES[i]}: ${say}`).toBeLessThan(rows[i - 1].mission);
    }
    // Na start: nobody falls, not even without the band
    expect(rows[0].falls).toBe(0);
  }, 300_000);
});

describe('Dziewiątka — Hardcore is hard but fair', () => {
  it('a focused player still wins missions every session; one without the band sees the five fall again and again', () => {
    for (const seed of [1, 2]) {
      const good = campaign('hardcore', 'good', seed, 1);
      expect(good.won, `seed ${seed}`).toBeGreaterThanOrEqual(5);
      const none = campaign('hardcore', 'none', seed, 1);
      expect(none.falls, `seed ${seed}`).toBeGreaterThan(5);
      expect(none.won).toBeLessThan(good.won);
    }
  }, 300_000);
});

describe('Dziewiątka — records per level, one town', () => {
  it('an old save plays REGULAR; an odd level is read as REGULAR; the level survives migration', () => {
    expect(freshProgress().difficulty).toBe('regular');
    const old = { ...freshProgress() } as Partial<DziewiatkaProgress>;
    delete old.difficulty;
    expect(migrate(old as DziewiatkaProgress).difficulty).toBe('regular');
    expect(migrate({ ...freshProgress(), difficulty: 'nightmare' } as unknown as DziewiatkaProgress).difficulty).toBe('regular');
    expect(migrate({ ...freshProgress(), difficulty: 'hardcore' }).difficulty).toBe('hardcore');
    // the foundation's placeholder save
    expect(migrate({ sessions: 4 } as unknown as DziewiatkaProgress).difficulty).toBe('regular');
  });

  it('keeps a record per level (REGULAR the old key) and names a level past REGULAR in the summary', () => {
    const p = migrate({ ...freshProgress(), sessions: 4, seen: [...SEEN], best: { 40: 9 }, lastLen: 40, difficulty: 'advanced' });
    const sim = new DziewiatkaSim({ progress: p, rng: mulberry32(3), day: DAY, daySeed: 1, plannedSec: 40, eeg: false, tuning: TUNING });
    sim.start();
    for (let t = 0; t < 46; t += STEP) {
      sim.update(STEP, frame({ level: 0.7, focused: true }), t);
      sim.take();
      if (sim.choice) sim.pick(0);
      if (Math.round(t / STEP) % 40 === 0) sim.tap();
    }
    const r = sim.result();
    expect(sim.score).toBeGreaterThan(0);
    expect(p.best['40']).toBe(9);
    expect(p.best[lenKey(40, 'advanced')]).toBe(sim.score);
    // the level's name, with a soft hyphen so a narrow summary tile breaks it rather than clipping it
    expect(r.stats[0]).toEqual([t('stat.difficulty'), 'Zaawan\u00adsowany']);
    expect(r.stats[0][1].replace(/\u00ad/g, '')).toBe('Zaawansowany');
    expect(bestFor({ ...p, difficulty: 'regular' }, 40)).toBe(9);
    expect(bestOf({ ...p, difficulty: 'hardcore' })).toBeNull();
    const reg = later({ planned: 40 });
    expect(reg.result().stats.some(([k]) => k === t('stat.difficulty'))).toBe(false);
  });

  it('one town: missions won at Na start move the same campaign a Hardcore session goes on with', () => {
    const p = migrate({ ...freshProgress(), sessions: 5, pushes: 1, seen: [...SEEN], difficulty: 'start' });
    play(p, 300, 'avg', 4);
    const at = p.mission, stars = [...p.stars];
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThanOrEqual(CAMPAIGN);
    p.difficulty = 'hardcore';
    const sim = new DziewiatkaSim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 300, eeg: false, tuning: TUNING });
    expect(sim.mission.spec.index).toBe(Math.min(at, CAMPAIGN - 1));
    expect(sim.p.stars).toEqual(stars);
  });
});

describe('Dziewiątka — the lobby', () => {
  it('opens the card with the difficulty row; a choice saves and shows that level\'s record', async () => {
    const mod = (await import('../src/arcade/dziewiatka/index')).default;
    const p = migrate({ ...freshProgress(), sessions: 2, best: { 300: 345, '300@hardcore': 123 }, lastLen: 300 });
    let saved = 0;
    const el = mod.progressPanel(p, () => { saved++; });
    const row = el.firstElementChild as HTMLElement;
    expect(row.classList.contains('difficulty')).toBe(true);
    const chips = [...row.querySelectorAll<HTMLButtonElement>('[data-difficulty]')];
    expect(chips.map(c => c.dataset.difficulty)).toEqual([...DIFFICULTIES]);
    expect(el.textContent).toContain('345');
    chips[3].click();
    expect(p.difficulty).toBe('hardcore');
    expect(saved).toBe(1);
    expect(el.firstElementChild).toBe(row);
    expect(row.textContent).toContain(t('level.hardcore'));
    expect(el.textContent).toContain('123');
    expect(el.textContent).not.toContain('345');
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
