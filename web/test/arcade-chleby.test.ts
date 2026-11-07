import { describe, expect, it } from 'vitest';
import { LINES } from '../src/arcade/chleby/content';
import { Hill, isPelikan, placeOf, planLevel, type HillEvent } from '../src/arcade/chleby/hill';
import { CATALOGS, t, unit } from '../src/arcade/chleby/i18n';
import { bestOf, buyUp, freshProgress, offers, starsFor, upPrice, type ChlebyProgress } from '../src/arcade/chleby/meta';
import { RULES, goldMult } from '../src/arcade/chleby/rules';
import { ChlebySim, planBlocks, sayDur, type SimEvent } from '../src/arcade/chleby/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-07';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };
const NO_GULLS = { gold: 1, rest: true, quiet: true };
const CTL = { gold: 1, rest: false, quiet: true };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });

type SimOpts = { progress?: Partial<ChlebyProgress>; planned?: number; seed?: number; eeg?: boolean; daySeed?: number; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): ChlebySim {
  const sim = new ChlebySim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: o.daySeed ?? 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no gift, the opening card seen): the rules one at a time. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, giftDay: DAY, calls: 1, seen: 1, ...o.progress } });

function drive(sim: ChlebySim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t) : f, clock.t);
    each?.(clock.t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

function toBlock(sim: ChlebySim, i: number, f: FocusFrame | ((t: number) => FocusFrame) = frame(), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  while (sim.blockIndex < i && sim.phase === 'play') out.push(...drive(sim, STEP, f, clock));
  return out;
}

/** A hill with only the gates given (the level's own gates dropped), at level `level`. */
function bare(level = 1, gates: Partial<Hill['gates'][number]>[] = []): Hill {
  const h = new Hill(level, { seed: 3 });
  h.gates.length = 0;
  h.gulls.length = 0;
  h.pelikan = null;
  gates.forEach((g, id) => h.gates.push({
    id, kind: 'add', n: 1, left: g.n ?? 1, down: 0, y: 8, w: 10, x0: 5, slide: 0, speed: 0, phase: 0, x: 5, passed: 0, flash: 0, ...g,
  }));
  return h;
}

function stepHill(h: Hill, sec: number, ctl = NO_GULLS): HillEvent[] {
  const out: HillEvent[] = [];
  for (let i = 0; i < Math.round(sec / STEP); i++) {
    h.step(STEP, ctl);
    out.push(...h.take());
  }
  return out;
}

const fedBy = (evs: HillEvent[]) => evs.reduce((s, e) => s + (e.type === 'feed' ? e.n : 0), 0);

describe('the levels on the path of hillsides', () => {
  it('opens with four groups of fifty, two rows of gates and the golden gate nearest the hungry', () => {
    const p = planLevel(0);
    expect(p.groups).toEqual([50, 50, 50, 50]);
    const gold = p.gates.filter(g => g.kind === 'gold');
    expect(gold).toHaveLength(1);
    expect(Math.max(...p.gates.map(g => g.y))).toBe(gold[0].y);
    expect(new Set(p.gates.map(g => g.y)).size).toBe(2);
  });

  it('grows: more groups (at most six), hundreds, more rows, a time that fits the hunger', () => {
    for (let L = 0; L < 40; L++) {
      const p = planLevel(L);
      expect(p.groups.length).toBeGreaterThanOrEqual(4);
      expect(p.groups.length).toBeLessThanOrEqual(RULES.groupsMax);
      expect(p.gates.filter(g => g.kind === 'gold')).toHaveLength(1);
      for (const g of p.gates) {
        expect(g.x0 - g.w / 2 - g.slide).toBeGreaterThanOrEqual(-0.01);
        expect(g.x0 + g.w / 2 + g.slide).toBeLessThanOrEqual(RULES.laneW + 0.01);
      }
      expect(p.limit).toBeGreaterThan(RULES.timeBase);
    }
    expect(planLevel(12).groups.some(g => g >= 100)).toBe(true);
    expect(planLevel(9).hunger).toBeGreaterThan(planLevel(0).hunger);
  });

  it('is the same level for everyone; every fourth is the Pelikan\'s; chapters of four, six hillsides round', () => {
    expect(planLevel(7)).toEqual(planLevel(7));
    expect([0, 1, 2, 3, 7, 11].map(isPelikan)).toEqual([false, false, false, true, true, true]);
    expect(placeOf(4)).toEqual({ chapter: 1, circle: 0, local: 0 });
    expect(placeOf(24)).toEqual({ chapter: 0, circle: 1, local: 0 });
    expect(planLevel(24).hunger).toBeGreaterThan(planLevel(0).hunger);
    expect(new Hill(3).pelikan).not.toBeNull();
  });

  it('puts a ×2 start gate over the basket when it is bought, wider each level', () => {
    expect(planLevel(1, 0).gates.some(g => g.kind === 'start')).toBe(false);
    const w1 = planLevel(1, 1).gates.find(g => g.kind === 'start')!.w;
    const w3 = planLevel(1, 3).gates.find(g => g.kind === 'start')!.w;
    expect(w3).toBeGreaterThan(w1);
  });
});

describe('the bread on the hill', () => {
  it('rolls up and feeds the nearest hungry group of the front row', () => {
    const h = bare(0);
    h.fire(1, 'loaf');
    const evs = stepHill(h, 4);
    expect(fedBy(evs)).toBe(1);
    expect(h.groups[0].fed).toBe(1);   // x = 1 sits over the first group
  });

  it('adds through a green gate, multiplies through a honey one', () => {
    const add = bare(1, [{ kind: 'add', n: 2 }]);
    add.fire(5, 'loaf');
    expect(fedBy(stepHill(add, 4))).toBe(3);
    const mul = bare(1, [{ kind: 'mul', n: 3 }]);
    mul.fire(5, 'loaf');
    expect(fedBy(stepHill(mul, 4))).toBe(3);
    const both = bare(1, [{ kind: 'add', n: 1, y: 6 }, { kind: 'mul', n: 2, y: 12 }]);
    both.fire(5, 'loaf');
    expect(fedBy(stepHill(both, 4))).toBe(4);
  });

  it('counts a gate once per piece, and only inside its width', () => {
    const h = bare(1, [{ kind: 'mul', n: 2, w: 2, x0: 2, x: 2 }]);
    h.fire(8, 'loaf');
    expect(fedBy(stepHill(h, 4))).toBe(1);
  });

  it('multiplies by the golden gate\'s number the session sets: ×1 below the threshold', () => {
    for (const [gold, fed] of [[1, 10], [2, 20], [5, 50]] as const) {
      const h = bare(1, [{ kind: 'gold', n: 1 }]);
      for (let i = 0; i < 10; i++) h.fire(5, 'loaf');
      expect(fedBy(stepHill(h, 4, { gold, rest: true, quiet: true }))).toBe(fed);
    }
  });

  it('a grey gate swallows until its count is used up, breaks, and comes back; what it took goes to the crumbs', () => {
    const h = bare(1, [{ kind: 'sub', n: 3, left: 3 }]);
    for (let i = 0; i < 5; i++) h.fire(5, 'loaf');
    const evs = stepHill(h, 4);
    expect(evs.filter(e => e.type === 'swallow')).toHaveLength(3);
    expect(evs.filter(e => e.type === 'break')).toHaveLength(1);
    expect(fedBy(evs)).toBe(2);
    expect(h.crumbs).toBe(3);
    stepHill(h, RULES.greyBack);
    expect(h.gates[0].left).toBe(3);
  });

  it('a fish leaps over the first grey gate', () => {
    const h = bare(1, [{ kind: 'sub', n: 3, left: 3 }]);
    h.fire(5, 'fish');
    const evs = stepHill(h, 3);
    expect(evs.some(e => e.type === 'leap')).toBe(true);
    expect(fedBy(evs)).toBe(1);
  });

  it('the big basket splits at the first gate, and the gate counts each of its loaves', () => {
    const h = bare(1, [{ kind: 'mul', n: 2 }]);
    h.fire(5, 'big', 20);
    const evs = stepHill(h, 9);
    expect(evs.filter(e => e.type === 'split')).toHaveLength(1);
    expect(fedBy(evs)).toBe(40);
    const open = bare(1);
    open.fire(5, 'big', 20);
    expect(fedBy(stepHill(open, 9))).toBe(20);
  });

  it('a crowded hill makes pieces heavier instead of more: nothing is lost', () => {
    const h = bare(5, [{ kind: 'gold', n: 1 }]);
    for (let i = 0; i < RULES.maxPieces; i++) h.fire(5, 'loaf');
    const evs = stepHill(h, 4, { gold: 3, rest: true, quiet: true });
    expect(h.pieces.length).toBe(0);
    expect(fedBy(evs) + h.crumbs).toBe(RULES.maxPieces * 3);
  });

  it('feeds row after row and ends the level when everyone has eaten', () => {
    const h = bare(2);
    expect(h.rows).toBe(2);
    let evs: HillEvent[] = [];
    while (!h.done && h.t < 120) {
      h.fire(h.t * 3 % 10, 'loaf', 10);
      evs = evs.concat(stepHill(h, 0.1));
    }
    expect(h.done).toBe(true);
    expect(h.byTime).toBe(false);
    expect(evs.some(e => e.type === 'row')).toBe(true);
    expect(evs.filter(e => e.type === 'fed')).toHaveLength(h.groups.length);
    expect(h.left).toBe(0);
  });

  it('when time runs out the disciples feed the rest', () => {
    const h = bare(0);
    const evs = stepHill(h, h.limit + 0.5);
    const done = evs.find(e => e.type === 'done');
    expect(done).toMatchObject({ byTime: true, left: 200 });
    expect(h.left).toBe(0);
  });
});

describe('the gulls and the Pelikan', () => {
  it('a gull takes one piece and flies off; the next piece knocks it into the lake', () => {
    const h = bare(1);
    stepHill(h, 0.01);
    (h as unknown as { spawnGull(k: string, s: number, f: boolean): void }).spawnGull('gull', 0, false);
    const g = h.gulls[0];
    g.x = 5; g.y = 3; g.speed = 0; g.baseY = 3; g.amp = 0;
    h.fire(5, 'loaf');
    let evs = stepHill(h, 0.6, CTL);
    expect(evs.filter(e => e.type === 'steal')).toHaveLength(1);
    expect(g.state).toBe('carry');
    expect(h.crumbs).toBe(1);
    g.speed = 0;
    h.fire(g.x, 'loaf');
    const p = h.pieces[h.pieces.length - 1];
    p.y = g.y - 0.3;
    evs = stepHill(h, 0.2, CTL);
    expect(evs.some(e => e.type === 'knock')).toBe(true);
  });

  it('Mirka takes five, laughs, and the sixth knocks her in', () => {
    const h = bare(2);
    stepHill(h, 0.01);
    (h as unknown as { spawnGull(k: string, s: number, f: boolean): void }).spawnGull('mirka', 0, false);
    const g = h.gulls[0];
    g.x = 5; g.y = 3; g.speed = 0; g.baseY = 3; g.amp = 0;
    const evs: HillEvent[] = [];
    for (let i = 0; i < 6; i++) {
      h.fire(5, 'loaf');
      evs.push(...stepHill(h, 0.5, CTL));
    }
    const steals = evs.filter((e): e is Extract<HillEvent, { type: 'steal' }> => e.type === 'steal');
    expect(steals).toHaveLength(RULES.mirkaTakes);
    expect(steals[steals.length - 1].laugh).toBe(true);
    expect(evs.some(e => e.type === 'knock' && e.kind === 'mirka')).toBe(true);
  });

  it('gulls come in play, never in a rest; Mirka once a level from level 1; flocks from level 2', () => {
    const h = new Hill(4, { seed: 5 });
    const evs = stepHill(h, 40, { gold: 1, rest: false, quiet: false });
    const gulls = evs.filter((e): e is Extract<HillEvent, { type: 'gull' }> => e.type === 'gull');
    expect(gulls.length).toBeGreaterThan(3);
    expect(gulls.filter(e => e.kind === 'mirka')).toHaveLength(1);
    expect(gulls.some(e => e.flock)).toBe(true);
    const r = new Hill(4, { seed: 5 });
    expect(stepHill(r, 40, { gold: 1, rest: true, quiet: false }).some(e => e.type === 'gull')).toBe(false);
  });

  it('the Pelikan gulps the bread that meets him until his pouch is full, then waddles off', () => {
    const h = new Hill(3, { seed: 2 });
    h.gates.length = 0;
    h.gulls.length = 0;
    const pk = h.pelikan!;
    const evs: HillEvent[] = [];
    while (pk.state === 'sit' && h.t < 60) {
      h.fire(pk.x, 'loaf', 5);
      evs.push(...stepHill(h, 0.1, NO_GULLS));
    }
    expect(evs.some(e => e.type === 'sated')).toBe(true);
    expect(pk.pouch).toBe(pk.cap);
    evs.push(...stepHill(h, 6, NO_GULLS));
    expect(pk.state).toBe('gone');
  });
});

describe('the golden gate (Rozdawanie)', () => {
  it('×1 below the threshold and never below, ×2 at it, ×5 high above it, in halves', () => {
    expect(goldMult(0)).toBe(1);
    expect(goldMult(0.49)).toBe(1);
    expect(goldMult(0.5)).toBe(2);
    expect(goldMult(0.7)).toBe(3.5);
    expect(goldMult(0.9)).toBe(5);
    expect(goldMult(1)).toBe(5);
    for (let l = 0.5; l <= 1; l += 0.01) expect((goldMult(l) * 2) % 1).toBe(0);
  });

  it('answers the band only in a sighted push past its lead-in (5 s Mendi, 2 s HALO)', () => {
    for (const [eeg, lead] of [[false, 5], [true, 2]] as const) {
      const sim = later({ eeg });
      expect(sim.block.kind).toBe('push');
      const hi = frame({ level: 0.9, focused: true });
      drive(sim, lead - 0.3, hi);
      expect(sim.gold).toBe(1);
      drive(sim, 0.6, hi);
      expect(sim.gold).toBe(5);
    }
  });

  it('stays ×1 while the signal is unreliable — never less', () => {
    const sim = later();
    drive(sim, 6, frame({ level: 0.9 }));
    drive(sim, 1, frame({ reliable: false, level: 0.9 }));
    expect(sim.gold).toBe(1);
  });

  it('feeds more people with a focus above the threshold than without', () => {
    const run = (level: number) => {
      const sim = later({ planned: 40, progress: { level: 9 } });
      const clock = { t: 0 };
      drive(sim, 20, frame({ level, focused: level > 0.5 }), clock, () => { if (!sim.pressing) sim.press(sim.hill.goldGate!.x); });
      return sim.score;
    };
    expect(run(0.9)).toBeGreaterThan(run(0.2) * 1.4);
  });

  it('fills the big basket with a held focus (6 s Mendi, 3 s HALO); the next throw is the big basket', () => {
    for (const [eeg, need] of [[false, 6], [true, 3]] as const) {
      const sim = later({ eeg });
      const lead = eeg ? 2 : 5;
      const evs = drive(sim, lead + need + 0.3, frame({ level: 0.8, focused: true }));
      expect(ofType(evs, 'bigReady')).toHaveLength(1);
      expect(sim.bigReady).toBe(true);
      sim.volley();
      const fired = drive(sim, 0.5, frame({ level: 0.8, focused: true }));
      expect(ofType(fired, 'fire')[0].kind).toBe('big');
      expect(sim.bigReady).toBe(false);
      expect(sim.bigsNow).toBe(1);
    }
  });

  it('a broken hold lets an unfilled big basket sink slowly, not at once', () => {
    const sim = later();
    drive(sim, 5 + 3, frame({ level: 0.8, focused: true }));
    const c = sim.charge;
    drive(sim, 1, frame({ level: 0.3, focused: false }));
    expect(sim.charge).toBeGreaterThan(0);
    expect(sim.charge).toBeLessThan(c);
  });
});

describe('Na trawie (rest)', () => {
  it('calm gathers the crumbs into baskets past its lead-in; a passed rest adds a full one', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame({ level: 0.6, focused: true, activity: 5 }), clock);
    expect(sim.block.kind).toBe('rest');
    const calm = frame({ level: 0.1, calm: 1, activity: -2, threshold: 2 });
    drive(sim, RULES.calmLead.fnirs - 0.2, calm, clock);
    expect(sim.basketFill).toBe(0);
    const evs = drive(sim, sim.block.dur - sim.blockT + 0.1, calm, clock);
    const baskets = ofType(evs, 'basket');
    expect(baskets.filter(b => !b.pass).length).toBeGreaterThanOrEqual(2);
    expect(baskets.some(b => b.pass)).toBe(true);
    expect(ofType(evs, 'restPass')).toHaveLength(1);
    expect(sim.grainNow).toBeGreaterThan(0);
  });

  it('sends the gulls back to the lake (none come in a rest)', () => {
    const sim = later({ progress: { level: 5 } });
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    const evs = drive(sim, 8, frame({ calm: 0.8 }), clock);
    expect(ofType(evs, 'gull')).toHaveLength(0);
  });

  it('has no verdict without enough signal (never a loss)', () => {
    const sim = later();
    const evs = toBlock(sim, 1, frame({ reliable: false, activity: null }));
    expect(ofType(evs, 'blockEnd')[0].verdict).toBeNull();
  });
});

