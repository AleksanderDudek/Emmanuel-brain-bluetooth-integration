/**
 * Zastępy's difficulty levels (kit/difficulty.ts, DESIGN §29): Na start · Zwykły · Zaawansowany · Hardcore on the
 * game's own knobs (rules.ts LEVELS).  REGULAR is the game as it was (the tests in arcade-zastepy.test.ts run on it
 * unchanged); the blocks never change with the level; every level scores in a 40 s test; the order is measured with
 * headless battles and with whole sessions played by bots; Hardcore is hard but winnable by a focused player who
 * answers the waves; records are kept per level, the campaign is one across them; the lobby's card opens with the row.
 */
import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from '../src/arcade/kit/difficulty';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { Battle, type Control } from '../src/arcade/zastepy/battle';
import { LINES, LOST_NO_GRACE } from '../src/arcade/zastepy/content';
import { CATALOGS, t } from '../src/arcade/zastepy/i18n';
import { bestFor, bestOf, freshProgress, lenKey, migrate, wallsFor, type ZastepyProgress } from '../src/arcade/zastepy/meta';
import { ANSWER, HOST_IDS, LEVELS, RULES, type HostId } from '../src/arcade/zastepy/rules';
import { ZastepySim } from '../src/arcade/zastepy/sim';
import { mulberry32 } from '../src/core/random';

const DAY = '2026-11-28';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };
const lv = (n: number): Record<HostId, number> => Object.fromEntries(HOST_IDS.map(id => [id, n])) as Record<HostId, number>;
const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
const LENGTHS = [40, 180, 300, 600, 900, 1200, 1800, 2700, 3600];