describe('Mgła nad jeziorem (blind)', () => {
  it('comes every 4th push from the 3rd session, never a session\'s first', () => {
    const sim = makeSim({ progress: { sessions: 4, giftDay: DAY, calls: 2, seen: 1 }, planned: 600 });
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    expect(sim.plan[0].blind).toBe(false);
    expect(sim.block.blind).toBe(true);
    expect(sim.blind).toBe(true);
  });

  it('keeps the gate ×1 and veils the trace while it runs; at its end the judged share pours at once', () => {
    const sim = makeSim({ progress: { sessions: 4, giftDay: DAY, calls: 2, seen: 1 }, planned: 600 });
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    const hi = frame({ level: 0.9, focused: true, activity: 6, threshold: 2 });
    drive(sim, 8, hi, clock);
    expect(sim.gold).toBe(1);
    expect(sim.goldWant).toBe(5);
    expect(sim.trace.latest?.veiled).toBe(true);
    const evs = toBlock(sim, 3, hi, clock);
    const pay = ofType(evs, 'blindPay')[0];
    expect(pay.share).toBeGreaterThan(0.9);
    expect(pay.loaves).toBe(Math.round(pay.share * 15 * RULES.blindLoaves));
    expect(sim.trace.samples.some(s => s.veiled)).toBe(false);
  });
});

describe('the hands', () => {
  it('a press throws a short volley where it lands; a held press pours a stream; a drag aims', () => {
    const sim = later();
    sim.press(2);
    let evs = drive(sim, 0.24, frame());
    expect(ofType(evs, 'fire')).toHaveLength(RULES.volley);
    evs = drive(sim, 2, frame());
    expect(ofType(evs, 'fire').length).toBeGreaterThanOrEqual(Math.floor(RULES.stream * 1.6));
    expect(sim.x).toBeCloseTo(2, 1);
    sim.drag(8);
    drive(sim, 0.5, frame());
    expect(sim.x).toBeCloseTo(8, 1);
    sim.release();
    expect(ofType(drive(sim, 1, frame()), 'fire')).toHaveLength(0);
  });

  it('throws a fish every few pieces (more often with the fish upgrade)', () => {
    const count = (fish: number) => {
      const sim = later({ progress: { up: { stream: 0, start: 0, fish, big: 0 } } });
      sim.press(5);
      return ofType(drive(sim, 4, frame()), 'fire').filter(e => e.kind === 'fish').length;
    };
    expect(count(3)).toBeGreaterThan(count(0));
  });

  it('keys: arrows move, Space throws a volley', () => {
    const sim = later();
    expect(sim.key('ArrowLeft', true)).toBe(true);
    drive(sim, 0.4, frame());
    sim.key('ArrowLeft', false);
    expect(sim.x).toBeLessThan(5);
    sim.key(' ', true);
    expect(ofType(drive(sim, 0.3, frame()), 'fire')).toHaveLength(RULES.volley);
    expect(sim.key('x', true)).toBe(false);
  });
});