function makeSim(o: { difficulty?: Difficulty; planned?: number; seed?: number; progress?: Partial<ZastepyProgress>; tuning?: FocusTuning; eeg?: boolean } = {}): ZastepySim {
  const sim = new ZastepySim({
    progress: { ...freshProgress(), ...o.progress, difficulty: o.difficulty ?? 'regular' }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: (o.seed ?? 1) * 7 + 1, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

type Policy = 'idle' | 'mixed' | 'counter';

/** A headless battle (as arcade-zastepy.test.ts plays them) at a level; also the walls it lost per minute. */
function playBattle(o: { battle: number; gate: number; units?: Record<HostId, number>; hero?: number; policy: Policy; band?: boolean; seed?: number; level: Difficulty; maxSec?: number }) {
  const b = new Battle({ battle: o.battle, gate: o.gate, units: o.units ?? lv(1), hero: o.hero ?? 1, retreats: 0, seed: o.seed ?? 7, level: o.level });
  const dt = 1 / 30;
  let acc = 0, lastTrumpet = 0, lost = 0, prev = b.walls;
  for (let t = 0; t < (o.maxSec ?? 400); t += dt) {
    const rest = Math.floor(t / 24) % 2 === 1;
    const ctl: Control = { flow: rest || !o.band ? 1 : 1.6, rest, calm: rest && o.band ? 0.6 : 0 };
    b.step(dt, ctl);
    b.take();
    if (b.walls < prev) lost += prev - b.walls;
    prev = b.walls;
    if (o.band && !rest && t - lastTrumpet >= 30) {
      lastTrumpet = t;
      b.trumpet();
    }
    if (o.policy === 'counter' && b.pillarReady && b.count(-1) >= 2) b.raisePillar();
    if ((acc += dt) >= 3 && o.policy !== 'idle') {
      acc -= 3;
      const shields = b.fighters.filter(f => f.kind === 'tarczownik' && f.state !== 'gone').length;
      const order: HostId[] = ['archaniol', 'serafin', 'jezdziec', 'tarczownik', 'wlocznik', 'lucznik', 'straznik'];
      const lead = o.policy === 'counter' ? b.fighters.find(f => f.side === -1 && f.state !== 'gone' && f.kind in ANSWER) : undefined;
      if (lead) order.unshift(ANSWER[lead.kind as keyof typeof ANSWER]);
      for (const id of order) if (b.ready(id) && (id !== 'tarczownik' || shields < 2)) { b.send(id); break; }
    }
    if (b.outcome) break;
  }
  return { outcome: b.outcome, t: b.t, lostPerMin: lost / (b.t / 60) };
}

/**
 * A whole session played by a bot: a card every 2 s (the answer to the shade in front first when `smart`, the pillar
 * when ready, the trumpet when charged), the first upgrade it can afford between battles; the band's focus `focus`
 * in a Natarcie, calm in a Cisza.
 */
function session(p: ZastepyProgress, planned: number, seed: number, focus: number, smart: boolean) {
  const sim = new ZastepySim({ progress: p, rng: mulberry32(seed), day: `2026-11-0${(seed % 9) + 1}`, daySeed: seed * 13, plannedSec: planned, eeg: false, tuning: TUNING });
  sim.start();
  const dt = 1 / 30;
  let acc = 0, lost = 0;
  for (let t = 0; t < planned + 5 && !sim.canStop(); t += dt) {
    const push = sim.block?.kind === 'push';
    const f: FocusFrame = { reliable: true, activity: 0, threshold: 2, level: push ? focus : 0.3, focused: push && focus > 0.5, hold: 0, calm: push ? 0.2 : focus > 0.5 ? 0.6 : 0.3 };
    sim.update(dt, f, t);
    for (const e of sim.take()) if (e.type === 'lost') lost++;
    sim.cardOn = false;
    const b = sim.battle;
    if (sim.ready) sim.sound();
    if (smart && b.pillarReady && b.count(-1) >= 2) sim.raise();
    if ((acc += dt) >= 2) {
      acc -= 2;
      if (sim.stage === 'upgrade') {
        const i = sim.offers.findIndex(o => o.can);
        if (i >= 0) sim.buy(i);
        else sim.skip();
      } else if (sim.stage === 'battle') {
        const order: HostId[] = ['archaniol', 'serafin', 'jezdziec', 'tarczownik', 'wlocznik', 'lucznik', 'straznik'];
        const lead = smart ? b.fighters.find(x => x.side === -1 && x.state !== 'gone' && x.kind in ANSWER) : undefined;
        if (lead) order.unshift(ANSWER[lead.kind as keyof typeof ANSWER]);
        const shields = b.fighters.filter(x => x.kind === 'tarczownik' && x.state !== 'gone').length;
        for (const id of order) if (b.ready(id) && (id !== 'tarczownik' || shields < 2)) { sim.send(id); break; }
      }
    }
  }
  sim.finish();
  sim.result();
  return { won: sim.wonNow, lost };
}

/** The battle reached after `n` 10-minute sessions from a returning player's fresh campaign. */
function campaign(level: Difficulty, n: number, focus: number, smart: boolean) {
  const p: ZastepyProgress = { ...freshProgress(), sessions: 5, giftDay: '', calls: 1, seen: 31, taught: 127, difficulty: level };
  let lost = 0;
  for (let s = 0; s < n; s++) lost += session(p, 600, s + 1, focus, smart).lost;
  return { battle: p.battle, lost };
}

describe('Zastępy — the four levels on its knobs', () => {
  it('REGULAR is all ones: the game as it was', () => {
    expect(LEVELS.regular).toEqual({ foe: 1, ash: 1, waves: 1, count: 1, speed: 1, walls: 1, grace: 1, light: 1, lift: true, reward: 1 });
    // the walls of REGULAR are the old formula, number for number
    for (const gate of [1, 4, 10]) for (const r of [0, 1, 3]) expect(wallsFor(gate, r)).toBe(RULES.walls + RULES.wallsPerLevel * (gate - 1) + RULES.wallsPerRetreat * r);
  });

  it('grows harder level by level: stronger, quicker demons, weaker walls, fewer helps, more gold', () => {
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      const a = LEVELS[DIFFICULTIES[i - 1]], b = LEVELS[DIFFICULTIES[i]];
      expect(b.foe).toBeGreaterThan(a.foe);
      expect(b.waves).toBeGreaterThan(a.waves);
      expect(b.speed).toBeGreaterThan(a.speed);
      expect(b.walls).toBeLessThan(a.walls);
      expect(b.grace).toBeLessThan(a.grace);
      expect(b.reward).toBeGreaterThan(a.reward);
    }
    // Hardcore: no helps — a withdrawal adds no walls, the answering card does not lift
    expect(LEVELS.hardcore.grace).toBe(0);
    expect(LEVELS.hardcore.lift).toBe(false);
    expect(wallsFor(3, 2, LEVELS.hardcore)).toBe(wallsFor(3, 0, LEVELS.hardcore));
    // the first card is never a wait: a battle starts with at least a strażnik's light
    for (const d of DIFFICULTIES) expect(RULES.lightStart * LEVELS[d].light).toBeGreaterThanOrEqual(20);
  });

  it('puts the knobs into the battle: the demons, the gates, the light', () => {
    const at = (level: Difficulty) => new Battle({ battle: 3, gate: 2, units: lv(1), retreats: 1, seed: 5, level });
    const reg = at('regular');
    for (const d of DIFFICULTIES) {
      const b = at(d), L = LEVELS[d];
      expect(b.demonK).toBeCloseTo(reg.demonK * L.foe, 9);
      expect(b.wallsMax).toBe(wallsFor(2, 1, L));
      expect(b.ashMax).toBe(Math.round(reg.ashMax * L.ash));
      expect(b.light).toBeCloseTo(RULES.lightStart * L.light, 9);
      expect(b.lift).toBe(L.lift);
    }
    // a battle without a level is REGULAR
    expect(new Battle({ battle: 3, gate: 2, units: lv(1), retreats: 1, seed: 5 }).demonK).toBe(reg.demonK);
  });
});

describe('Zastępy — the training is the same at every level', () => {
  it('plans the same blocks at every level, 40 s to 60 min', () => {
    for (const planned of LENGTHS) {
      for (const first of [true, false]) {
        const progress = first ? {} : { sessions: 4, giftDay: DAY };
        const reg = makeSim({ planned, progress }).plan;
        for (const d of DIFFICULTIES) expect(makeSim({ planned, progress, difficulty: d }).plan, `${d} ${planned}`).toEqual(reg);
        expect(reg.reduce((s, b) => s + b.dur, 0)).toBeLessThanOrEqual(planned);
      }
    }
  });

  it('the band works the same: the flow, the trumpet\'s charge and calm\'s mending at every level', () => {
    const run = (d: Difficulty) => {
      const sim = makeSim({ difficulty: d, progress: { sessions: 4, giftDay: DAY, seen: 31, taught: 127 } });
      const out: number[] = [];
      for (let t = 0; t < 70; t += STEP) {
        const push = sim.block.kind === 'push';
        sim.update(STEP, { reliable: true, activity: 0, threshold: 2, level: push ? 0.9 : 0.3, focused: push, hold: 0, calm: push ? 0.1 : 0.7 }, t);
        sim.take();
        out.push(sim.mult, sim.charge, sim.calmNow);
      }
      return out;
    };
    const reg = run('regular');
    for (const d of DIFFICULTIES) expect(run(d)).toEqual(reg);
  });
});

describe('Zastępy — every level scores in a 40 s test', () => {
  /** The smoke test's input (arcade-zastepy.test.ts): a tap on the road every 0.65 s, Space every third, the simulator's focus. */
  function smoke(d: Difficulty, progress: Partial<ZastepyProgress>, seed: number, eeg: boolean): number {
    const sim = makeSim({ difficulty: d, progress, planned: 40, seed, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, taps = 0;
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      sim.update(STEP, f, t);
      if ((tap += STEP) >= 0.65) {
        tap -= 0.65;
        sim.raise(15);
        if (taps++ % 3 === 0) {
          sim.key(' ', true);
          sim.key(' ', false);
        }
      }
      sim.take();
    }
    return sim.result().score;
  }

  it('beats a demon by 22 s at every level, on either band, first session or later', () => {
    for (const d of DIFFICULTIES) {
      for (const eeg of [false, true]) {
        for (let seed = 1; seed <= 6; seed++) {
          expect(smoke(d, {}, seed, eeg), `${d}, eeg ${eeg}, seed ${seed}`).toBeGreaterThan(0);
          expect(smoke(d, { sessions: 6, giftDay: DAY, battle: 4, gate: 3, seen: 31 }, seed, eeg), `${d} later, eeg ${eeg}, seed ${seed}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('Zastępy — the order, measured at the same focus', () => {
  it('an idle gate holds longest at Na start and shortest at Hardcore, and loses its walls faster level by level', () => {
    const holds = DIFFICULTIES.map(d => [1, 2, 3, 4, 5].map(seed => playBattle({ battle: 0, gate: 1, policy: 'idle', seed, level: d })));
    for (const rs of holds) for (const r of rs) expect(r.outcome).toBe('lost');
    const t = holds.map(rs => mean(rs.map(r => r.t))), loss = holds.map(rs => mean(rs.map(r => r.lostPerMin)));
    for (let i = 1; i < t.length; i++) {
      expect(t[i], DIFFICULTIES[i]).toBeLessThan(t[i - 1]);
      expect(loss[i], DIFFICULTIES[i]).toBeGreaterThan(loss[i - 1]);
    }
    // Na start: an idle player's gate stands for minutes — time to find the cards
    expect(t[0]).toBeGreaterThan(200);
  });

  it('a focused player who answers the waves wins the first battle sooner at an easier level', () => {
    const times = DIFFICULTIES.map(d => [1, 2, 3, 4, 5].map(seed => playBattle({ battle: 0, gate: 1, policy: 'counter', band: true, seed, level: d })));
    for (const rs of times) for (const r of rs) expect(r.outcome).toBe('won');
    const t = times.map(rs => mean(rs.map(r => r.t)));
    for (let i = 1; i < t.length; i++) expect(t[i], DIFFICULTIES[i]).toBeGreaterThan(t[i - 1]);
  });

  it('whole sessions: the campaign goes further at an easier level, for a focused player and for one without the band', () => {
    const smart = DIFFICULTIES.map(d => campaign(d, 2, 0.75, true));
    const plain = DIFFICULTIES.map(d => campaign(d, 2, 0.5, false));
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      expect(smart[i].battle, `smart ${DIFFICULTIES[i]}`).toBeLessThan(smart[i - 1].battle);
      expect(plain[i].battle, `plain ${DIFFICULTIES[i]}`).toBeLessThanOrEqual(plain[i - 1].battle);
    }
    expect(plain[3].battle).toBeLessThan(plain[1].battle);
    // Na start: a player without the band never withdraws in the first battles; Hardcore makes a plain player withdraw
    expect(plain[0].lost).toBe(0);
    expect(plain[3].lost).toBeGreaterThan(0);
    // Hardcore is still a campaign for a focused player: several battles in 20 minutes
    expect(smart[3].battle).toBeGreaterThanOrEqual(4);
  });
});

describe('Zastępy — Hardcore is hard but fair', () => {
  it('a decent player without the band or the counters loses the first battle; a focused one who answers wins it', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(playBattle({ battle: 0, gate: 1, policy: 'mixed', seed, level: 'hardcore' }).outcome, `mixed ${seed}`).toBe('lost');
      expect(playBattle({ battle: 0, gate: 1, policy: 'counter', band: true, seed, level: 'hardcore' }).outcome, `counter ${seed}`).toBe('won');
      // the same decent player wins it at REGULAR
      expect(playBattle({ battle: 0, gate: 1, policy: 'mixed', seed, level: 'regular' }).outcome).toBe('won');
    }
  });

  it('the first two boss gates fall to an upgraded host whose band works', () => {
    for (const [battle, gate, units] of [[4, 3, 2], [9, 5, 3]] as const) {
      for (const seed of [1, 2, 3]) {
        expect(playBattle({ battle, gate, units: lv(units), hero: 2, policy: 'counter', band: true, seed, level: 'hardcore' }).outcome, `battle ${battle}, seed ${seed}`).toBe('won');
      }
    }
  });

  it('says no false comfort after a withdrawal: no promise of thicker walls without the grace', () => {
    expect(LOST_NO_GRACE.length).toBe(LINES.lost.length);
    expect(LOST_NO_GRACE[0]).toBe(t('say.lost.hard'));
    expect(LOST_NO_GRACE.slice(1)).toEqual(LINES.lost.slice(1));
    for (const cat of Object.values(CATALOGS)) expect(String(cat['say.lost.hard']).length).toBeLessThanOrEqual(90);
  });
});

describe('Zastępy — records per level, one campaign', () => {
  it('an old save plays REGULAR; an odd level is read as REGULAR; the level survives migration', () => {
    expect(freshProgress().difficulty).toBe('regular');
    const old = { ...freshProgress() } as Partial<ZastepyProgress>;
    delete old.difficulty;
    expect(migrate(old as ZastepyProgress).difficulty).toBe('regular');
    expect(migrate({ ...freshProgress(), difficulty: 'nightmare' } as unknown as ZastepyProgress).difficulty).toBe('regular');
    expect(migrate({ ...freshProgress(), difficulty: 'hardcore' }).difficulty).toBe('hardcore');
    const v1 = migrate({ v: 1, sessions: 3, best: { 300: 20 }, lastLen: 300 } as unknown as ZastepyProgress);
    expect(v1.difficulty).toBe('regular');
    expect(bestOf(v1)).toBe(20);
  });

  it('keeps a record per level (REGULAR the old key) and names a level past REGULAR in the summary', () => {
    const p: ZastepyProgress = { ...freshProgress(), sessions: 4, giftDay: DAY, seen: 31, taught: 127, best: { 40: 9 }, lastLen: 40 };
    const sim = makeSim({ planned: 40, difficulty: 'hardcore', progress: p });
    for (let t = 0; t < 46; t += STEP) {
      sim.update(STEP, { reliable: true, activity: 0, threshold: 2, level: 0.7, focused: true, hold: 0, calm: 0.5 }, t);
      sim.take();
      if (Math.round(t / STEP) % 90 === 0) sim.quick();
    }
    const r = sim.result();
    expect(sim.p.best['40']).toBe(9);
    expect(sim.p.best[lenKey(40, 'hardcore')]).toBe(sim.score);
    expect(lenKey(40, 'hardcore')).toBe('40@hardcore');
    expect(r.stats[0]).toEqual([t('stat.level'), 'Hardcore']);
    // the lobby's record follows the chosen level
    expect(bestFor({ ...sim.p, difficulty: 'regular' }, 40)).toBe(9);
    expect(bestFor({ ...sim.p, difficulty: 'hardcore' }, 40)).toBe(sim.score > 0 ? sim.score : null);
    expect(bestOf({ ...sim.p, difficulty: 'advanced' })).toBeNull();
    // REGULAR's summary is as it was: no level line
    const reg = makeSim({ planned: 40, progress: { sessions: 4, giftDay: DAY } });
    expect(reg.result().stats.some(([k]) => k === t('stat.level'))).toBe(false);
  });

  it('the campaign is one: a battle won at Na start moves the same map a Hardcore session plays on', () => {
    const p: ZastepyProgress = { ...freshProgress(), sessions: 4, giftDay: DAY, seen: 31, taught: 127, difficulty: 'start' };
    session(p, 300, 3, 0.7, true);
    const reached = p.battle, gold = p.gold;
    expect(reached).toBeGreaterThan(0);
    p.difficulty = 'hardcore';
    const sim = makeSim({ difficulty: 'hardcore', progress: p });
    expect(sim.battle.battle).toBe(reached);
    expect(sim.p.gold).toBe(gold);
  });
});

describe('Zastępy — the lobby', () => {
  it('opens the card with the difficulty row: four chips, the chosen one checked, this game\'s line for it', async () => {
    const mod = (await import('../src/arcade/zastepy/index')).default;
    const p: ZastepyProgress = { ...freshProgress(), sessions: 2, best: { 300: 30, '300@hardcore': 12 }, lastLen: 300 };
    let saved = 0;
    const el = mod.progressPanel(p, () => { saved++; });
    const row = el.firstElementChild as HTMLElement;
    expect(row.classList.contains('difficulty')).toBe(true);
    const chips = [...row.querySelectorAll<HTMLButtonElement>('[data-difficulty]')];
    expect(chips.map(c => c.dataset.difficulty)).toEqual([...DIFFICULTIES]);
    expect(row.querySelector('[aria-checked="true"]')?.getAttribute('data-difficulty')).toBe('regular');
    expect(row.textContent).toContain(t('level.regular'));
    expect(el.textContent).toContain('30');
    chips[3].click();
    expect(p.difficulty).toBe('hardcore');
    expect(saved).toBe(1);
    // the row stays on top, says what Hardcore means here, and the card shows Hardcore's record
    expect(el.firstElementChild).toBe(row);
    expect(row.textContent).toContain(t('level.hardcore'));
    expect(mod.best(p)).toBe(12);
    const stats = el.querySelector('.arcade-stats')!.textContent!;
    expect(stats).toContain('12');
    expect(stats).not.toContain('30');
    // a purchase after the change keeps the row
    p.gold = 500;
    const again = mod.progressPanel(p, () => { saved++; });
    const buy = [...again.querySelectorAll('button')].find(b => b.textContent!.startsWith('Podnieś bramę'))!;
    buy.click();
    expect(again.firstElementChild?.classList.contains('difficulty')).toBe(true);
    expect(p.difficulty).toBe('hardcore');
  });

  it('says what each level means here, in four languages', () => {
    for (const cat of Object.values(CATALOGS)) {
      for (const d of DIFFICULTIES) expect(String(cat[`level.${d}` as keyof typeof cat]).length, d).toBeGreaterThan(20);
      expect(String(cat['stat.level']).length).toBeGreaterThan(3);
    }
    // the numbers in the words are the table's
    expect(LEVELS.start.foe).toBe(0.6);
    expect(LEVELS.start.walls).toBe(1.5);
    expect(LEVELS.advanced.foe).toBe(1.2);
    expect(LEVELS.advanced.walls).toBe(0.85);
    expect(LEVELS.hardcore.foe).toBe(1.4);
    expect(LEVELS.hardcore.walls).toBe(0.75);
    expect(LEVELS.hardcore.reward).toBe(1.3);
    expect(t('level.start')).toContain('40%');
    expect(t('level.hardcore')).toContain('30%');
  });
});