describe('levels in a session', () => {
  /** Pours steadily at the golden gate. */
  const pour = (sim: ChlebySim) => () => {
    if (sim.stage === 'level' && sim.hill.goldGate) {
      if (!sim.pressing) sim.press(sim.hill.goldGate.x);
      else sim.drag(sim.hill.goldGate.x);
    }
  };

  it('counts the people fed live: the headline is the score', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 6, frame(), clock, pour(sim));
    expect(sim.score).toBeGreaterThan(0);
    expect(sim.result().score).toBe(sim.score);
  });

  it('a level fed pays stars and grain, saves the next level, and the next hillside follows', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    const evs = drive(sim, 90, frame({ level: 0.7, focused: true }), clock, pour(sim));
    const won = ofType(evs, 'won');
    expect(won.length).toBeGreaterThanOrEqual(1);
    expect(won[0].stars).toBeGreaterThanOrEqual(2);
    expect(sim.p.level).toBeGreaterThanOrEqual(1);
    expect(sim.p.stars[0]).toBe(won[0].stars);
    expect(ofType(evs, 'levelStart').length).toBeGreaterThanOrEqual(2);
    expect(sim.grainNow).toBeGreaterThan(0);
  });

  it('shows the card of upgrades only when the grain buys one; keys buy, Space goes on', () => {
    const sim = later({ planned: 600, progress: { grain: 500 } });
    const clock = { t: 0 };
    let saw = false;
    drive(sim, 120, frame({ level: 0.7, focused: true }), clock, () => {
      pour(sim)();
      if (sim.stage === 'upgrade' && !saw) {
        saw = true;
        const g = sim.p.grain;
        expect(sim.key('1', true)).toBe(true);
        expect(sim.p.grain).toBeLessThan(g);
        sim.key(' ', true);
      }
    });
    expect(saw).toBe(true);
    expect(sim.upsBought).toBe(1);
  });

  it('a level fed at least halfway when the session ends is finished by the disciples, at half', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, 60, frame(), clock, () => { if (sim.stage === 'level' && sim.hill.share < 0.6) pour(sim)(); else sim.release(); });
    if (sim.stage === 'level' && sim.hill.share >= 0.5 && !sim.hill.done) {
      const lv = sim.p.level, score = sim.score, left = sim.hill.left, before = sim.disciplesNow;
      sim.finish();
      expect(sim.p.level).toBe(lv + 1);
      expect(sim.score).toBe(score + Math.ceil(left / 2));
      expect(sim.disciplesNow).toBe(before + 1);
    }
  });
});

describe('the companion', () => {
  it('speaks one line at a time, 2–4 s, never over the block banner or the telegraph', () => {
    const sim = makeSim({ planned: 300 });
    const clock = { t: 0 };
    const lines: { t: number; dur: number; text: string }[] = [];
    drive(sim, 280, frame({ level: 0.8, focused: true }), clock, t => {
      for (const e of sim.take()) {
        if (e.type !== 'say') continue;
        lines.push({ t, dur: e.dur, text: e.text });
        if (sim.phase === 'play' && sim.block.kind !== 'warmup') {
          expect(sim.blockT).toBeGreaterThanOrEqual(5.3);
          expect(sim.blockT).toBeLessThan(sim.block.dur - RULES.telegraph);
        }
      }
      if (sim.stage === 'level' && !sim.pressing) sim.press(5);
    });
    expect(lines.length).toBeGreaterThan(5);
    for (let i = 1; i < lines.length; i++) expect(lines[i].t).toBeGreaterThanOrEqual(lines[i - 1].t + lines[i - 1].dur);
    for (const l of lines) {
      expect(l.dur).toBeGreaterThanOrEqual(2);
      expect(l.dur).toBeLessThanOrEqual(4);
    }
    // never the same line twice in a session
    expect(new Set(lines.map(l => l.text)).size).toBe(lines.length);
  });

  it('has 3+ variants per moment, each at most 90 characters, in every language', () => {
    for (const list of Object.values(LINES)) {
      expect(list.length).toBeGreaterThanOrEqual(3);
      for (const s of list) expect(s.length).toBeLessThanOrEqual(90);
    }
    for (const cat of Object.values(CATALOGS)) {
      for (const [k, v] of Object.entries(cat)) if (k.startsWith('say.')) expect((v as string).length, k).toBeLessThanOrEqual(90);
    }
    expect(sayDur('x')).toBe(2);
    expect(sayDur('x'.repeat(200))).toBe(4);
  });
});

describe('the blocks', () => {
  it('fits any session: blocks of 12 s or more ending in a rest, the finale\'s 6 s left over', () => {
    for (const sec of [40, 60, 180, 300, 600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(sec, first, mulberry32(9));
        const total = plan.reduce((s, b) => s + b.dur, 0);
        expect(total).toBeCloseTo(sec - RULES.finale, 3);
        expect(plan[plan.length - 1].kind).toBe('rest');
        for (const b of plan) if (b.kind !== 'warmup') expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        expect(plan[0].kind).toBe(first ? 'warmup' : 'push');
      }
    }
  });

  it('telegraphs the next block 4 s ahead, plays the finale and stops', () => {
    const sim = later({ planned: 60 });
    const clock = { t: 0 };
    const evs = drive(sim, 62, frame(), clock);
    const tg = ofType(evs, 'telegraph');
    expect(tg.length).toBeGreaterThanOrEqual(2);
    expect(ofType(evs, 'finale')).toHaveLength(1);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
  });

  it('says what the block asks: focus, rest, or free in the warm-up', () => {
    const sim = makeSim();
    expect(sim.block.kind).toBe('warmup');
    expect(sim.tip).toBeTruthy();
  });
});

describe('the meta', () => {
  it('prices the upgrades, buys with grain only, never past the top', () => {
    const p = { ...freshProgress(), grain: 1000 };
    expect(upPrice('fish', 3)).toBeNull();
    for (let i = 0; i < 5; i++) buyUp(p, 'fish');
    expect(p.up.fish).toBe(3);
    const poor = { ...freshProgress(), grain: 10 };
    expect(buyUp(poor, 'stream')).toBe(false);
    expect(offers(poor).every(o => !o.can)).toBe(true);
    expect(offers(p)[0].price).toBeLessThanOrEqual(offers(p)[1].price);
  });

  it('stars: one when the disciples finished, two when fed, three with time to spare or three baskets', () => {
    expect(starsFor(true, 0.9, 9)).toBe(1);
    expect(starsFor(false, 0.1, 0)).toBe(2);
    expect(starsFor(false, 0.5, 0)).toBe(3);
    expect(starsFor(false, 0.1, 3)).toBe(3);
  });

  it('settles once: sessions, the total, the day\'s gift; result() is idempotent', () => {
    const sim = makeSim({ planned: 40 });
    const clock = { t: 0 };
    const evs = drive(sim, 42, frame(), clock, () => { if (!sim.pressing) sim.press(5); });
    expect(ofType(evs, 'gift')).toHaveLength(1);
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(sim.p.sessions).toBe(1);
    expect(sim.p.total).toBe(sim.score);
    expect(sim.p.giftDay).toBe(DAY);
    expect(sim.p.seen & 1).toBe(1);
    sim.finish();
    expect(sim.p.total).toBe(sim.score);
  });

  it('result() keeps the record with Math.max', () => {
    const sim = later({ planned: 40, progress: { best: { 40: 100000 } } });
    drive(sim, 5, frame());
    sim.result();
    expect(sim.p.best['40']).toBe(100000);
    expect(sim.result().record).toBe(false);
  });

  it('finish() settles a session ended early', () => {
    const sim = later();
    drive(sim, 3, frame());
    sim.finish();
    expect(sim.phase).toBe('done');
    expect(sim.p.sessions).toBe(6);
  });

  it('closes with a passage that fits, in turn from session to session', () => {
    const first = makeSim();
    expect(first.closingVerse()).toBe('jhn6.9');
    const sim = later();
    expect(sim.closingVerse()).toBe('jhn6.35');
    for (const id of ['jhn6.9', 'mrk6.42-43', 'jhn6.11', 'jhn6.12', 'mat6.26', 'mrk6.39-40', 'jhn6.35'] as const) expect(passage(id).text.length).toBeGreaterThan(10);
  });

  it('shows the record of the length last played, else the best of any, and nothing before a first session', () => {
    const p = freshProgress();
    expect(bestOf(p)).toBeNull();
    p.best = { 180: 300, 300: 450 };
    p.lastLen = 180;
    expect(bestOf(p)).toBe(300);
    p.lastLen = 600;
    expect(bestOf(p)).toBe(450);
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('bends the headline unit (1 nakarmiony, 5 nakarmionych)', () => {
    expect([1, 5, 22].map(unit)).toEqual(['nakarmiony', 'nakarmionych', 'nakarmionych']);
    expect(t('fed', { n: 12 })).toBe('12 nakarmionych');
  });

  it('never asks to concentrate harder, never uses holiness words, "hack" or a prayer power', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /hack/, /unlock/, /błogosław/, /bless/, /segen/, /välsign/, /święt/, /holy/, /heilig/, /helig/, /modlitw/, /prayer/, /gebet/, /\bbön/, /cud(u|em|owi)?\b.*metr/]) expect(all).not.toMatch(word);
    }
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a tap at the canvas centre every 0.65 s, Space every third tap, the simulator's focus on. */
  function smoke(progress: Partial<ChlebyProgress>, seed: number, eeg: boolean) {
    const sim = makeSim({ progress, planned: 40, seed, daySeed: seed * 7 + 1, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, taps = 0, at22 = 0, up = -1;
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      sim.update(STEP, f, t);
      if (up >= 0 && t >= up) { sim.release(); up = -1; }
      if ((tap += STEP) >= 0.65) {
        tap -= 0.65;
        sim.press(RULES.laneW / 2);
        up = t + 0.08;
        if (taps++ % 3 === 0) {
          sim.key(' ', true);
          sim.key(' ', false);
        }
      }
      sim.take();
      at22 = sim.result().score;
    }
    return at22;
  }

  it('feeds people by 22 s on either band, first session or later', () => {
    for (const eeg of [false, true]) {
      for (let seed = 1; seed <= 6; seed++) {
        expect(smoke({}, seed, eeg), `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(0);
        expect(smoke({ sessions: 6, giftDay: DAY, level: 7, seen: 3 }, seed, eeg), `later, eeg ${eeg}, seed ${seed}`).toBeGreaterThan(0);
      }
    }
  });
});
